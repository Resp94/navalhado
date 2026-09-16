-- Ticket 08: reabertura de comanda com rastro correto.
-- 1) Tipo próprio de estorno de estoque, exclusivo das funções internas de
--    estorno, com vínculo explícito ao movimento original.
-- 2) Obrigação de comissão preserva a identificação do item de origem em
--    coluna sem vínculo referencial (sobrevive à substituição dos itens).
-- 3) Leitura dos estornos de pagamento de comanda para papéis financeiros
--    e índice por unidade/comanda.

alter table public.product_movements
  drop constraint product_movements_movement_type_check;

alter table public.product_movements
  add constraint product_movements_movement_type_check
  check (movement_type = any (array[
    'entry_manual', 'entry_purchase', 'exit_manual', 'exit_sale_comanda',
    'exit_internal_use', 'adjustment', 'entry_reversal'
  ]));

alter table public.product_movements
  add column if not exists reverses_movement_id uuid references public.product_movements(id);

alter table public.commission_obligations
  add column if not exists origin_item_label text;

update public.commission_obligations o
set origin_item_label = coalesce(
  (select s.name from public.services s join public.comanda_itens ci on ci.service_id = s.id where ci.id = o.comanda_item_id),
  (select p.name from public.products p join public.comanda_itens ci on ci.product_id = p.id where ci.id = o.comanda_item_id)
)
where o.origin_item_label is null and o.comanda_item_id is not null;

create or replace function public.create_commission_obligations_from_closed_comanda()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'fechada' and old.status is distinct from new.status then
    insert into public.commission_obligations (
      tenant_id,
      professional_id,
      comanda_id,
      comanda_item_id,
      origin_item_label,
      amount,
      settled_amount,
      status,
      commission_rule,
      created_by
    )
    select
      new.tenant_id,
      ci.professional_id,
      new.id,
      ci.id,
      coalesce(s.name, p.name),
      ci.snapshot_commission_amount,
      0,
      'open',
      ci.snapshot_commission_rule,
      (select auth.uid())
    from public.comanda_itens ci
    left join public.services s on s.id = ci.service_id
    left join public.products p on p.id = ci.product_id
    where ci.comanda_id = new.id
      and ci.tenant_id = new.tenant_id
      and ci.snapshot_status = 'confirmed'
      and ci.professional_id is not null
      and ci.snapshot_commission_amount > 0
      and ci.snapshot_commission_rule in ('professional_service', 'service', 'professional', 'product')
    on conflict (comanda_item_id) do nothing;
  end if;

  return new;
end;
$function$;

-- Reabertura de comanda: devolução de estoque com tipo próprio de estorno,
-- vinculada explicitamente ao movimento original que está sendo revertido.
create or replace function public.reopen_comanda(p_comanda_id uuid, p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
      reason, comanda_id, created_by, reverses_movement_id
    ) values (
      p_tenant_id, v_movement.product_id, 'entry_reversal', v_movement.quantity,
      v_movement.unit_cost, 'Estorno da reabertura da comanda', v_comanda.id, v_user_id, v_movement.id
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
  where comanda_id = v_comanda.id and snapshot_status is distinct from 'reverted';

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
$function$;

-- comanda_payment_reversals_select_financial já existe (migration
-- code_review_policies_e_extrato_profissional, 20260911142010).

create index if not exists comanda_payment_reversals_tenant_comanda_idx
  on public.comanda_payment_reversals (tenant_id, comanda_id);
