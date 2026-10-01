-- Spec 052, ticket 12 (revisao): a cancelada que assina de novo e a mensalidade que chega depois do cancelamento.
--
-- 1. A mensalidade aprovada depois do cancelamento (cobrada nos instantes antes dele, ou em analise e aprovada depois)
--    reativava a barbearia como "ativa" sem assinatura viva no Mercado Pago: a assinatura cancelada nao cobra mais, e o
--    Estado de Acesso de "ativa" e sempre liberado, entao ninguem a bloquearia no fim do mes. Agora o pagamento paga o mes
--    (o periodo avanca) e a barbearia segue cancelada, com o acesso ate o fim dele. Quem assina de novo perde a data do
--    cancelamento (record_mp_subscription): a assinatura nova e a que vale, e o primeiro pagamento dela ativa normalmente.
--    O pagamento nao traz a assinatura a que pertence (o Mercado Pago o manda so com a barbearia), entao a data do
--    cancelamento e o que diz se ha uma assinatura nova esperando.
--
-- 2. Cancelar tira o cartao: nada o cobra mais. Com isso, e com a data do cancelamento tirada ao assinar de novo, a
--    cancelada que ja assinou de novo e a que tem o cartao da assinatura nova (a bandeira vem na autorizacao): a tela a
--    reconhece, e cancelar de novo cancela a assinatura nova (pelo Navalhado ou pelo aviso do Mercado Pago).

