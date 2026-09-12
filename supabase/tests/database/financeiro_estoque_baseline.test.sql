begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

select has_table('public', 'products', 'products table exists');
select has_table('public', 'product_movements', 'product movements table exists');
select has_table('public', 'cash_sessions', 'cash sessions table exists');
select has_table('public', 'commission_payouts', 'commission payouts table exists');

select ok(
  exists(
    select 1
    from pg_constraint
    where conrelid = 'public.product_movements'::regclass
      and conname = 'product_movements_movement_type_check'
      and pg_get_constraintdef(oid) like '%entry_manual%'
      and pg_get_constraintdef(oid) like '%entry_purchase%'
      and pg_get_constraintdef(oid) like '%exit_manual%'
      and pg_get_constraintdef(oid) like '%exit_sale_comanda%'
      and pg_get_constraintdef(oid) like '%exit_internal_use%'
      and pg_get_constraintdef(oid) like '%adjustment%'
  ),
  'product movement constraint accepts current detailed movement types'
);

select ok(
  exists(
    select 1
    from pg_constraint
    where conrelid = 'public.product_movements'::regclass
      and conname = 'product_movements_quantity_check'
      and pg_get_constraintdef(oid) like '%quantity > 0%'
  ),
  'product movement quantity is positive in the persisted contract'
);

select ok(
  to_regprocedure('public.adjust_product_stock(uuid,text,integer,numeric,text,uuid)') is not null,
  'stock adjustment function signature exists'
);

select ok(
  position('v_delta' in pg_get_functiondef('public.adjust_product_stock(uuid,text,integer,numeric,text,uuid)'::regprocedure)) > 0,
  'stock adjustment function derives a signed delta before persisting movement'
);

select ok(
  has_function_privilege('authenticated', 'public.adjust_product_stock(uuid,text,integer,numeric,text,uuid)', 'EXECUTE'),
  'authenticated role can call the current stock adjustment function'
);

select ok(
  has_function_privilege('authenticated', 'public.register_commission_payout(uuid,numeric,text,text,timestamptz,uuid,uuid)', 'EXECUTE'),
  'authenticated role can call the current commission payout function'
);

select ok(
  not has_table_privilege('authenticated', 'public.commission_payouts', 'INSERT'),
  'authenticated role no longer has direct commission payout insert privilege'
);

select ok(
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
      and policyname = 'products_select_policy'
      and qual like '%get_auth_tenant_id%'
  ),
  'products select policy is tenant-scoped'
);

select ok(
  not exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_movements'
      and cmd = 'INSERT'
  ),
  'product movements have no direct insert policy: writes only through the RPC contract'
);

select ok(
  position('is_active' in pg_get_functiondef('private.get_auth_role()'::regprocedure)) > 0,
  'auth role helper filters inactive users'
);

select ok(
  position('is_active' in pg_get_functiondef('private.get_auth_tenant_id()'::regprocedure)) > 0,
  'auth tenant helper filters inactive users'
);

select ok(
  position('is_active' in pg_get_functiondef('private.is_saas_admin()'::regprocedure)) > 0,
  'saas admin helper filters inactive users'
);

-- Contexto sintetico: nenhuma dependencia de linhas preexistentes do DEV.
create temp table _financeiro_estoque_ctx (
  tenant_id uuid not null,
  active_user_id uuid not null,
  inactive_user_id uuid not null,
  product_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__financeiro_estoque_baseline__ tenant', '__financeiro_estoque_baseline__@teste.com', '11999999999')
  returning id
), active_auth as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__financeiro_estoque_baseline__ativo_auth@teste.com')
  returning id
), inactive_auth as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__financeiro_estoque_baseline__inativo_auth@teste.com')
  returning id
), product as (
  insert into public.products (
    tenant_id, name, product_type, unit_type, price, cost_price, stock_quantity, min_stock_alert, is_active
  )
  select t.id, '__financeiro_estoque_baseline__' || t.id::text, 'retail', 'un', 0, 0, 0, 0, true
  from t
  returning id
)
insert into _financeiro_estoque_ctx (tenant_id, active_user_id, inactive_user_id, product_id)
select t.id, active_auth.id, inactive_auth.id, product.id
from t, active_auth, inactive_auth, product;

update public.users
set tenant_id = (select tenant_id from _financeiro_estoque_ctx), role = 'gerente', is_active = true
where id = (select active_user_id from _financeiro_estoque_ctx);

update public.users
set tenant_id = (select tenant_id from _financeiro_estoque_ctx), role = 'gerente', is_active = false
where id = (select inactive_user_id from _financeiro_estoque_ctx);

grant select on _financeiro_estoque_ctx to authenticated;

create temp table _financeiro_estoque_behavior (check_name text, observed text) on commit drop;
grant insert, select on _financeiro_estoque_behavior to authenticated;

select set_config('request.jwt.claim.sub', (select active_user_id::text from _financeiro_estoque_ctx), true);
set local role authenticated;

do $$
declare
  v_product uuid := (select product_id from _financeiro_estoque_ctx);
  v_error text;
  v_stock numeric;
  v_movements bigint;
begin
  begin
    perform public.adjust_product_stock(v_product, 'entry_manual', 1, null, 'baseline', null);
    insert into _financeiro_estoque_behavior values ('detailed_type_call', 'accepted');
  exception when others then
    get stacked diagnostics v_error = message_text;
    insert into _financeiro_estoque_behavior values ('detailed_type_call', v_error);
  end;
  select stock_quantity, (select count(*) from public.product_movements where product_id = v_product)
    into v_stock, v_movements
  from public.products
  where id = v_product;
  insert into _financeiro_estoque_behavior values ('post_call_stock', coalesce(v_stock::text, 'null'));
  insert into _financeiro_estoque_behavior values ('post_call_movements', v_movements::text);
end $$;

select is(
  (select observed from _financeiro_estoque_behavior where check_name = 'detailed_type_call'),
  'accepted',
  'current stock function accepts the detailed entry type'
);

select is(
  (select observed from _financeiro_estoque_behavior where check_name = 'post_call_stock'),
  '1',
  'accepted stock adjustment increases product balance'
);

select is(
  (select observed from _financeiro_estoque_behavior where check_name = 'post_call_movements'),
  '1',
  'accepted stock adjustment records movement history'
);

select is(
  (select count(*) from public.products where name like '__financeiro_estoque_baseline__%'),
  1::bigint,
  'active tenant user sees only products from own tenant'
);

reset role;
select set_config('request.jwt.claim.sub', (select inactive_user_id::text from _financeiro_estoque_ctx), true);
set local role authenticated;

select is(
  (select count(*) from public.products where name like '__financeiro_estoque_baseline__%'),
  0::bigint,
  'inactive tenant user no longer sees own products'
);

reset role;

select * from finish(true);
rollback;
