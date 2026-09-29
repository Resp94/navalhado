-- Spec 052, ticket 03: periodo de teste, Estado de Acesso e bloqueio do painel.
--
-- - tenant_subscriptions passa a ter uma linha por tenant (unique), as situacoes
--   trialing, active, past_due, blocked, canceled e courtesy e os campos novos.
--   start_date, end_date e billing_cycle saem: o periodo pago vive em
--   current_period_start/current_period_end e o ciclo e sempre mensal.
-- - blocked_reason nao esta na lista da spec: e o que deixa a tela de bloqueio
--   dizer por que a barbearia foi bloqueada depois que a rotina grava o status.
-- - Toda assinatura existente vira teste de 15 dias a partir do dia em que esta
--   migration roda em cada ambiente.
-- - private.subscription_access_state calcula o Estado de Acesso de uma linha;
--   private.tenant_access_state busca a assinatura do tenant; a RPC publica
--   get_my_access_state devolve o estado da barbearia de quem chama.
-- - private.block_expired_subscriptions grava o bloqueio das transicoes que so
--   dependem do tempo, uma vez por dia (pg_cron). A data do bloqueio e o instante
--   em que o acesso acabou, e nao o da rotina, para valer igual ao estado que a
--   funcao ja devolvia entre duas execucoes.
-- - O painel nao ganha regra de acesso no banco: o bloqueio dele e no front.

-- 1. Uma assinatura por tenant. Nao apaga nada sozinha: se houver duplicada, para.
do $migration$
begin
  if exists (
    select 1 from public.tenant_subscriptions group by tenant_id having count(*) > 1
  ) then
    raise exception 'tenant_subscriptions tem mais de uma linha para o mesmo tenant; resolva antes de aplicar'
      using errcode = '23505';
  end if;
end
$migration$;

-- 2. Campos novos.
alter table public.tenant_subscriptions
  add column trial_ends_at timestamptz,
  add column current_period_start timestamptz,
  add column current_period_end timestamptz,
  add column first_failed_at timestamptz,
  add column blocked_at timestamptz,
  add column blocked_reason text,
  add column canceled_at timestamptz,
  add column courtesy_ends_at timestamptz,
  add column scheduled_plan_id uuid references public.plans (id) on delete restrict,
  add column mp_subscription_id text,
  add column card_brand text,
  add column card_last4 text;

-- 3. Conversao dos valores antigos. Ativa e com pagamento recusado entram em teste de 15
-- dias. Suspensa continua fora do ar (blocked) e cancelada continua cancelada: reabrir em
-- teste uma barbearia que o Proprietario tinha suspendido ou cancelado seria dar acesso a
-- quem ele tirou. A data do bloqueio e do cancelamento e a ultima alteracao da linha.
alter table public.tenant_subscriptions drop constraint tenant_subscriptions_status_check;

update public.tenant_subscriptions
set status = case status
      when 'suspended' then 'blocked'
      when 'canceled' then 'canceled'
      else 'trialing'
    end,
    trial_ends_at = case when status in ('suspended', 'canceled') then null else now() + interval '15 days' end,
    blocked_at = case when status = 'suspended' then updated_at end,
    canceled_at = case when status = 'canceled' then updated_at end;

-- 4. A view deixa de ler end_date, para a coluna poder sair.
create or replace view public.view_tenants_management as
select
  t.id as tenant_id,
  t.name as tenant_name,
  t.email as tenant_email,
  t.phone as tenant_phone,
  t.logo_url as tenant_logo_url,
  t.created_at as tenant_created_at,
  p.name as plan_name,
  p.price as plan_price,
  sub.status as subscription_status,
  case sub.status
    when 'trialing' then sub.trial_ends_at
    when 'courtesy' then sub.courtesy_ends_at
    when 'blocked' then sub.blocked_at
    else sub.current_period_end
  end as subscription_end_date,
  inst.status as whatsapp_status
from public.tenants t
left join public.tenant_subscriptions sub on sub.tenant_id = t.id
left join public.plans p on p.id = sub.plan_id
left join public.whatsapp_instances inst on inst.tenant_id = t.id;

alter view public.view_tenants_management set (security_invoker = true);

-- 5. Campos antigos saem; regras novas entram.
alter table public.tenant_subscriptions
  drop column start_date,
  drop column end_date,
  drop column billing_cycle;

alter table public.tenant_subscriptions
  add constraint tenant_subscriptions_tenant_id_key unique (tenant_id),
  add constraint tenant_subscriptions_status_check
    check (status in ('trialing', 'active', 'past_due', 'blocked', 'canceled', 'courtesy')),
  add constraint tenant_subscriptions_trial_requires_end_check
    check (status <> 'trialing' or trial_ends_at is not null),
  add constraint tenant_subscriptions_past_due_requires_failure_check
    check (status <> 'past_due' or first_failed_at is not null),
  add constraint tenant_subscriptions_blocked_reason_check
    check (blocked_reason is null
           or blocked_reason in ('trial_expired', 'payment_failed', 'canceled', 'courtesy_expired'));