-- 1. Assinar de novo: a assinatura nova tira a data do cancelamento -------------------------------------------------------
create or replace function public.record_mp_subscription(p_tenant_id uuid, p_mp_subscription_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.tenant_subscriptions
  set mp_subscription_id = p_mp_subscription_id,
      scheduled_plan_id = null,
      card_brand = null,
      card_last4 = null,
      canceled_at = null,
      updated_at = now()
  where tenant_id = p_tenant_id
    and status in ('trialing', 'blocked', 'canceled', 'courtesy');

  if not found then
    raise exception 'SUBSCRIPTION_NOT_UPDATABLE: a assinatura do tenant nao aceita uma nova assinatura no Mercado Pago.'
      using errcode = '55000';
  end if;
end;
$function$;

revoke all on function public.record_mp_subscription(uuid, text) from public, anon, authenticated;
grant execute on function public.record_mp_subscription(uuid, text) to service_role;

-- 2. Cancelar ---------------------------------------------------------------------------------------------------------------
create or replace function private.apply_subscription_cancellation(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions%rowtype;
begin
  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    return 'no_subscription';
  end if;

  if v_sub.status = 'canceled' then
    -- Sem a data do cancelamento e com assinatura no Mercado Pago, ela ja assinou de novo (record_mp_subscription tira a data):
    -- cancelar e cancelar a assinatura nova, e a barbearia volta a ter a data e a nao ter cartao. Com a data, ou a de antes
    -- sem assinatura no Mercado Pago: nada muda (clique repetido, ou o aviso que volta depois do cancelamento do Navalhado).
    if v_sub.canceled_at is null and v_sub.mp_subscription_id is not null then
      update public.tenant_subscriptions
      set canceled_at = now(),
          card_brand = null,
          card_last4 = null,
          updated_at = now()
      where tenant_id = p_tenant_id;
      return 'canceled';
    end if;
    return 'already_canceled';
  end if;

  -- Ha cobranca recorrente para parar. O acesso vai ate o fim do periodo pago, que o Estado de Acesso calcula; com o
  -- pagamento recusado o periodo ja acabou e o acesso fecha na hora. O cartao sai: nada o cobra mais.
  if v_sub.status in ('active', 'past_due') then
    update public.tenant_subscriptions
    set status = 'canceled',
        canceled_at = now(),
        card_brand = null,
        card_last4 = null,
        updated_at = now()
    where tenant_id = p_tenant_id;
    return 'canceled';
  end if;

  -- Em teste a assinatura no Mercado Pago so guarda o cartao e a primeira cobranca, no fim do teste: cancelar tira o
  -- cartao (a tela volta a oferecer "Assinar") e o teste segue ate o fim.
  if v_sub.status = 'trialing' and v_sub.mp_subscription_id is not null then
    update public.tenant_subscriptions
    set card_brand = null,
        card_last4 = null,
        updated_at = now()
    where tenant_id = p_tenant_id;
    return 'trial_canceled';
  end if;

  return 'not_cancelable';
end;
$function$;

revoke all on function private.apply_subscription_cancellation(uuid) from public, anon, authenticated;

-- 3. A mensalidade aprovada depois do cancelamento paga o mes sem reativar ---------------------------------------------------
create or replace function public.apply_subscription_payment(
  p_tenant_id uuid,
  p_mp_payment_id text,
  p_mp_subscription_id text,
  p_status text,
  p_amount numeric,
  p_charged_at timestamptz,
  p_kind text,
  p_card_brand text,
  p_card_last4 text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions%rowtype;
  v_previous text;
  v_start timestamptz;
  v_now timestamptz := now();
  v_scheduled_price numeric;
  v_apply_schedule boolean := false;
  v_paid_after_cancel boolean;
begin
  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    return 'ignored_no_subscription';
  end if;

  if p_mp_subscription_id is not null and v_sub.mp_subscription_id is distinct from p_mp_subscription_id then
    return 'ignored_other_subscription';
  end if;

  select c.status into v_previous from public.billing_charges c where c.mp_payment_id = p_mp_payment_id;

  -- Depois de aprovado (ou estornado), o pagamento so anda para frente: aprovado -> estornado ou
  -- contestado. Qualquer outro estado que chegue depois e repeticao.
  if v_previous in ('approved', 'refunded', 'charged_back')
     and p_status not in ('refunded', 'charged_back') then
    return 'duplicate';
  end if;

  -- Estorno ou contestacao ja registrado: o Mercado Pago avisa mais de uma vez, e um aviso
  -- repetido nao pode bloquear de novo quem ja pagou depois.
  if v_previous in ('refunded', 'charged_back') and p_status in ('refunded', 'charged_back') then
    return 'duplicate';
  end if;

  insert into public.billing_charges(
    tenant_id, mp_payment_id, mp_subscription_id, kind, status, amount, charged_at, card_brand, card_last4
  ) values (
    p_tenant_id, p_mp_payment_id, p_mp_subscription_id, p_kind, p_status, p_amount, p_charged_at, p_card_brand, p_card_last4
  )
  on conflict (mp_payment_id) do update
  set status = excluded.status,
      amount = excluded.amount,
      charged_at = excluded.charged_at,
      card_brand = coalesce(excluded.card_brand, public.billing_charges.card_brand),
      card_last4 = coalesce(excluded.card_last4, public.billing_charges.card_last4),
      updated_at = now();

  -- Mensalidade recusada.
  if p_status = 'rejected' then
    if p_kind <> 'recurring' then
      return 'recorded';
    end if;
    if v_sub.status not in ('active', 'trialing', 'past_due') then
      return 'recorded';
    end if;
    if v_sub.status = 'active'
       and v_sub.current_period_start is not null
       and p_charged_at < v_sub.current_period_start then
      return 'recorded';
    end if;
    -- Em teste, so a primeira cobranca automatica do cartao autorizado, perto do fim do teste.
    if v_sub.status = 'trialing'
       and (v_sub.card_brand is null
            or (v_sub.trial_ends_at is not null and p_charged_at < v_sub.trial_ends_at - interval '1 day')) then
      return 'recorded';
    end if;

    update public.tenant_subscriptions
    set status = 'past_due',
        first_failed_at = coalesce(first_failed_at, p_charged_at),
        updated_at = now()
    where tenant_id = p_tenant_id;

    if v_sub.status = 'past_due' then
      return 'recorded';
    end if;

    -- Aviso do dia da recusa, com a data da primeira recusa como evento.
    perform private.enqueue_billing_notice(p_tenant_id, 'payment_failed_day0', coalesce(v_sub.first_failed_at, p_charged_at));
    return 'payment_failed';
  end if;

  -- Estorno ou contestacao: bloqueada na hora.
  if p_status in ('refunded', 'charged_back') then
    if v_sub.status not in ('trialing', 'active', 'past_due', 'canceled') then
      return 'recorded';
    end if;
    -- Estorno da diferenca cobrada num upgrade (a pedido do Gerente, ou uma cobranca em duplicidade):
    -- so o historico. A barbearia paga em dia e nao e bloqueada, e o plano fica como esta; reverter o
    -- plano, se for o caso, e decisao do Proprietario. A contestacao de um upgrade continua bloqueando.
    if p_status = 'refunded' and p_kind = 'upgrade' then
      return 'recorded';
    end if;
    -- Estorno de um pagamento antigo: o periodo em curso foi pago por outro pagamento.
    if p_status = 'refunded'
       and v_sub.status = 'active'
       and v_sub.current_period_start is not null
       and p_charged_at < v_sub.current_period_start - interval '3 days' then
      return 'recorded';
    end if;

    update public.tenant_subscriptions
    set status = 'blocked',
        blocked_at = v_now,
        blocked_reason = p_status,
        updated_at = now()
    where tenant_id = p_tenant_id;

    perform private.enqueue_billing_notice(p_tenant_id, 'blocked', v_now);
    return 'blocked';
  end if;

  if p_status <> 'approved' then
    return 'recorded';
  end if;
  if p_kind <> 'recurring' then
    return 'recorded';
  end if;

  -- Mensalidade aprovada de uma assinatura cancelada que nao foi substituida por outra (a data do cancelamento esta la; quem
  -- assina de novo a perde): cobrada nos instantes antes do cancelamento, ou em analise e aprovada depois. O mes pago vale,
  -- mas a assinatura no Mercado Pago nao cobra mais: a barbearia segue cancelada, com o acesso ate o fim dele, em vez de virar
  -- ativa sem ninguem que a cobre. A rotina diaria pode ja ter bloqueado a cancelada (motivo canceled): o mes pago a libera.
  v_paid_after_cancel := v_sub.canceled_at is not null
    and (v_sub.status = 'canceled' or (v_sub.status = 'blocked' and v_sub.blocked_reason = 'canceled'));

  if (v_sub.status = 'active' or v_paid_after_cancel)
     and v_sub.current_period_end is not null
     and p_charged_at >= v_sub.current_period_end - interval '3 days'
     and p_charged_at < v_sub.current_period_end + interval '7 days' then
    v_start := v_sub.current_period_end;
  else
    v_start := p_charged_at;
  end if;

  if v_paid_after_cancel then
    update public.tenant_subscriptions
    set status = 'canceled',
        blocked_at = null,
        blocked_reason = null,
        current_period_start = v_start,
        current_period_end = v_start + interval '1 month',
        updated_at = now()
    where tenant_id = p_tenant_id;

    return 'paid_while_canceled';
  end if;

  -- A descida agendada passa a valer com a mensalidade aprovada cobrada pelo valor do plano menor: o valor da assinatura
  -- no Mercado Pago foi mudado quando ela foi agendada. Uma mensalidade cobrada por um valor maior (o Mercado Pago ainda
  -- tinha o valor antigo, ou o aviso e de uma cobranca anterior ao agendamento) renova o periodo sem trocar o plano: o
  -- agendamento espera a mensalidade seguinte, e o plano nunca fica menor do que o valor cobrado. Os profissionais
  -- cabem no plano menor: desde o agendamento o gatilho do limite recusa o que passaria dele.
  if v_sub.scheduled_plan_id is not null then
    select p.price into v_scheduled_price from public.plans p where p.id = v_sub.scheduled_plan_id;
    v_apply_schedule := v_scheduled_price is not null and p_amount <= v_scheduled_price;
  end if;

  update public.tenant_subscriptions
  set status = 'active',
      plan_id = case when v_apply_schedule then v_sub.scheduled_plan_id else plan_id end,
      scheduled_plan_id = case when v_apply_schedule then null else scheduled_plan_id end,
      current_period_start = v_start,
      current_period_end = v_start + interval '1 month',
      first_failed_at = null,
      blocked_at = null,
      blocked_reason = null,
      canceled_at = null,
      courtesy_ends_at = null,
      card_brand = coalesce(p_card_brand, card_brand),
      card_last4 = coalesce(p_card_last4, card_last4),
      updated_at = now()
  where tenant_id = p_tenant_id;

  return case when v_sub.status = 'active' then 'renewed' else 'activated' end;
end;
$function$;

revoke all on function public.apply_subscription_payment(uuid, text, text, text, numeric, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_subscription_payment(uuid, text, text, text, numeric, timestamptz, text, text, text) to service_role;
