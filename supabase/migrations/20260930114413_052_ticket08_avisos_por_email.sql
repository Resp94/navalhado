-- Spec 052, ticket 08: avisos por e-mail da assinatura.
--
-- O banco decide quem recebe cada aviso e quando; a Edge Function send-billing-email so renderiza e
-- envia pelo Resend. billing_notices e a fila e o registro: uma linha por tenant, tipo e evento
-- (fim do teste, primeira recusa ou bloqueio), com chave unica, entao o mesmo aviso nunca sai duas
-- vezes, nem se a rotina rodar de novo no mesmo dia.
--
--   trial_ending         3 dias antes do fim do teste (dia local da barbearia)
--   payment_failed_day0  dia da recusa: gravado na hora por apply_subscription_payment
--   payment_failed_day3  terceiro dia da recusa
--   payment_failed_day4  quarto dia da recusa ("amanha o acesso sera bloqueado")
--   blocked              bloqueio efetivado (por tempo, na rotina; por estorno ou contestacao, na hora)
--
-- Fluxo: private.enqueue_billing_notices roda todo dia as 12:00 UTC (09:00 em Brasilia) e grava os
-- avisos de prazo; um cron a cada 5 minutos chama a funcao send-billing-email so quando ha aviso
-- pendente; a funcao pede os pendentes a claim_billing_notices (que ja descarta os que deixaram de
-- valer, por exemplo porque a barbearia pagou) e conclui cada um com finish_billing_notice.
-- A funcao prova que o chamador e o cron com um segredo do Vault (billing_notices_secret), que esta
-- migration cria se nao existir.

-- 1. Fila e registro ------------------------------------------------------------------------------
create table public.billing_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('trial_ending', 'payment_failed_day0', 'payment_failed_day3', 'payment_failed_day4', 'blocked')),
  -- O evento do aviso: fim do teste, primeira recusa ou bloqueio. Um aviso por evento.
  ref_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  detail text,
  created_at timestamptz not null default now(),
  unique (tenant_id, kind, ref_at)
);

create index billing_notices_open_idx on public.billing_notices (created_at) where status in ('pending', 'sending');

alter table public.billing_notices enable row level security;
revoke all on public.billing_notices from public, anon, authenticated;

-- 2. Gravar um aviso ---------------------------------------------------------------------------------
create or replace function private.enqueue_billing_notice(p_tenant_id uuid, p_kind text, p_ref_at timestamptz)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public.billing_notices(tenant_id, kind, ref_at)
  values (p_tenant_id, p_kind, p_ref_at)
  on conflict (tenant_id, kind, ref_at) do nothing;
$function$;
revoke all on function private.enqueue_billing_notice(uuid, text, timestamptz) from public, anon, authenticated;