-- 6. Estado de Acesso de uma assinatura. allowed | warning | blocked.
create or replace function private.subscription_access_state(
  sub public.tenant_subscriptions,
  p_now timestamptz
)
returns table (access text, reason text, relevant_date timestamptz)
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_limite timestamptz;
begin
  case sub.status
    when 'trialing' then
      relevant_date := sub.trial_ends_at;
      if sub.trial_ends_at is null or p_now >= sub.trial_ends_at then
        access := 'blocked';
        reason := 'trial_expired';
      elsif sub.trial_ends_at - p_now <= interval '3 days' then
        access := 'warning';
        reason := 'trial';
      else
        access := 'allowed';
        reason := 'trial';
      end if;

    when 'active' then
      access := 'allowed';
      reason := 'active';
      relevant_date := sub.current_period_end;

    when 'past_due' then
      -- Dia 0 e a primeira recusa; bloqueia a partir do quinto dia.
      v_limite := sub.first_failed_at + interval '5 days';
      reason := 'payment_failed';
      relevant_date := v_limite;
      if v_limite is null or p_now >= v_limite then
        access := 'blocked';
      else
        access := 'warning';
      end if;

    when 'canceled' then
      reason := 'canceled';
      relevant_date := sub.current_period_end;
      if sub.current_period_end is null or p_now >= sub.current_period_end then
        access := 'blocked';
      else
        access := 'allowed';
      end if;

    when 'courtesy' then
      relevant_date := sub.courtesy_ends_at;
      if sub.courtesy_ends_at is null or p_now < sub.courtesy_ends_at then
        access := 'allowed';
        reason := 'courtesy';
      else
        access := 'blocked';
        reason := 'courtesy_expired';
      end if;

    else
      access := 'blocked';
      reason := coalesce(sub.blocked_reason, 'blocked');
      relevant_date := sub.blocked_at;
  end case;

  return next;
end;
$function$;

revoke all on function private.subscription_access_state(public.tenant_subscriptions, timestamptz)
  from public, anon, authenticated;

-- 7. Estado de Acesso do tenant. Sem assinatura, sem bloqueio (como o limite do ticket 02).
create or replace function private.tenant_access_state(
  p_tenant_id uuid,
  p_now timestamptz default now()
)
returns table (access text, reason text, relevant_date timestamptz)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_sub public.tenant_subscriptions;
begin
  select * into v_sub from public.tenant_subscriptions where tenant_id = p_tenant_id;

  if not found then
    access := 'allowed';
    reason := 'no_subscription';
    relevant_date := null;
    return next;
    return;
  end if;

  return query select * from private.subscription_access_state(v_sub, p_now);
end;
$function$;

revoke all on function private.tenant_access_state(uuid, timestamptz) from public, anon, authenticated;

