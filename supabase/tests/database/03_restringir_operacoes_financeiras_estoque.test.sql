begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

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
select ok(
  not has_table_privilege('authenticated', 'public.product_movements', 'INSERT'),
  'authenticated cannot insert product movement history directly'
);
select ok(
  has_table_privilege('authenticated', 'public.cash_movements', 'INSERT'),
  'authenticated retains cash movement insertion used by the active cash flow'
);
select ok(
  not has_table_privilege('authenticated', 'public.commission_payouts', 'INSERT'),
  'authenticated cannot insert commission payouts directly'
);
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_movements'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  ),
  'product movement history has no direct write policies'
);

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
create temporary table ticket03_ctx (tenant_id uuid not null, user_id uuid not null) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket03_ctx__', '__ticket03_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket03_ctx__auth@teste.com')
  returning id
)
insert into ticket03_ctx (tenant_id, user_id)
select t.id, au.id from t, au;

update public.users
set tenant_id = (select tenant_id from ticket03_ctx), role = 'gerente', is_active = true
where id = (select user_id from ticket03_ctx);

grant select on ticket03_ctx to authenticated;

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
select tenant_id, '__ticket03_auth__', 'retail', 'un', 20, 10, 0, 2, true
from ticket03_ctx;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket03_ctx), true);
set local role authenticated;

select is(
  (select count(*) from public.products where name = '__ticket03_auth__'),
  1::bigint,
  'active manager sees own tenant product'
);

reset role;
update public.users
set is_active = false
where id = (select user_id from ticket03_ctx);
set local role authenticated;

select is(
  (select count(*) from public.products where name = '__ticket03_auth__'),
  0::bigint,
  'inactive manager cannot read tenant product'
);
select throws_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket03_auth__'), 'entry_manual', 1, null, null, null)$$,
  'P0001',
  'Acesso negado: apenas gerentes e proprietários podem movimentar estoque.',
  'inactive manager cannot adjust stock'
);

reset role;
select is(
  (select stock_quantity from public.products where name = '__ticket03_auth__'),
  0,
  'blocked inactive stock operation has no effect'
);

select * from finish(true);
rollback;
