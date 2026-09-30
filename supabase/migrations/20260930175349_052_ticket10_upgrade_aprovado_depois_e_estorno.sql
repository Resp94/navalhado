-- Spec 052, ticket 10 (achados da revisao): upgrade aprovado depois da resposta, estorno de upgrade e
-- tentativas de upgrade.
--
-- 1. O pagamento de upgrade aprovado depois da resposta da funcao de cobranca (em analise que o Mercado
--    Pago aprova mais tarde, falha do banco depois da cobranca, timeout) precisa trocar o plano: o webhook
--    chama apply_plan_change com o pagamento aprovado. Para a repeticao do aviso nunca trocar o plano de
--    novo, mesmo que a barbearia ja tenha mudado de plano depois, cada cobranca de upgrade guarda quando o
--    plano foi aplicado (billing_charges.plan_applied_at) e apply_plan_change recusa aplicar de novo uma
--    cobranca marcada ('duplicate').
-- 2. O estorno de uma cobranca de upgrade so entra no historico: nao bloqueia a barbearia que paga em dia.
--    A contestacao e o estorno da mensalidade continuam bloqueando.
-- 3. get_plan_change_context conta as tentativas de upgrade do periodo que nao foram aprovadas nem
--    estornadas (failed_upgrade_attempts): a funcao de cobranca as poe na chave de idempotencia, para um
--    reenvio depois de um timeout repetir a chave (e nao cobrar duas vezes) e uma nova tentativa depois de
--    uma recusa gravada ter outra chave.

-- 1. Marca da cobranca aplicada ------------------------------------------------------------------------------
alter table public.billing_charges add column plan_applied_at timestamptz;

-- 3. Contexto da troca, com as tentativas (o tipo de retorno muda: recria a funcao) ---------------------------
drop function public.get_plan_change_context(uuid, uuid);

create function public.get_plan_change_context(p_tenant_id uuid, p_plan_id uuid)
returns table (
  status text,
  mp_subscription_id text,
  current_plan_id uuid,
  current_plan_price numeric,
  target_plan_id uuid,
  target_plan_name text,
  target_plan_price numeric,
  target_max_professionals integer,
  current_period_start timestamptz,
  current_period_end timestamptz,
  active_professionals integer,
  failed_upgrade_attempts integer
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    s.status,
    s.mp_subscription_id,
    s.plan_id,
    cp.price,
    tp.id,
    tp.name,
    tp.price,
    tp.max_professionals,
    s.current_period_start,
    s.current_period_end,
    (
      select count(*)::integer
      from public.professionals pr
      where pr.tenant_id = s.tenant_id
        and pr.deleted_at is null
    ),
    (
      select count(*)::integer
      from public.billing_charges bc
      where bc.tenant_id = s.tenant_id
        and bc.kind = 'upgrade'
        and bc.status not in ('approved', 'refunded', 'charged_back')
        and bc.charged_at >= coalesce(s.current_period_start, '-infinity'::timestamptz)
    )
  from public.tenant_subscriptions s
  join public.plans cp on cp.id = s.plan_id
  join public.plans tp on tp.id = p_plan_id
  where s.tenant_id = p_tenant_id;
$function$;

revoke all on function public.get_plan_change_context(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_plan_change_context(uuid, uuid) to service_role;

-- 1. Troca do plano: o pagamento aplicado uma vez nao se aplica de novo ---------------------------------------
create or replace function public.apply_plan_change(
  p_tenant_id uuid,
  p_plan_id uuid,
  p_mp_payment_id text,
  p_amount numeric,
  p_charged_at timestamptz,
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
  v_target public.plans%rowtype;
  v_current_price numeric;
  v_active integer;
begin
  if p_card_last4 is not null and p_card_last4 !~ '^[0-9]{4}$' then
    raise exception 'Final do cartao invalido' using errcode = '22023';
  end if;
  if p_card_brand is not null and p_card_brand !~ '^[A-Za-z0-9_]{1,40}$' then
    raise exception 'Bandeira do cartao invalida' using errcode = '22023';
  end if;

  select * into v_target from public.plans where id = p_plan_id;
  if not found then
    raise exception 'PLAN_NOT_FOUND: o plano nao existe.' using errcode = '22023';
  end if;

  -- O mesmo lock do gatilho do limite de profissionais: um cadastro em andamento termina antes da
  -- contagem abaixo, e o cadastro seguinte ja enxerga o plano novo.
  perform 1 from public.tenants where id = p_tenant_id for no key update;

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_UPDATABLE: a assinatura do tenant nao aceita trocar de plano.'
      using errcode = '55000';
  end if;

  -- O pagamento ja foi aplicado (aviso repetido, duplo clique, o webhook depois da funcao de cobranca ou
  -- o contrario): nada a fazer, mesmo que a barbearia tenha mudado de plano depois.
  if p_mp_payment_id is not null and exists (
    select 1 from public.billing_charges c where c.mp_payment_id = p_mp_payment_id and c.plan_applied_at is not null
  ) then
    return 'duplicate';
  end if;

  if v_sub.status not in ('trialing', 'active') then
    raise exception 'SUBSCRIPTION_NOT_UPDATABLE: a assinatura do tenant nao aceita trocar de plano.'
      using errcode = '55000';
  end if;

  if v_sub.plan_id = p_plan_id then
    raise exception 'PLAN_UNCHANGED: a barbearia ja esta neste plano.' using errcode = '22023';
  end if;

  -- Na assinatura ativa so se sobe: descer vale so na proxima cobranca (ticket 11).
  if v_sub.status = 'active' then
    select p.price into v_current_price from public.plans p where p.id = v_sub.plan_id;
    if v_target.price <= v_current_price then
      raise exception 'PLAN_NOT_HIGHER: na assinatura ativa so se troca para um plano mais caro.'
        using errcode = '22023';
    end if;
  end if;

  select count(*)::integer into v_active
  from public.professionals
  where tenant_id = p_tenant_id
    and deleted_at is null;
  if v_active > v_target.max_professionals then
    raise exception 'PLAN_BELOW_ACTIVE_PROFESSIONALS'
      using errcode = '53400', detail = format('profissionais_ativos=%s limite=%s', v_active, v_target.max_professionals);
  end if;

  update public.tenant_subscriptions
  set plan_id = p_plan_id,
      scheduled_plan_id = null,
      updated_at = now()
  where tenant_id = p_tenant_id;

  -- A cobranca da diferenca entra no historico como upgrade (se o webhook ja a gravou, nada muda) e fica
  -- marcada como aplicada.
  if p_mp_payment_id is not null then
    perform public.apply_subscription_payment(
      p_tenant_id, p_mp_payment_id, null, 'approved', p_amount, p_charged_at, 'upgrade', p_card_brand, p_card_last4
    );
    update public.billing_charges set plan_applied_at = now() where mp_payment_id = p_mp_payment_id;
  end if;

  return 'changed';
end;
$function$;

revoke all on function public.apply_plan_change(uuid, uuid, text, numeric, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.apply_plan_change(uuid, uuid, text, numeric, timestamptz, text, text) to service_role;

-- 2. apply_subscription_payment: o estorno de upgrade so entra no historico -----------------------------------
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

  if v_sub.status = 'active'
     and v_sub.current_period_end is not null
     and p_charged_at >= v_sub.current_period_end - interval '3 days'
     and p_charged_at < v_sub.current_period_end + interval '7 days' then
    v_start := v_sub.current_period_end;
  else
    v_start := p_charged_at;
  end if;

  update public.tenant_subscriptions
  set status = 'active',
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
