-- Ticket 12: estorna obrigacoes abertas e bloqueia reabertura apos quitacao.
create or replace function public.reopen_comanda(
  p_comanda_id uuid,
  p_tenant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_comanda public.comandas%rowtype;
  v_appointment public.appointments%rowtype;
  v_movement record;
  v_result jsonb;
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
    raise exception 'A comanda nao esta fechada ou nao existe.' using errcode = 'P0001';
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
      group by pm.product_id
    ) movements using (product_id)
    where coalesce(items.quantity, 0) <> coalesce(movements.quantity, 0)
  ) then
    raise exception 'Os movimentos de estoque da comanda nao sao compativeis com o estorno.' using errcode = 'P0001';
  end if;

  for v_movement in
    select pm.* from public.product_movements pm
    where pm.comanda_id = v_comanda.id and pm.tenant_id = p_tenant_id
      and pm.movement_type = 'exit_sale_comanda'
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
  end loop;

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

