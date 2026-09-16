-- Corrige estornos repetidos e preserva a trilha de pagamentos revertidos.
alter table public.product_movements
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.users(id) on delete set null,
  add column if not exists reversal_reason text;

create index if not exists idx_product_movements_active_comanda_sale
  on public.product_movements (comanda_id, product_id)
  where movement_type = 'exit_sale_comanda' and reversed_at is null;

create table if not exists public.comanda_payment_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  comanda_id uuid not null references public.comandas(id) on delete restrict,
  original_payment_id uuid not null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  payment_method text not null,
  amount numeric(10,2) not null,
  change_amount numeric(10,2) not null default 0,
  paid_at timestamptz not null,
  reversed_by uuid not null references public.users(id) on delete restrict,
  reason text not null,
  reversed_at timestamptz not null default timezone('utc'::text, now()),
  constraint comanda_payment_reversals_original_unique unique (original_payment_id),
  constraint comanda_payment_reversals_amount_check check (amount > 0)
);

alter table public.comanda_payment_reversals enable row level security;
drop policy if exists comanda_payment_reversals_select_financial on public.comanda_payment_reversals;
create policy comanda_payment_reversals_select_financial
on public.comanda_payment_reversals for select to authenticated
using (exists (
  select 1 from public.users u
  where u.id = auth.uid() and u.is_active = true
    and u.role in ('gerente', 'proprietario')
    and (u.role = 'proprietario' or u.tenant_id = comanda_payment_reversals.tenant_id)
));
revoke all on table public.comanda_payment_reversals from public, anon, authenticated;
grant select on table public.comanda_payment_reversals to authenticated;

create or replace function public.reopen_comanda(
  p_comanda_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_comanda public.comandas%rowtype;
  v_appointment public.appointments%rowtype;
  v_movement record;
  v_result jsonb;
  v_reversal_at timestamptz := timezone('utc'::text, now());
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para reabrir comandas.' using errcode = '42501';
  end if;
  if p_comanda_id is null or p_tenant_id is null then
    raise exception 'Comanda e unidade sao obrigatorias.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select * into v_comanda
  from public.comandas
  where id = p_comanda_id and tenant_id = p_tenant_id
  for update;
  if not found or v_comanda.status <> 'fechada' then
    raise exception '%', 'A comanda n' || chr(227) || 'o est' || chr(225) || ' fechada ou n' || chr(227) || 'o existe.' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.commission_obligations o
    where o.comanda_id = v_comanda.id
      and o.tenant_id = p_tenant_id
      and (o.settled_amount > 0 or o.status = 'paid')
  ) then
    raise exception 'A comanda possui comissao ja quitada; estorne a quitacao antes de reabrir.' using errcode = 'P0001';
  end if;

  update public.commission_obligations
  set status = 'reversed',
      reversed_at = timezone('utc'::text, now()),
      reversed_by = v_user_id,
      reversal_reason = 'Reabertura da comanda'
  where comanda_id = v_comanda.id
    and tenant_id = p_tenant_id
    and status = 'open'
    and settled_amount = 0;

  if v_comanda.appointment_id is not null then
    select * into v_appointment
    from public.appointments
    where id = v_comanda.appointment_id and tenant_id = p_tenant_id
    for update;
    if not found then
      raise exception 'Agendamento da comanda nao encontrado.' using errcode = 'P0001';
    end if;
    if v_appointment.status <> 'completed' or v_appointment.payment_status <> 'paid' then
      raise exception 'O agendamento ja possui outro estado e nao pode ser revertido com seguranca.' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.comanda_pagamentos cp
    join public.cash_sessions cs on cs.id = cp.cash_session_id
    where cp.comanda_id = v_comanda.id
      and cp.tenant_id = p_tenant_id
      and cs.tenant_id = p_tenant_id
      and cs.status = 'closed'
  ) then
    raise exception 'A comanda pertence a uma sessao de caixa fechada; estorne o caixa antes de reabrir.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from (
      select ci.product_id, sum(ci.quantity)::integer as quantity
      from public.comanda_itens ci
      where ci.comanda_id = v_comanda.id and ci.item_type = 'produto' and ci.product_id is not null
      group by ci.product_id
    ) items
    full join (
      select pm.product_id, sum(pm.quantity)::integer as quantity
      from public.product_movements pm
      where pm.comanda_id = v_comanda.id and pm.tenant_id = p_tenant_id
        and pm.movement_type = 'exit_sale_comanda'
        and pm.reversed_at is null
      group by pm.product_id
    ) movements using (product_id)
    where coalesce(items.quantity, 0) <> coalesce(movements.quantity, 0)
  ) then
    raise exception '%', 'Os movimentos de estoque da comanda n' || chr(227) || 'o s' || chr(227) || 'o compat' || chr(237) || 'veis com o estorno.' using errcode = 'P0001';
  end if;

  for v_movement in
    select pm.* from public.product_movements pm
    where pm.comanda_id = v_comanda.id and pm.tenant_id = p_tenant_id
      and pm.movement_type = 'exit_sale_comanda'
      and pm.reversed_at is null
    order by pm.product_id, pm.id for update
  loop
    perform 1 from public.products
    where id = v_movement.product_id and tenant_id = p_tenant_id for update;
    if not found then
      raise exception 'Produto do movimento de estoque nao encontrado.' using errcode = 'P0001';
    end if;
    update public.products set stock_quantity = stock_quantity + v_movement.quantity
    where id = v_movement.product_id and tenant_id = p_tenant_id;
    insert into public.product_movements (
      tenant_id, product_id, movement_type, quantity, unit_cost,
      reason, comanda_id, created_by
    ) values (
      p_tenant_id, v_movement.product_id, 'entry_manual', v_movement.quantity,
      v_movement.unit_cost, 'Estorno da reabertura da comanda', v_comanda.id, v_user_id
    );
    update public.product_movements
    set reversed_at = v_reversal_at,
        reversed_by = v_user_id,
        reversal_reason = 'Reabertura da comanda'
    where id = v_movement.id;
  end loop;

  insert into public.comanda_payment_reversals (
    tenant_id, comanda_id, original_payment_id, cash_session_id,
    payment_method, amount, change_amount, paid_at, reversed_by, reason
  )
  select
    cp.tenant_id, cp.comanda_id, cp.id, cp.cash_session_id,
    cp.payment_method, cp.amount, cp.change_amount, cp.paid_at,
    v_user_id, 'Reabertura da comanda'
  from public.comanda_pagamentos cp
  where cp.comanda_id = v_comanda.id and cp.tenant_id = p_tenant_id
  on conflict (original_payment_id) do nothing;

  delete from public.comanda_pagamentos
  where comanda_id = v_comanda.id and tenant_id = p_tenant_id;

  update public.comanda_itens
  set snapshot_status = 'reverted',
      snapshot_reverted_at = timezone('utc'::text, now()),
      snapshot_reverted_by = v_user_id
  where comanda_id = v_comanda.id and snapshot_status = 'confirmed';

  update public.comandas
  set status = 'aberta', closed_at = null, updated_at = timezone('utc'::text, now())
  where id = v_comanda.id and tenant_id = p_tenant_id
  returning * into v_comanda;

  if v_comanda.appointment_id is not null then
    update public.appointments
    set status = 'confirmed', payment_status = 'pending', updated_at = timezone('utc'::text, now())
    where id = v_comanda.appointment_id and tenant_id = p_tenant_id;
  end if;

  select to_jsonb(v_comanda) || jsonb_build_object(
    'itens', coalesce((select jsonb_agg(to_jsonb(ci) order by ci.created_at, ci.id) from public.comanda_itens ci where ci.comanda_id = v_comanda.id), '[]'::jsonb),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(cp) order by cp.paid_at, cp.id) from public.comanda_pagamentos cp where cp.comanda_id = v_comanda.id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.reopen_comanda(uuid, uuid) from public, anon;
