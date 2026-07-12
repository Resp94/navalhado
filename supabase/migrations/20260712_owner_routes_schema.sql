-- =========================================================================
-- MIGAÇÃO SQL: Tabelas Ausentes, RLS, View e RPC para Painel Administrativo
-- =========================================================================

-- Habilitar extensão pgcrypto se necessário para gerar UUIDs
create extension if not exists "pgcrypto";

-- Schema Privado (já deve existir, mas garantimos)
create schema if not exists private;

-- =========================================================================
-- 1. CRIAÇÃO DE TABELAS AUSENTES
-- =========================================================================

-- Tabela: plans
create table if not exists public.plans (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    price numeric(10, 2) not null check (price >= 0),
    max_professionals integer not null check (max_professionals > 0),
    features jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: tenant_subscriptions
create table if not exists public.tenant_subscriptions (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    plan_id uuid not null references public.plans(id) on delete restrict,
    status text not null check (status in ('active', 'suspended', 'past_due', 'canceled')),
    start_date timestamp with time zone not null,
    end_date timestamp with time zone not null,
    billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: invoices
create table if not exists public.invoices (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    tenant_subscription_id uuid not null references public.tenant_subscriptions(id) on delete cascade,
    external_id text not null unique,
    amount numeric(10, 2) not null check (amount >= 0),
    status text not null check (status in ('pending', 'paid', 'overdue', 'canceled')),
    due_date timestamp with time zone not null,
    paid_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: professionals
create table if not exists public.professionals (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    user_id uuid references public.users(id) on delete set null,
    name text not null,
    phone text not null,
    commission_percentage numeric(5, 2) not null check (commission_percentage >= 0 and commission_percentage <= 100),
    weekly_schedule jsonb default '{}'::jsonb,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: services
create table if not exists public.services (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    description text,
    price numeric(10, 2) not null check (price >= 0),
    duration_minutes integer not null check (duration_minutes > 0),
    category text not null,
    commission_percentage numeric(5, 2) check (commission_percentage >= 0 and commission_percentage <= 100),
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: customers
create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    phone text not null,
    email text,
    notes text,
    token_acesso uuid default gen_random_uuid() not null unique,
    token_expirado_em timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: appointments
create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    customer_id uuid not null references public.customers(id) on delete restrict,
    professional_id uuid not null references public.professionals(id) on delete restrict,
    service_id uuid not null references public.services(id) on delete restrict,
    start_time timestamp with time zone not null,
    end_time timestamp with time zone not null,
    status text not null check (status in ('pending', 'confirmed', 'completed', 'canceled')),
    payment_status text not null check (payment_status in ('pending', 'paid')),
    cancellation_reason text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: payments
create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    appointment_id uuid not null references public.appointments(id) on delete restrict,
    method text not null check (method in ('Dinheiro', 'PIX', 'Cartão')),
    amount numeric(10, 2) not null check (amount >= 0),
    commission_value numeric(10, 2) not null check (commission_value >= 0),
    paid_at timestamp with time zone default timezone('utc'::text, now()) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela: evolution_api_instances
create table if not exists public.evolution_api_instances (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    instance_name text not null unique,
    api_key text not null,
    qr_code text,
    status text not null check (status in ('connected', 'disconnected', 'pairing')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================================
-- 2. ÍNDICES DE PERFORMANCE
-- =========================================================================

create index if not exists idx_tenant_subscriptions_tenant_id on public.tenant_subscriptions(tenant_id);
create index if not exists idx_invoices_tenant_id on public.invoices(tenant_id);
create index if not exists idx_professionals_tenant_id on public.professionals(tenant_id);
create index if not exists idx_professionals_user_id on public.professionals(user_id);
create index if not exists idx_services_tenant_id on public.services(tenant_id);
create index if not exists idx_customers_tenant_id on public.customers(tenant_id);
create index if not exists idx_appointments_tenant_id on public.appointments(tenant_id);
create index if not exists idx_appointments_customer_id on public.appointments(customer_id);
create index if not exists idx_appointments_professional_id on public.appointments(professional_id);
create index if not exists idx_appointments_service_id on public.appointments(service_id);
create index if not exists idx_payments_tenant_id on public.payments(tenant_id);
create index if not exists idx_payments_appointment_id on public.payments(appointment_id);
create index if not exists idx_evolution_api_tenant_id on public.evolution_api_instances(tenant_id);

create index if not exists idx_appointments_start_time on public.appointments(start_time);
create index if not exists idx_customers_token_acesso on public.customers(token_acesso);

-- =========================================================================
-- 3. HABILITAR E FORÇAR RLS
-- =========================================================================

alter table public.plans enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.professionals enable row level security;
alter table public.services enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.evolution_api_instances enable row level security;

alter table public.plans force row level security;
alter table public.tenant_subscriptions force row level security;
alter table public.invoices force row level security;
alter table public.professionals force row level security;
alter table public.services force row level security;
alter table public.customers force row level security;
alter table public.appointments force row level security;
alter table public.payments force row level security;
alter table public.evolution_api_instances force row level security;

-- =========================================================================
-- 4. POLÍTICAS DE RLS GRANULARES
-- =========================================================================

-- Tabela: plans
create policy plans_select_policy on public.plans
  for select to authenticated, anon
  using (true);

create policy plans_insert_policy on public.plans
  for insert to authenticated
  with check ((select private.is_saas_admin()));

create policy plans_update_policy on public.plans
  for update to authenticated
  using ((select private.is_saas_admin()));

create policy plans_delete_policy on public.plans
  for delete to authenticated
  using ((select private.is_saas_admin()));

-- Tabela: tenant_subscriptions
create policy subscriptions_select_policy on public.tenant_subscriptions
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy subscriptions_insert_policy on public.tenant_subscriptions
  for insert to authenticated
  with check ((select private.is_saas_admin()));

create policy subscriptions_update_policy on public.tenant_subscriptions
  for update to authenticated
  using ((select private.is_saas_admin()));

create policy subscriptions_delete_policy on public.tenant_subscriptions
  for delete to authenticated
  using ((select private.is_saas_admin()));

-- Tabela: invoices
create policy invoices_select_policy on public.invoices
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy invoices_insert_policy on public.invoices
  for insert to authenticated
  with check ((select private.is_saas_admin()));

create policy invoices_update_policy on public.invoices
  for update to authenticated
  using ((select private.is_saas_admin()));

create policy invoices_delete_policy on public.invoices
  for delete to authenticated
  using ((select private.is_saas_admin()));

-- Tabela: professionals
create policy professionals_select_policy on public.professionals
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy professionals_insert_policy on public.professionals
  for insert to authenticated
  with check (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

create policy professionals_update_policy on public.professionals
  for update to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

create policy professionals_delete_policy on public.professionals
  for delete to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

-- Tabela: services
create policy services_select_policy on public.services
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy services_insert_policy on public.services
  for insert to authenticated
  with check (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

create policy services_update_policy on public.services
  for update to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

create policy services_delete_policy on public.services
  for delete to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

-- Tabela: customers
create policy customers_select_policy on public.customers
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy customers_insert_policy on public.customers
  for insert to authenticated
  with check (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy customers_update_policy on public.customers
  for update to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy customers_delete_policy on public.customers
  for delete to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

-- Tabela: appointments
create policy appointments_select_policy on public.appointments
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy appointments_insert_policy on public.appointments
  for insert to authenticated
  with check (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy appointments_update_policy on public.appointments
  for update to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy appointments_delete_policy on public.appointments
  for delete to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

-- Tabela: payments
create policy payments_select_policy on public.payments
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy payments_insert_policy on public.payments
  for insert to authenticated
  with check (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) in ('gerente', 'barbeiro')
    )
  );

create policy payments_update_policy on public.payments
  for update to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

create policy payments_delete_policy on public.payments
  for delete to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

-- Tabela: evolution_api_instances
create policy instances_select_policy on public.evolution_api_instances
  for select to authenticated
  using (
    (select private.is_saas_admin()) or 
    tenant_id = (select private.get_auth_tenant_id())
  );

create policy instances_insert_policy on public.evolution_api_instances
  for insert to authenticated
  with check (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

create policy instances_update_policy on public.evolution_api_instances
  for update to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

create policy instances_delete_policy on public.evolution_api_instances
  for delete to authenticated
  using (
    (select private.is_saas_admin()) or (
      tenant_id = (select private.get_auth_tenant_id()) and 
      (select private.get_auth_role()) = 'gerente'
    )
  );

-- =========================================================================
-- 5. VIEW DE GESTÃO DE BARBEARIAS (TENANTS)
-- =========================================================================

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
  sub.end_date as subscription_end_date,
  inst.status as whatsapp_status
from public.tenants t
left join public.tenant_subscriptions sub on sub.tenant_id = t.id and sub.status != 'canceled'
left join public.plans p on p.id = sub.plan_id
left join public.evolution_api_instances inst on inst.tenant_id = t.id;

-- =========================================================================
-- 6. RPC DE MÉTRICAS CONSOLIDADAS DO DASHBOARD DO PROPRIETÁRIO
-- =========================================================================

create or replace function public.get_admin_dashboard_metrics()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mrr numeric;
  v_active_tenants integer;
  v_suspended_tenants integer;
  v_revenue_this_month numeric;
  v_revenue_trend json;
begin
  -- Verificação de segurança: apenas proprietários do SaaS podem rodar essa função
  if not exists (
    select 1 from public.users
    where id = (select auth.uid()) and role = 'proprietario'
  ) then
    raise exception 'Acesso negado. Apenas proprietários do SaaS podem visualizar estas métricas.';
  end if;

  -- 1. Calcular MRR (soma dos planos ativos das assinaturas ativas)
  -- Ajustado para o ciclo de faturamento (mensal vs anual / 12)
  select coalesce(sum(
    case 
      when sub.billing_cycle = 'yearly' then p.price / 12.0
      else p.price
    end
  ), 0)
  into v_mrr
  from public.tenant_subscriptions sub
  join public.plans p on p.id = sub.plan_id
  where sub.status = 'active';

  -- 2. Barbearias Ativas
  select count(distinct tenant_id)
  into v_active_tenants
  from public.tenant_subscriptions
  where status = 'active';

  -- 3. Barbearias Suspensas
  select count(distinct tenant_id)
  into v_suspended_tenants
  from public.tenant_subscriptions
  where status = 'suspended';

  -- 4. Receita Bruta do Mês Atual (soma das faturas pagas neste mês)
  select coalesce(sum(amount), 0)
  into v_revenue_this_month
  from public.invoices
  where status = 'paid'
    and paid_at >= date_trunc('month', now())
    and paid_at < date_trunc('month', now() + interval '1 month');

  -- 5. Evolução da Receita nos Últimos 12 Meses (agrupado por ano/mês)
  with months as (
    select date_trunc('month', m)::date as month_date
    from generate_series(
      date_trunc('month', now() - interval '11 months'),
      date_trunc('month', now()),
      interval '1 month'
    ) m
  ),
  monthly_revenue as (
    select 
      date_trunc('month', paid_at)::date as month_date,
      sum(amount) as total_amount
    from public.invoices
    where status = 'paid'
      and paid_at >= date_trunc('month', now() - interval '11 months')
    group by 1
  )
  select json_agg(
    json_build_object(
      'month', to_char(m.month_date, 'YYYY-MM'),
      'month_label', to_char(m.month_date, 'TMMonth YY'),
      'revenue', coalesce(r.total_amount, 0)
    )
    order by m.month_date
  )
  into v_revenue_trend
  from months m
  left join monthly_revenue r on r.month_date = m.month_date;

  return json_build_object(
    'mrr', v_mrr,
    'active_tenants', v_active_tenants,
    'suspended_tenants', v_suspended_tenants,
    'revenue_this_month', v_revenue_this_month,
    'revenue_trend', coalesce(v_revenue_trend, '[]'::json)
  );
end;
$$;