-- 3. O aviso ainda vale? ------------------------------------------------------------------------------
-- Entre gravar e enviar a barbearia pode ter pago (ou o teste ter acabado): o aviso de "atualize o
-- cartao" nao pode sair para quem ja esta em dia.
create or replace function private.billing_notice_is_current(
  p_tenant_id uuid,
  p_kind text,
  p_ref_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select exists (
    select 1
    from public.tenant_subscriptions s
    where s.tenant_id = p_tenant_id
      and case p_kind
        when 'trial_ending' then s.status = 'trialing' and s.trial_ends_at = p_ref_at and s.trial_ends_at > p_now
        when 'blocked' then s.status = 'blocked' and s.blocked_at = p_ref_at
        else s.status = 'past_due' and s.first_failed_at = p_ref_at
      end
  );
$function$;
revoke all on function private.billing_notice_is_current(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

-- 4. Avisos de prazo: rotina diaria ----------------------------------------------------------------------
-- O dia e o dia local da barbearia (tenants.timezone): "3 dias antes do fim do teste" e o dia em que
-- a data local do fim menos 3 e a data local de hoje. Quem ja foi avisado nao entra de novo (chave
-- unica). O bloqueio so avisa quem foi bloqueado nos ultimos 3 dias: uma barbearia bloqueada ha
-- semanas nao recebe e-mail de "bloqueio efetivado".
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
    cross join lateral (values
      ('trial_ending',
        case when s.status = 'trialing' and s.trial_ends_at > p_now
                  and (s.trial_ends_at at time zone t.timezone)::date - 3 = (p_now at time zone t.timezone)::date
             then s.trial_ends_at end),
      ('payment_failed_day3',
        case when s.status = 'past_due' and s.first_failed_at is not null
                  and (s.first_failed_at at time zone t.timezone)::date + 3 = (p_now at time zone t.timezone)::date
             then s.first_failed_at end),
      ('payment_failed_day4',
        case when s.status = 'past_due' and s.first_failed_at is not null
                  and (s.first_failed_at at time zone t.timezone)::date + 4 = (p_now at time zone t.timezone)::date
             then s.first_failed_at end),
      ('blocked',
        case when s.status = 'blocked' and s.blocked_at between p_now - interval '3 days' and p_now
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

-- 5. Entrega dos pendentes para o envio --------------------------------------------------------------------
-- Descarta o que deixou de valer, devolve para a fila o envio que travou ha mais de 10 minutos (ate 3
-- tentativas) e entrega os pendentes ja com os dados do e-mail: destinatarios (os Gerentes ativos da
-- barbearia, em minuscula, sem repeticao), plano e preco, fuso, datas e o motivo do bloqueio.
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
         t.timezone,
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

-- 6. Conclusao do envio ---------------------------------------------------------------------------------------
--   sent    enviado a todos os destinatarios
--   skipped nada a enviar (sem destinatario)
--   retry   falha passageira: volta para a fila, ate 3 tentativas
--   failed  falha definitiva
create or replace function public.finish_billing_notice(p_id uuid, p_outcome text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_outcome not in ('sent', 'skipped', 'retry', 'failed') then
    raise exception 'Conclusao invalida: %', p_outcome using errcode = '22023';
  end if;

  update public.billing_notices n
  set status = case
        when p_outcome = 'retry' and n.attempts >= 3 then 'failed'
        when p_outcome = 'retry' then 'pending'
        else p_outcome
      end,
      sent_at = case when p_outcome = 'sent' then now() else n.sent_at end,
      detail = left(p_detail, 300)
  where n.id = p_id;
end;
$function$;
revoke all on function public.finish_billing_notice(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finish_billing_notice(uuid, text, text) to service_role;

-- 7. Segredo do cron ---------------------------------------------------------------------------------------------
do $migration$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'billing_notices_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'billing_notices_secret',
      'Segredo do cron para chamar a funcao send-billing-email'
    );
  end if;
end
$migration$;

create or replace function public.verify_billing_notices_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(p_secret, '') <> ''
    and exists (
      select 1 from vault.decrypted_secrets where name = 'billing_notices_secret' and decrypted_secret = p_secret
    );
$function$;
revoke all on function public.verify_billing_notices_secret(text) from public, anon, authenticated;
grant execute on function public.verify_billing_notices_secret(text) to service_role;

-- 8. apply_subscription_payment grava o aviso do dia da recusa e o do bloqueio por estorno ------------------
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

-- 9. Tarefas agendadas --------------------------------------------------------------------------------------------------
do $migration$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Vault secret project_url is required';
  end if;

  perform cron.unschedule(jobid)
  from cron.job
  where jobname in ('enqueue-billing-notices', 'send-billing-notices');

  -- 12:00 UTC = 09:00 em Brasilia: o e-mail chega de manha, e a rotina que grava o bloqueio (03:05
  -- UTC) ja rodou.
  perform cron.schedule(
    'enqueue-billing-notices',
    '0 12 * * *',
    $job$select private.enqueue_billing_notices();$job$
  );

  -- So chama a funcao quando ha aviso para enviar (pendente, ou preso em "enviando" ha mais de 10 minutos).
  perform cron.schedule(
    'send-billing-notices',
    '*/5 * * * *',
    $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
        || '/functions/v1/send-billing-email',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'x-db-trigger-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'billing_notices_secret' limit 1)
      )::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    )
    where exists (
      select 1 from public.billing_notices n
      where n.status = 'pending' or (n.status = 'sending' and n.claimed_at < now() - interval '10 minutes')
    );
    $job$
  );
end
$migration$;