grant execute on function public.reopen_comanda(uuid, uuid) to authenticated;

create or replace function public.register_cash_session_adjustment(
  p_session_id uuid,
  p_tenant_id uuid,
  p_adjustment_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_role text;
  v_user_tenant uuid;
  v_session public.cash_sessions%rowtype;
  v_adjustment_id uuid;
  v_adjusted_expected numeric;
  v_adjusted_closing numeric;
  v_adjusted_difference numeric;
  v_previous_adjustment_amount numeric := 0;
begin
  select role, tenant_id into v_user_role, v_user_tenant
  from public.users where id = v_user_id and is_active = true;
  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado para ajustar o caixa.' using errcode = '42501';
  end if;
  if p_tenant_id is null or p_session_id is null or p_adjustment_amount is null or p_adjustment_amount = 0 then
    raise exception 'Sessao, unidade e ajuste valido sao obrigatorios.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe uma justificativa com pelo menos cinco caracteres.' using errcode = '22023';
  end if;
  if v_user_role <> 'proprietario' and v_user_tenant <> p_tenant_id then
    raise exception 'Acesso negado para esta unidade.' using errcode = '42501';
  end if;

  select * into v_session from public.cash_sessions
  where id = p_session_id and tenant_id = p_tenant_id for update;
  if not found or v_session.status <> 'closed' then
    raise exception 'A sessao de caixa precisa estar fechada.' using errcode = 'P0001';
  end if;
  if v_session.expected_amount is null or v_session.closing_amount is null or v_session.difference_amount is null then
    raise exception 'A sessao nao possui fotografia financeira completa.' using errcode = 'P0001';
  end if;

  select coalesce(sum(adjustment_amount), 0)
    into v_previous_adjustment_amount
  from public.cash_session_adjustments
  where cash_session_id = p_session_id;

  v_adjusted_expected := v_session.expected_amount;
  v_adjusted_closing := round(
    v_session.closing_amount + v_previous_adjustment_amount + round(p_adjustment_amount, 2),
    2
  );
  v_adjusted_difference := round(v_adjusted_closing - v_adjusted_expected, 2);

  insert into public.cash_session_adjustments (
    tenant_id, cash_session_id, created_by, reason,
    original_expected_amount, original_closing_amount, original_difference_amount,
    adjustment_amount, adjusted_expected_amount, adjusted_closing_amount, adjusted_difference_amount
  ) values (
    p_tenant_id, p_session_id, v_user_id, btrim(p_reason),
    v_session.expected_amount, v_session.closing_amount, v_session.difference_amount,
    round(p_adjustment_amount, 2), v_adjusted_expected, v_adjusted_closing, v_adjusted_difference
  ) returning id into v_adjustment_id;

  return jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'cash_session_id', p_session_id,
    'original_expected_amount', v_session.expected_amount,
    'original_closing_amount', v_session.closing_amount,
    'original_difference_amount', v_session.difference_amount,
    'previous_adjustment_amount', v_previous_adjustment_amount,
    'adjusted_closing_amount', v_adjusted_closing,
    'adjusted_difference_amount', v_adjusted_difference
  );
end;
$$;

revoke all on function public.register_cash_session_adjustment(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.register_cash_session_adjustment(uuid, uuid, numeric, text) to authenticated;
