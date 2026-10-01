-- Spec 052, ticket 11 (revisao de codigo): a descida de plano agendada tem de acompanhar o que o Mercado Pago cobra.
--
-- 1. Periodo pago vencido. A mensalidade foi cobrada e o aviso do Mercado Pago ainda nao chegou: o periodo pago na
--    tela ja venceu, mas a assinatura segue "ativa". Agendar (ou pedir de novo o mesmo plano) valeria para a mensalidade
--    que acabou de ser cobrada, pelo valor do plano maior, e desfazer deixaria o aviso atrasado renovar um mes pago pelo
--    valor do plano menor. schedule_plan_downgrade e cancel_plan_downgrade recusam com PERIOD_ELAPSED (55000).
--    Com o pagamento recusado o periodo vencido e o normal (o Mercado Pago tenta de novo), e desfazer continua valendo:
--    cancel_plan_downgrade passa a servir tambem a assinatura com pagamento recusado (e nao recusa mais pela situacao: o
--    que ela guarda e o gatilho do item 3 quem decide).
--
-- 2. Valor cobrado. apply_subscription_payment so aplica o plano agendado na mensalidade aprovada cobrada pelo valor do
--    plano menor (ou menos). Uma mensalidade cobrada pelo valor do plano maior (o Mercado Pago ainda tinha o valor antigo
--    porque a mudanca falhou sem resposta, ou o aviso e de uma cobranca anterior ao agendamento) renova o periodo sem
--    trocar o plano: o agendamento espera a mensalidade seguinte, em vez de deixar o plano menor cobrado pelo valor maior.
--
-- 3. Vida do agendamento. A descida agendada so existe enquanto ha cobranca por vir: ativa, pagamento recusado ou
--    bloqueada (a assinatura segue viva no Mercado Pago, ja com o valor menor, e a mensalidade aprovada depois a aplica).
--    Nas outras situacoes (em teste, cancelada, cortesia) o gatilho tira o agendamento: senao o limite do plano menor
--    ficaria valendo, sem tela para ver ou desfazer, numa assinatura que nao cobra mais. record_mp_subscription (assinar
--    de novo) tambem tira: a assinatura nova e criada pelo valor do plano atual.
--
-- 4. E-mail da recusa. O Mercado Pago ja cobra o valor do plano agendado, entao a mensalidade recusada foi a dele:
--    claim_billing_notices entrega o plano e o preco do plano agendado quando ha um.

-- 1. Agendar e desfazer ---------------------------------------------------------------------------------------------
create or replace function public.schedule_plan_downgrade(p_tenant_id uuid, p_plan_id uuid)
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
  select * into v_target from public.plans where id = p_plan_id;
  if not found then
    raise exception 'PLAN_NOT_FOUND: o plano nao existe.' using errcode = '22023';
  end if;

  -- O mesmo lock do gatilho do limite de profissionais: um cadastro em andamento termina antes da contagem
  -- abaixo, e o cadastro seguinte ja enxerga o plano agendado.
  perform 1 from public.tenants where id = p_tenant_id for no key update;

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  -- Em teste descer troca na hora (apply_plan_change); sem pagamento em dia nao se agenda nada.
  if not found or v_sub.status <> 'active' then
    raise exception 'SUBSCRIPTION_NOT_UPDATABLE: a assinatura do tenant nao aceita agendar a descida de plano.'
      using errcode = '55000';
  end if;

  -- O periodo pago acabou e o aviso da mensalidade ainda nao chegou: agendar agora valeria para a mensalidade ja cobrada.
  if v_sub.current_period_end is null or v_sub.current_period_end <= now() then
    raise exception 'PERIOD_ELAPSED: o periodo pago ja venceu e a mensalidade ainda nao foi processada.'
      using errcode = '55000';
  end if;

  if v_sub.plan_id = p_plan_id then
    raise exception 'PLAN_UNCHANGED: a barbearia ja esta neste plano.' using errcode = '22023';
  end if;

  select p.price into v_current_price from public.plans p where p.id = v_sub.plan_id;
  if v_target.price >= v_current_price then
    raise exception 'PLAN_NOT_LOWER: descer de plano e para um plano mais barato.' using errcode = '22023';
  end if;

  select count(*)::integer into v_active
  from public.professionals
  where tenant_id = p_tenant_id
    and deleted_at is null;
  if v_active > v_target.max_professionals then
    raise exception 'PLAN_BELOW_ACTIVE_PROFESSIONALS'
      using errcode = '53400', detail = format('profissionais_ativos=%s limite=%s', v_active, v_target.max_professionals);
  end if;

  if v_sub.scheduled_plan_id = p_plan_id then
    return 'unchanged';
  end if;

  update public.tenant_subscriptions
  set scheduled_plan_id = p_plan_id,
      updated_at = now()
  where tenant_id = p_tenant_id;

  return 'scheduled';
end;
$function$;

revoke all on function public.schedule_plan_downgrade(uuid, uuid) from public, anon, authenticated;
grant execute on function public.schedule_plan_downgrade(uuid, uuid) to service_role;

