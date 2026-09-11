-- Corrige os caminhos de escrita que contornavam os comandos transacionais.
-- O CRUD de comandas abertas continua disponível; estados financeiros efetivos
-- passam a exigir as RPCs de fechamento, reabertura e caixa.

drop policy if exists "Users can manage cash_sessions in their tenant" on public.cash_sessions;
drop policy if exists "cash_sessions_select_policy" on public.cash_sessions;
drop policy if exists "cash_sessions_insert_policy" on public.cash_sessions;
drop policy if exists "cash_sessions_update_policy" on public.cash_sessions;
drop policy if exists "cash_sessions_delete_policy" on public.cash_sessions;

create policy cash_sessions_select_active on public.cash_sessions
for select to authenticated
using (exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and (u.role = 'proprietario' or u.tenant_id = cash_sessions.tenant_id)
));

create policy cash_sessions_insert_active_manager on public.cash_sessions
for insert to authenticated
with check (exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = cash_sessions.tenant_id)
));

create policy cash_sessions_update_open_manager on public.cash_sessions
for update to authenticated
using (status = 'open' and exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = cash_sessions.tenant_id)
))
with check (status = 'open' and exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = cash_sessions.tenant_id)
));

drop policy if exists "Users can manage comandas in their tenant" on public.comandas;
drop policy if exists "comandas_select_policy" on public.comandas;
drop policy if exists "comandas_insert_policy" on public.comandas;
drop policy if exists "comandas_update_policy" on public.comandas;
drop policy if exists "comandas_delete_policy" on public.comandas;

create policy comandas_select_active on public.comandas
for select to authenticated
using (exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and (u.role = 'proprietario' or u.tenant_id = comandas.tenant_id)
));

create policy comandas_insert_active_operator on public.comandas
for insert to authenticated
with check (exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('barbeiro', 'gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comandas.tenant_id)
));

create policy comandas_update_open_operator on public.comandas
for update to authenticated
using (status in ('aberta', 'open') and exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('barbeiro', 'gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comandas.tenant_id)
))
with check (status in ('aberta', 'open', 'cancelada') and exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('barbeiro', 'gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comandas.tenant_id)
));

create policy comandas_delete_open_manager on public.comandas
for delete to authenticated
using (status in ('aberta', 'open') and exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comandas.tenant_id)
));

drop policy if exists "Users can manage comanda_itens in their tenant" on public.comanda_itens;
drop policy if exists "comanda_itens_select_policy" on public.comanda_itens;
drop policy if exists "comanda_itens_insert_policy" on public.comanda_itens;
drop policy if exists "comanda_itens_update_policy" on public.comanda_itens;
drop policy if exists "comanda_itens_delete_policy" on public.comanda_itens;

create policy comanda_itens_select_active on public.comanda_itens
for select to authenticated
using (exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and (u.role = 'proprietario' or u.tenant_id = comanda_itens.tenant_id)
));

