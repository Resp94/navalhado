-- Endurece os helpers usados pelas policies sem alterar suas assinaturas públicas.
create or replace function private.get_auth_role()
returns text
language sql
security definer
set search_path to ''
as $$
  select role
  from public.users
  where id = (select auth.uid())
    and is_active = true;
$$;

create or replace function private.get_auth_tenant_id()
returns uuid
language sql
security definer
set search_path to ''
as $$
  select tenant_id
  from public.users
  where id = (select auth.uid())
    and is_active = true;
$$;

create or replace function private.is_saas_admin()
returns boolean
language sql
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role = 'proprietario'
      and is_active = true
  );
$$;

-- A RPC de estoque também precisa rejeitar usuário inativo antes de operar.
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
  where id = (select auth.uid())
    and is_active = true;

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
      cost_price = coalesce(p_unit_cost, cost_price)
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

-- Produtos continuam legíveis no tenant e graváveis somente pelos papéis atuais.
drop policy if exists products_select_policy on public.products;
create policy products_select_policy on public.products
  for select to authenticated
  using ((select private.is_saas_admin()) or tenant_id = (select private.get_auth_tenant_id()));

drop policy if exists products_insert_policy on public.products;
create policy products_insert_policy on public.products
  for insert to authenticated
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

drop policy if exists products_update_policy on public.products;
create policy products_update_policy on public.products
  for update to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'barbeiro')
    )
  )
  with check (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) in ('gerente', 'barbeiro')
    )
  );

drop policy if exists products_delete_policy on public.products;
create policy products_delete_policy on public.products
  for delete to authenticated
  using (
    (select private.is_saas_admin())
    or (
      tenant_id = (select private.get_auth_tenant_id())
      and (select private.get_auth_role()) = 'gerente'
    )
  );

-- Histórico de estoque é escrito exclusivamente pela RPC SECURITY DEFINER.
drop policy if exists product_movements_select_policy on public.product_movements;
drop policy if exists product_movements_insert_policy on public.product_movements;
drop policy if exists product_movements_update_policy on public.product_movements;
drop policy if exists product_movements_delete_policy on public.product_movements;
create policy product_movements_select_policy on public.product_movements
  for select to authenticated
  using (tenant_id = (select private.get_auth_tenant_id()));
revoke insert, update, delete on table public.product_movements from authenticated;
grant select on table public.product_movements to authenticated;

-- Caixa mantém a escrita manual usada pela tela, mas somente para usuário ativo autorizado.
drop policy if exists cash_movements_select_policy on public.cash_movements;
drop policy if exists cash_movements_insert_policy on public.cash_movements;
drop policy if exists cash_movements_update_policy on public.cash_movements;
drop policy if exists cash_movements_delete_policy on public.cash_movements;
create policy cash_movements_select_policy on public.cash_movements
  for select to authenticated
  using (tenant_id = (select private.get_auth_tenant_id()));
create policy cash_movements_insert_policy on public.cash_movements
  for insert to authenticated
  with check (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) in ('gerente', 'proprietario')
  );
revoke update, delete on table public.cash_movements from authenticated;
grant select, insert on table public.cash_movements to authenticated;

-- Quitações normais entram pela RPC validada; a tela continua podendo consultar o histórico.
drop policy if exists commission_payouts_select_policy on public.commission_payouts;
drop policy if exists commission_payouts_insert_policy on public.commission_payouts;
create policy commission_payouts_select_policy on public.commission_payouts
  for select to authenticated
  using (
    (select private.is_saas_admin())
    or tenant_id = (select private.get_auth_tenant_id())
  );
revoke insert, update, delete on table public.commission_payouts from authenticated;
grant select on table public.commission_payouts to authenticated;