create or replace function public.cancel_plan_downgrade(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions%rowtype;
begin
  perform 1 from public.tenants where id = p_tenant_id for no key update;

  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    raise exception 'SUBSCRIPTION_NOT_UPDATABLE: a barbearia nao tem assinatura.' using errcode = '55000';
  end if;

  -- Nada agendado: nada a desfazer (outro pedido ja o resolveu, ou a renovacao aplicou o plano menor).
  if v_sub.scheduled_plan_id is null then
    return 'none';
  end if;

  -- Ativa com o periodo vencido: a mensalidade ja saiu pelo valor do plano menor e o aviso dela ainda nao chegou. Com o
  -- pagamento recusado o periodo vencido e o normal e desfazer vale.
  if v_sub.status = 'active' and (v_sub.current_period_end is null or v_sub.current_period_end <= now()) then
    raise exception 'PERIOD_ELAPSED: o periodo pago ja venceu e a mensalidade ainda nao foi processada.'
      using errcode = '55000';
  end if;

  update public.tenant_subscriptions
  set scheduled_plan_id = null,
      updated_at = now()
  where tenant_id = p_tenant_id;

  return 'canceled';
end;
$function$;

revoke all on function public.cancel_plan_downgrade(uuid) from public, anon, authenticated;
grant execute on function public.cancel_plan_downgrade(uuid) to service_role;

-- 3. A descida agendada so existe enquanto ha cobranca por vir -------------------------------------------------------
create or replace function private.clear_scheduled_plan_without_billing()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.scheduled_plan_id := null;
  return new;
end;
$function$;

revoke all on function private.clear_scheduled_plan_without_billing() from public, anon, authenticated;

create trigger trg_clear_scheduled_plan_without_billing
before insert or update on public.tenant_subscriptions
for each row
when (new.scheduled_plan_id is not null and new.status not in ('active', 'past_due', 'blocked'))
execute function private.clear_scheduled_plan_without_billing();

-- Assinar de novo: a assinatura nova e criada pelo valor do plano atual, e o agendamento antigo nao vale para ela.
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

-- 2. A mensalidade aprovada aplica o plano agendado so pelo valor do plano menor --------------------------------------
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

-- 4. O e-mail da recusa cita o plano e o valor que o Mercado Pago tentou cobrar ------------------------------------------
create or replace function public.claim_billing_notices(p_limit integer default 20, p_now timestamptz default now())
returns table (
  notice_id uuid,
  kind text,
  tenant_name text,
  timezone text,
  recipients text[],
  plan_name text,
  plan_price numeric,
  card_brand text,
  ref_at timestamptz,
  trial_ends_at timestamptz,
  blocks_at timestamptz,
  blocked_reason text
)
language plpgsql
security definer
set search_path to ''
as $function$
#variable_conflict use_column
begin
  update public.billing_notices n
  set status = 'failed', detail = 'tentativas esgotadas'
  where n.status = 'sending' and n.claimed_at < p_now - interval '10 minutes' and n.attempts >= 3;

  update public.billing_notices n
  set status = 'skipped', detail = 'obsoleto'
  where (n.status = 'pending' or (n.status = 'sending' and n.claimed_at < p_now - interval '10 minutes'))
    and not private.billing_notice_is_current(n.tenant_id, n.kind, n.ref_at, p_now);

  return query
  with pegos as (
    select n.id
    from public.billing_notices n
    where (n.status = 'pending' or (n.status = 'sending' and n.claimed_at < p_now - interval '10 minutes'))
      and n.attempts < 3
    order by n.created_at, n.id
    limit greatest(p_limit, 0)
    for update skip locked
  ), marcados as (
    update public.billing_notices n
    set status = 'sending', claimed_at = p_now, attempts = n.attempts + 1
    from pegos
    where n.id = pegos.id
    returning n.id, n.tenant_id, n.kind, n.ref_at
  )
  select m.id,
         m.kind,
         t.name,
         private.valid_timezone(t.timezone),
         coalesce(
           (select array_agg(distinct lower(u.email) order by lower(u.email))
            from public.users u
            where u.tenant_id = m.tenant_id and u.role = 'gerente' and u.is_active and u.email is not null),
           '{}'::text[]),
         -- Com uma descida agendada o Mercado Pago ja cobra o valor do plano menor: foi a mensalidade dele que foi recusada.
         coalesce(sp.name, p.name),
         coalesce(sp.price, p.price),
         s.card_brand,
         m.ref_at,
         s.trial_ends_at,
         case when s.status = 'past_due' and s.first_failed_at is not null then s.first_failed_at + interval '5 days' end,
         s.blocked_reason
  from marcados m
  join public.tenants t on t.id = m.tenant_id
  join public.tenant_subscriptions s on s.tenant_id = m.tenant_id
  join public.plans p on p.id = s.plan_id
  left join public.plans sp on sp.id = s.scheduled_plan_id
  order by m.ref_at, m.id;
end;
$function$;
revoke all on function public.claim_billing_notices(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_billing_notices(integer, timestamptz) to service_role;
