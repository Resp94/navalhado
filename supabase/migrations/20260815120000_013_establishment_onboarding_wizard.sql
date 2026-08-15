-- =========================================================================
-- MIGRATION 013: WIZARD DE ONBOARDING DO ESTABELECIMENTO E GATEKEEPER
-- Data: 2026-08-15
-- Contexto: ADR 011 / Spec 010
-- =========================================================================

-- 1. Extensão da tabela public.tenants com os campos do Onboarding
alter table public.tenants
  add column if not exists cep text,
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_neighborhood text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists latitude numeric(10, 8),
  add column if not exists longitude numeric(11, 8),
  add column if not exists base_cut_price numeric(10, 2),
  add column if not exists acquisition_channel text,
  add column if not exists onboarding_completed boolean not null default false;

-- 2. Índice parcial de performance para consultas de onboarding pendente
create index if not exists idx_tenants_onboarding_completed
  on public.tenants (id)
  where onboarding_completed = false;

-- 3. Políticas de RLS para public.tenants
alter table public.tenants enable row level security;
alter table public.tenants force row level security;

drop policy if exists tenants_select_policy on public.tenants;
create policy tenants_select_policy on public.tenants
  for select to authenticated
  using (
    (select private.is_saas_admin())
    or id = (select private.get_auth_tenant_id())
  );

drop policy if exists tenants_update_policy on public.tenants;
create policy tenants_update_policy on public.tenants
  for update to authenticated
  using (
    (select private.is_saas_admin())
    or (
      id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('proprietario', 'gerente')
    )
  )
  with check (
    (select private.is_saas_admin())
    or (
      id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('proprietario', 'gerente')
    )
  );

-- 4. Concessão explícita de privilégios de colunas
grant select (
  id, name, email, phone, logo_url, created_at, updated_at, timezone, address, business_hours,
  cep, address_street, address_number, address_neighborhood, address_city, address_state,
  latitude, longitude, base_cut_price, acquisition_channel, onboarding_completed
) on public.tenants to authenticated;

grant update (
  name, phone, logo_url, timezone, address, business_hours,
  cep, address_street, address_number, address_neighborhood, address_city, address_state,
  latitude, longitude, base_cut_price, acquisition_channel, onboarding_completed, updated_at
) on public.tenants to authenticated;
