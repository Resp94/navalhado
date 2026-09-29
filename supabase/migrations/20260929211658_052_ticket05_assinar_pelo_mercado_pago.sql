-- Spec 052, ticket 05: assinar pelo Mercado Pago.
--
-- Duas tabelas novas e as funcoes que a Edge Function de cobranca e o webhook usam.
-- Toda escrita vem do service_role: nem o Gerente escreve em nada disto.
--
-- billing_events: cada aviso do Mercado Pago, com chave unica. Ninguem do front le.
-- billing_charges: o historico de cobrancas do tenant (uma linha por pagamento). So o Gerente
--   do proprio tenant (e o Proprietario) le, como na assinatura.

-- 1. Eventos do webhook ------------------------------------------------------
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  topic text not null,
  resource_id text,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  detail text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;

-- 2. Historico de cobrancas ---------------------------------------------------
create table public.billing_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mp_payment_id text not null unique,
  mp_subscription_id text,
  kind text not null default 'recurring' check (kind in ('recurring', 'upgrade')),
  status text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  charged_at timestamptz not null,
  card_brand text,
  card_last4 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_charges_tenant_charged_at_idx on public.billing_charges (tenant_id, charged_at desc);

alter table public.billing_charges enable row level security;
revoke all on public.billing_charges from public, anon, authenticated;
grant select on public.billing_charges to authenticated;

create policy billing_charges_select_policy on public.billing_charges
  for select to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

-- 3. Contexto de cobranca do Gerente -----------------------------------------
-- Devolve uma linha so para o Gerente ativo com tenant. Barbeiro, Gerente sem tenant, usuario
-- inativo e usuario desconhecido recebem zero linhas: quem chama recusa. first_charge_at e a
-- data ate a qual o tenant ja tem acesso garantido (fim do teste, do periodo pago de uma
-- cancelada ou da cortesia), quando ela ainda e futura; nulo quer dizer cobranca imediata.
create or replace function public.get_billing_context(p_user_id uuid)
returns table (
  user_id uuid,
  tenant_id uuid,
  email text,
  tenant_name text,
  plan_id uuid,
  plan_name text,
  plan_price numeric,
  status text,
  mp_subscription_id text,
  first_charge_at timestamptz
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    u.id,
    u.tenant_id,
    u.email,
    t.name,
    s.plan_id,
    p.name,
    p.price,
    s.status,
    s.mp_subscription_id,
    case
      when s.status = 'trialing' and s.trial_ends_at > now() then s.trial_ends_at
      when s.status = 'canceled' and s.current_period_end > now() then s.current_period_end
      when s.status = 'courtesy' and s.courtesy_ends_at > now() then s.courtesy_ends_at
    end
  from public.users u
  join public.tenants t on t.id = u.tenant_id
  join public.tenant_subscriptions s on s.tenant_id = u.tenant_id
  join public.plans p on p.id = s.plan_id
  where u.id = p_user_id
    and u.role = 'gerente'
    and u.is_active is true;
$function$;

revoke all on function public.get_billing_context(uuid) from public, anon, authenticated;
grant execute on function public.get_billing_context(uuid) to service_role;

-- 4. Guarda o id da assinatura criada no Mercado Pago -------------------------
-- Assinatura ativa nao troca de id por aqui. A nova assinatura tira o cartao da antiga da
-- vista: a bandeira e o final voltam quando o Mercado Pago avisar o cartao da nova.
create or replace function public.record_mp_subscription(p_tenant_id uuid, p_mp_subscription_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.tenant_subscriptions
  set mp_subscription_id = p_mp_subscription_id,
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

-- 5. Eventos do webhook --------------------------------------------------------
-- new: primeira vez. retry: o aviso ja chegou mas nao foi concluido (o Mercado Pago reenvia
-- quando respondemos erro), entao processa de novo. duplicate: ja concluido, ignora.
create or replace function public.record_billing_event(p_event_key text, p_topic text, p_resource_id text, p_payload jsonb)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status text;
begin
  insert into public.billing_events(event_key, topic, resource_id, payload)
  values (p_event_key, p_topic, p_resource_id, coalesce(p_payload, '{}'::jsonb))
  on conflict (event_key) do nothing;

  if found then
    return 'new';
  end if;

  select e.status into v_status from public.billing_events e where e.event_key = p_event_key;
  if v_status in ('processed', 'ignored') then
    return 'duplicate';
  end if;
  return 'retry';
end;
$function$;

create or replace function public.finish_billing_event(p_event_key text, p_status text, p_detail text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_status not in ('processed', 'ignored', 'failed') then
    raise exception 'BILLING_EVENT_STATUS_INVALID' using errcode = '22023';
  end if;

  update public.billing_events
  set status = p_status,
      detail = left(p_detail, 500),
      processed_at = now()
  where event_key = p_event_key;
end;
$function$;

revoke all on function public.record_billing_event(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.finish_billing_event(text, text, text) from public, anon, authenticated;
grant execute on function public.record_billing_event(text, text, text, jsonb) to service_role;
grant execute on function public.finish_billing_event(text, text, text) to service_role;

-- 6. Pagamento da assinatura ---------------------------------------------------
-- Toda cobranca vira uma linha do historico, qualquer que seja a situacao. So o pagamento
-- aprovado da mensalidade (kind recurring) mexe na assinatura: ela vira ativa, o periodo pago
-- e preenchido ou avancado e a marca de recusa e de bloqueio some. A cobranca aprovada de novo
-- (aviso repetido) nao avanca o periodo duas vezes.
--
-- Periodo: o pagamento perto do fim do periodo atual (ate 3 dias antes ou 7 depois) renova a
-- partir do fim dele, para uma cobranca adiantada ou uma nova tentativa nao deslocar o ciclo;
-- qualquer outro caso (primeira cobranca, volta depois de bloqueio) comeca na data do pagamento.
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
begin
  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id for update;
  if not found then
    return 'ignored_no_subscription';
  end if;

  if p_mp_subscription_id is not null and v_sub.mp_subscription_id is distinct from p_mp_subscription_id then
    return 'ignored_other_subscription';
  end if;

  select c.status into v_previous from public.billing_charges c where c.mp_payment_id = p_mp_payment_id;

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

  if p_status <> 'approved' then
    return 'recorded';
  end if;
  if v_previous = 'approved' then
    return 'duplicate';
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

-- 7. Cartao da assinatura, so para exibicao ------------------------------------
create or replace function public.record_subscription_card(p_mp_subscription_id text, p_card_brand text, p_card_last4 text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.tenant_subscriptions
  set card_brand = p_card_brand,
      card_last4 = p_card_last4,
      updated_at = now()
  where mp_subscription_id = p_mp_subscription_id;

  return found;
end;
$function$;

revoke all on function public.record_subscription_card(text, text, text) from public, anon, authenticated;
grant execute on function public.record_subscription_card(text, text, text) to service_role;

-- 8. Resolve o tenant pelo id da assinatura no Mercado Pago ---------------------
create or replace function public.get_tenant_by_mp_subscription(p_mp_subscription_id text)
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select s.tenant_id from public.tenant_subscriptions s where s.mp_subscription_id = p_mp_subscription_id;
$function$;

revoke all on function public.get_tenant_by_mp_subscription(text) from public, anon, authenticated;
grant execute on function public.get_tenant_by_mp_subscription(text) to service_role;
