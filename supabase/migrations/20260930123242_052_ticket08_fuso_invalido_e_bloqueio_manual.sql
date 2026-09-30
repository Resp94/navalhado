-- Spec 052, ticket 08 (revisao de codigo): dois limites nos avisos por e-mail.
--
-- 1. Fuso invalido. tenants.timezone e texto livre (o front so oferece uma lista, mas a API aceita
--    qualquer valor) e a rotina diaria contava os dias com "at time zone t.timezone": um fuso
--    invalido em uma barbearia derrubava o INSERT inteiro e nenhuma outra recebia aviso, todo dia,
--    sem ninguem ver. private.valid_timezone devolve o fuso se ele existe e Brasilia se nao (invalido,
--    vazio ou nulo). A fila diaria e o claim (que entrega o fuso para o e-mail) passam por ela.
--
-- 2. Bloqueio manual do Proprietario (sem blocked_reason) nao manda e-mail: e uma decisao dele, por
--    outro motivo (fraude, pedido do cliente), e "seu acesso foi bloqueado" sem contexto so confunde.
--    Os bloqueios com motivo (teste vencido, recusa, cancelamento, cortesia, estorno e contestacao)
--    seguem avisando.

create or replace function private.valid_timezone(p_timezone text)
returns text
language plpgsql
stable
set search_path to ''
as $function$
begin
  if p_timezone is null then
    return 'America/Sao_Paulo';
  end if;
  perform now() at time zone p_timezone;
  return p_timezone;
exception when others then
  return 'America/Sao_Paulo';
end;
$function$;
revoke all on function private.valid_timezone(text) from public, anon, authenticated;

create or replace function private.enqueue_billing_notices(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_total integer;
begin
  insert into public.billing_notices(tenant_id, kind, ref_at)
  select c.tenant_id, c.kind, c.ref_at
  from (
    select s.tenant_id, k.kind, k.ref_at
    from public.tenant_subscriptions s
    join public.tenants t on t.id = s.tenant_id
    cross join lateral (select private.valid_timezone(t.timezone) as tz) z
    cross join lateral (values
      ('trial_ending',
        case when s.status = 'trialing' and s.trial_ends_at > p_now
                  and (s.trial_ends_at at time zone z.tz)::date - 3 = (p_now at time zone z.tz)::date
             then s.trial_ends_at end),
      ('payment_failed_day3',
        case when s.status = 'past_due' and s.first_failed_at is not null
                  and (s.first_failed_at at time zone z.tz)::date + 3 = (p_now at time zone z.tz)::date
             then s.first_failed_at end),
      ('payment_failed_day4',
        case when s.status = 'past_due' and s.first_failed_at is not null
                  and (s.first_failed_at at time zone z.tz)::date + 4 = (p_now at time zone z.tz)::date
             then s.first_failed_at end),
      ('blocked',
        case when s.status = 'blocked' and s.blocked_reason is not null
                  and s.blocked_at between p_now - interval '3 days' and p_now
             then s.blocked_at end)
    ) as k(kind, ref_at)
    where k.ref_at is not null
  ) c
  on conflict (tenant_id, kind, ref_at) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end;
$function$;
revoke all on function private.enqueue_billing_notices(timestamptz) from public, anon, authenticated;

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
         p.name,
         p.price,
         s.card_brand,
         m.ref_at,
         s.trial_ends_at,
         case when s.status = 'past_due' and s.first_failed_at is not null then s.first_failed_at + interval '5 days' end,
         s.blocked_reason
  from marcados m
  join public.tenants t on t.id = m.tenant_id
  join public.tenant_subscriptions s on s.tenant_id = m.tenant_id
  join public.plans p on p.id = s.plan_id
  order by m.ref_at, m.id;
end;
$function$;
revoke all on function public.claim_billing_notices(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_billing_notices(integer, timestamptz) to service_role;
