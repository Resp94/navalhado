-- Alinha a RPC de estoque aos tipos detalhados usados pelo schema e pelo frontend.
create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_unit_cost numeric,
  p_reason text default null,
  p_comanda_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  v_tenant_id uuid;
  v_current_stock integer;
  v_new_stock integer;
  v_delta integer;
  v_persisted_quantity integer;
  v_user_role text;
  v_user_tenant uuid;
begin
  select role, tenant_id
    into v_user_role, v_user_tenant
  from public.users
  where id = (select auth.uid());

  if v_user_role is null or v_user_role not in ('gerente', 'proprietario') then
    raise exception 'Acesso negado: apenas gerentes e proprietários podem movimentar estoque.';
  end if;

  select tenant_id, stock_quantity
    into v_tenant_id, v_current_stock
  from public.products
  where id = p_product_id
  for update;

  if v_tenant_id is null then
    raise exception 'Produto não encontrado.';
  end if;

  if v_user_role <> 'proprietario' and v_user_tenant <> v_tenant_id then
    raise exception 'Acesso negado para este tenant.';
  end if;

  if p_movement_type in ('entry_manual', 'entry_purchase') then
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'Quantidade de entrada deve ser maior que zero.';
    end if;
    v_delta := p_quantity;
    v_new_stock := v_current_stock + p_quantity;
  elsif p_movement_type in ('exit_manual', 'exit_sale_comanda', 'exit_internal_use') then
    if p_quantity is null or p_quantity <= 0 then
      raise exception 'Quantidade de saída deve ser maior que zero.';
    end if;
    if v_current_stock < p_quantity then
      raise exception 'Estoque insuficiente para a saída solicitada.';
    end if;
    v_delta := -p_quantity;
    v_new_stock := v_current_stock - p_quantity;
  elsif p_movement_type = 'adjustment' then
    if p_quantity is null or p_quantity < 0 then
      raise exception 'Ajuste de estoque não pode ser negativo.';
    end if;
    v_delta := p_quantity - v_current_stock;
    if v_delta = 0 then
      raise exception 'O ajuste informado não altera o estoque.';
    end if;
    v_new_stock := p_quantity;
  else
    raise exception 'Tipo de movimentação inválido: %', p_movement_type;
  end if;

  v_persisted_quantity := abs(v_delta);

  update public.products
  set stock_quantity = v_new_stock,
      cost_price = coalesce(p_unit_cost, cost_price),
      updated_at = timezone('utc'::text, now())
  where id = p_product_id;

  insert into public.product_movements (
    tenant_id,
    product_id,
    comanda_id,
    movement_type,
    quantity,
    unit_cost,
    reason,
    created_by
  ) values (
    v_tenant_id,
    p_product_id,
    p_comanda_id,
    p_movement_type,
    v_persisted_quantity,
    coalesce(p_unit_cost, 0),
    p_reason,
    (select auth.uid())
  );

  return jsonb_build_object(
    'product_id', p_product_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'delta', v_delta
  );
end;
$$;

revoke all on function public.adjust_product_stock(uuid, text, integer, numeric, text, uuid) from public, anon;
grant execute on function public.adjust_product_stock(uuid, text, integer, numeric, text, uuid) to authenticated;
