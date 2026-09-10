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
  position('p_movement_type = ''entry''' in pg_get_functiondef('public.adjust_product_stock(uuid,text,integer,numeric,text,uuid)'::regprocedure)) > 0,
  'stock adjustment function still exposes the legacy entry contract'
);

select ok(
  position('p_movement_type = ''exit''' in pg_get_functiondef('public.adjust_product_stock(uuid,text,integer,numeric,text,uuid)'::regprocedure)) > 0,
  'stock adjustment function still exposes the legacy exit contract'
);

select ok(
  position('p_movement_type = ''sale''' in pg_get_functiondef('public.adjust_product_stock(uuid,text,integer,numeric,text,uuid)'::regprocedure)) > 0,
  'stock adjustment function still exposes the legacy sale contract'
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
  has_function_privilege('authenticated', 'public.register_commission_payout(uuid,numeric,text,text,timestamptz,uuid)', 'EXECUTE'),
  'authenticated role can call the current commission payout function'
);

select ok(
  has_table_privilege('authenticated', 'public.commission_payouts', 'INSERT'),
  'authenticated role currently has direct commission payout insert privilege'
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
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_movements'
      and policyname = 'product_movements_insert_policy'
      and with_check like '%users.tenant_id%'
  ),
  'product movement insert policy is tenant-scoped'
);

select ok(
  position('is_active' in pg_get_functiondef('private.get_auth_role()'::regprocedure)) = 0,
  'baseline records that auth role helper does not yet filter active users'
);

select ok(
  position('is_active' in pg_get_functiondef('private.get_auth_tenant_id()'::regprocedure)) = 0,
  'baseline records that auth tenant helper does not yet filter active users'
);

select ok(
  position('is_active' in pg_get_functiondef('private.is_saas_admin()'::regprocedure)) = 0,
  'baseline records that SaaS admin helper does not yet filter active users'
);

insert into public.products (
  tenant_id,
  name,
  product_type,
  unit_type,
  price,
  cost_price,
  stock_quantity,
  min_stock_alert,
  is_active
)
select
  t.id,
  '__financeiro_estoque_baseline__' || t.id::text,
  'retail',
  'un',
  0,
  0,
  0,
  0,
  true
from public.tenants t
where t.id in (
  select u.tenant_id
  from public.users u
  where u.tenant_id is not null
    and u.is_active
  order by u.id
  limit 2
);

select set_config(
  'request.jwt.claim.sub',
  (select u.id::text from public.users u where u.tenant_id is not null and u.is_active order by u.id limit 1),
  true
);
set local role authenticated;

select is(
  (select count(*) from public.products where name like '__financeiro_estoque_baseline__%'),
  1::bigint,
  'active tenant user sees only products from own tenant'
);

reset role;
update public.users
set is_active = false
where id = (
  select u.id
  from public.users u
  where u.tenant_id is not null
    and u.is_active
  order by u.id
  limit 1
);
set local role authenticated;

select is(
  (select count(*) from public.products where name like '__financeiro_estoque_baseline__%'),
  1::bigint,
  'baseline records that inactive tenant user still sees own products'
);

reset role;

select * from finish();
rollback;