create policy comanda_itens_insert_open_operator on public.comanda_itens
for insert to authenticated
with check (exists (
  select 1 from public.users u
  join public.comandas c on c.tenant_id = comanda_itens.tenant_id
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('barbeiro', 'gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comanda_itens.tenant_id)
    and c.id = comanda_itens.comanda_id and c.status in ('aberta', 'open')
));

create policy comanda_itens_update_open_operator on public.comanda_itens
for update to authenticated
using (exists (
  select 1 from public.users u
  join public.comandas c on c.id = comanda_itens.comanda_id
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('barbeiro', 'gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comanda_itens.tenant_id)
    and c.tenant_id = comanda_itens.tenant_id and c.status in ('aberta', 'open')
))
with check (exists (
  select 1 from public.users u
  join public.comandas c on c.id = comanda_itens.comanda_id
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('barbeiro', 'gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comanda_itens.tenant_id)
    and c.tenant_id = comanda_itens.tenant_id and c.status in ('aberta', 'open')
));

create policy comanda_itens_delete_open_manager on public.comanda_itens
for delete to authenticated
using (exists (
  select 1 from public.users u
  join public.comandas c on c.id = comanda_itens.comanda_id
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comanda_itens.tenant_id)
    and c.tenant_id = comanda_itens.tenant_id and c.status in ('aberta', 'open')
));

drop policy if exists "Users can manage comanda_pagamentos in their tenant" on public.comanda_pagamentos;
drop policy if exists "comanda_pagamentos_select_policy" on public.comanda_pagamentos;
drop policy if exists "comanda_pagamentos_insert_policy" on public.comanda_pagamentos;
drop policy if exists "comanda_pagamentos_update_policy" on public.comanda_pagamentos;
drop policy if exists "comanda_pagamentos_delete_policy" on public.comanda_pagamentos;

create policy comanda_pagamentos_select_active on public.comanda_pagamentos
for select to authenticated
using (exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and (u.role = 'proprietario' or u.tenant_id = comanda_pagamentos.tenant_id)
));

create or replace function public.validate_comanda_item_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda_tenant uuid;
begin
  select tenant_id into v_comanda_tenant
  from public.comandas where id = new.comanda_id;
  if v_comanda_tenant is null or v_comanda_tenant <> new.tenant_id then
    raise exception 'A comanda e o item devem pertencer a mesma unidade.' using errcode = '23514';
  end if;
  if new.service_id is not null and not exists (
    select 1 from public.services s
    where s.id = new.service_id and s.tenant_id = new.tenant_id
      and coalesce(s.is_active, true) = true and s.deleted_at is null
  ) then
    raise exception 'Servico nao pertence a unidade ou esta inativo.' using errcode = '23503';
  end if;
  if new.product_id is not null and not exists (
    select 1 from public.products p
    where p.id = new.product_id and p.tenant_id = new.tenant_id and p.is_active = true
  ) then
    raise exception 'Produto nao pertence a unidade ou esta inativo.' using errcode = '23503';
  end if;
  if new.professional_id is not null and not exists (
    select 1 from public.professionals p
    where p.id = new.professional_id and p.tenant_id = new.tenant_id
      and p.is_active = true and p.deleted_at is null
  ) then
    raise exception 'Profissional nao pertence a unidade ou esta inativo.' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_comanda_item_references on public.comanda_itens;
create trigger trg_validate_comanda_item_references
before insert or update of comanda_id, tenant_id, service_id, product_id, professional_id
on public.comanda_itens
for each row execute function public.validate_comanda_item_references();

revoke all on function public.validate_comanda_item_references() from public, anon, authenticated;

create table if not exists public.comanda_settlement_requests (
  operation_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  comanda_id uuid not null references public.comandas(id) on delete cascade,
  result jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.comanda_settlement_requests enable row level security;
revoke all on table public.comanda_settlement_requests from public, anon, authenticated;

create or replace function public.settle_comanda_idempotent(
  p_operation_id uuid,
  p_comanda_id uuid default null,
  p_tenant_id uuid default null,
  p_appointment_id uuid default null,
  p_customer_id uuid default null,
  p_discount_amount numeric default 0,
  p_tip_amount numeric default 0,
  p_cash_session_id uuid default null,
  p_itens jsonb default '[]'::jsonb,
  p_pagamentos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comanda_id uuid := coalesce(p_comanda_id, p_operation_id);
  v_tenant_id uuid := p_tenant_id;
  v_result jsonb;
begin
  if p_operation_id is null then
    raise exception 'Identificador da operacao e obrigatorio.' using errcode = '22023';
  end if;

  if p_tenant_id is null then
    raise exception 'Unidade nao informada.' using errcode = '22023';
  end if;

  insert into public.comandas (
    id, tenant_id, appointment_id, customer_id, status,
    total_amount, discount_amount, tip_amount
  ) values (
    v_comanda_id, v_tenant_id, p_appointment_id, p_customer_id, 'aberta', 0, 0, 0
  ) on conflict (id) do nothing;

  insert into public.comanda_settlement_requests (operation_id, tenant_id, comanda_id)
  values (p_operation_id, v_tenant_id, v_comanda_id)
  on conflict (operation_id) do nothing;

  select result into v_result
  from public.comanda_settlement_requests
  where operation_id = p_operation_id
    and tenant_id = v_tenant_id
  for update;

  if not found then
    raise exception 'Operacao nao pertence a unidade informada.' using errcode = '42501';
  end if;
  if v_result is not null then
    return v_result;
  end if;

  v_result := public.settle_comanda(
    p_comanda_id => v_comanda_id,
    p_tenant_id => p_tenant_id,
    p_appointment_id => p_appointment_id,
    p_customer_id => p_customer_id,
    p_discount_amount => p_discount_amount,
    p_tip_amount => p_tip_amount,
    p_cash_session_id => p_cash_session_id,
    p_itens => p_itens,
    p_pagamentos => p_pagamentos
  );

  update public.comanda_settlement_requests
  set result = v_result
  where operation_id = p_operation_id and tenant_id = v_tenant_id;
  return v_result;
end;
$$;

revoke all on function public.settle_comanda_idempotent(uuid, uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.settle_comanda_idempotent(uuid, uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb) to authenticated;