-- 8. RPC do porteiro: o estado da barbearia de quem chama, sem receber tenant.
create or replace function public.get_my_access_state()
returns table (access text, reason text, relevant_date timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_tenant_id uuid := (select private.get_auth_tenant_id());
begin
  if v_tenant_id is null then
    return;
  end if;

  return query select * from private.tenant_access_state(v_tenant_id);
end;
$function$;

revoke all on function public.get_my_access_state() from public, anon;
grant execute on function public.get_my_access_state() to authenticated;

-- 9. Rotina diaria: grava o bloqueio das transicoes que so dependem do tempo.
create or replace function private.block_expired_subscriptions(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_total integer;
begin
  -- O estado e recalculado na propria linha travada pelo UPDATE, entao uma
  -- assinatura que virou ativa no meio da rotina nao e bloqueada.
  update public.tenant_subscriptions s
  set status = 'blocked',
      blocked_at = coalesce((select st.relevant_date from private.subscription_access_state(s, p_now) st), p_now),
      blocked_reason = (select st.reason from private.subscription_access_state(s, p_now) st),
      updated_at = now()
  where s.status <> 'blocked'
    and (select st.access from private.subscription_access_state(s, p_now) st) = 'blocked';

  get diagnostics v_total = row_count;
  return v_total;
end;
$function$;

revoke all on function private.block_expired_subscriptions(timestamptz) from public, anon, authenticated;

do $migration$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'block-expired-subscriptions';
  perform cron.schedule(
    'block-expired-subscriptions',
    '5 3 * * *',
    $job$select private.block_expired_subscriptions();$job$
  );
end
$migration$;

-- 10. Cadastro: a barbearia nova nasce em teste de 15 dias.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_signup jsonb := new.raw_user_meta_data -> 'tenant_signup';
  v_tenant_id uuid;
  v_plan_id uuid;
  v_tenant_name text;
  v_tenant_email text;
  v_tenant_phone text;
  v_plan_text text;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  if jsonb_typeof(v_signup) = 'object' then
    v_tenant_name := btrim(v_signup ->> 'name');
    v_tenant_email := lower(btrim(v_signup ->> 'email'));
    v_tenant_phone := regexp_replace(coalesce(v_signup ->> 'phone', ''), '[^0-9]', '', 'g');
    v_plan_text := lower(btrim(coalesce(v_signup ->> 'plan_id', '')));

    -- Compatibilidade transitoria com o front anterior ao ticket 01, que manda o
    -- nome do plano em tenant_signup.plan. Os UUIDs nao mudaram: bronze, prata e
    -- ouro apontam para Tesoura, Maquina e Bancada. Remover quando o front novo
    -- estiver em todos os ambientes.
    if v_plan_text = '' then
      v_plan_text := case lower(btrim(coalesce(v_signup ->> 'plan', '')))
        when 'bronze' then 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'
        when 'prata' then 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'
        when 'ouro' then 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33'
        else ''
      end;
    end if;

    if length(v_tenant_name) < 2 then
      raise exception 'INVALID_TENANT_NAME' using errcode = '22023';
    end if;
    if not public.email_valido(v_tenant_email) then
      raise exception 'INVALID_TENANT_EMAIL' using errcode = '22023';
    end if;
    if length(v_tenant_phone) not between 10 and 11 then
      raise exception 'INVALID_TENANT_PHONE' using errcode = '22023';
    end if;

    -- Compara como texto para que um id mal formado caia em INVALID_PLAN
    -- em vez de estourar um erro de conversao de uuid.
    select id into v_plan_id
    from public.plans
    where id::text = v_plan_text;

    if v_plan_id is null then
      raise exception 'INVALID_PLAN' using errcode = '22023';
    end if;

    insert into public.tenants (name, email, phone)
    values (v_tenant_name, v_tenant_email, v_tenant_phone)
    returning id into v_tenant_id;

    insert into public.users (id, email, name, role, tenant_id, is_active)
    values (
      new.id,
      new.email,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Gestor'),
      'gerente',
      v_tenant_id,
      true
    );

    insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
    values (v_tenant_id, v_plan_id, 'trialing', now() + interval '15 days');
  else
    insert into public.users (id, email, name, role, tenant_id, is_active)
    values (
      new.id,
      new.email,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'Profissional Novo'),
      'barbeiro',
      null,
      true
    );
  end if;

  return new;
end;
$function$;

-- 11. Metricas do Proprietario: o MRR soma o preco mensal das ativas e as
-- suspensas passam a ser as bloqueadas.
create or replace function public.get_admin_dashboard_metrics()
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_mrr numeric;
  v_active_tenants integer;
  v_suspended_tenants integer;
  v_revenue_this_month numeric;
  v_revenue_trend json;
begin
  if not exists (select 1 from public.users where id = (select auth.uid()) and role = 'proprietario') then
    raise exception 'Acesso negado. Apenas proprietários do SaaS podem visualizar estas métricas.';
  end if;
  select coalesce(sum(p.price), 0)
  into v_mrr from public.tenant_subscriptions sub join public.plans p on p.id = sub.plan_id where sub.status = 'active';
  select count(distinct tenant_id) into v_active_tenants from public.tenant_subscriptions where status = 'active';
  select count(distinct tenant_id) into v_suspended_tenants from public.tenant_subscriptions where status = 'blocked';
  select coalesce(sum(amount), 0) into v_revenue_this_month from public.invoices where status = 'paid' and paid_at >= date_trunc('month', now()) and paid_at < date_trunc('month', now() + interval '1 month');
  with months as (
    select date_trunc('month', m)::date as month_date from generate_series(date_trunc('month', now() - interval '11 months'), date_trunc('month', now()), interval '1 month') m
  ), monthly_revenue as (
    select date_trunc('month', paid_at)::date as month_date, sum(amount) as total_amount from public.invoices where status = 'paid' and paid_at >= date_trunc('month', now() - interval '11 months') group by 1
  )
  select json_agg(json_build_object('month', to_char(m.month_date, 'YYYY-MM'), 'month_label', to_char(m.month_date, 'TMMonth YY'), 'revenue', coalesce(r.total_amount, 0)) order by m.month_date)
  into v_revenue_trend from months m left join monthly_revenue r on r.month_date = m.month_date;
  return json_build_object('mrr', v_mrr, 'active_tenants', v_active_tenants, 'suspended_tenants', v_suspended_tenants, 'revenue_this_month', v_revenue_this_month, 'revenue_trend', coalesce(v_revenue_trend, '[]'::json));
end;
$function$;
