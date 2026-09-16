begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
create temporary table ticket02_ctx (tenant_id uuid not null, user_id uuid not null) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket02_ctx__', '__ticket02_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket02_ctx__auth@teste.com')
  returning id
)
insert into ticket02_ctx (tenant_id, user_id)
select t.id, au.id from t, au;

update public.users
set tenant_id = (select tenant_id from ticket02_ctx), role = 'gerente', is_active = true
where id = (select user_id from ticket02_ctx);

grant select on ticket02_ctx to authenticated;

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
  tenant_id,
  '__ticket02_stock__',
  'retail',
  'un',
  20,
  10,
  10,
  2,
  true
from ticket02_ctx;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket02_ctx), true);
set local role authenticated;

select lives_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'entry_manual', 5, 12.5, 'entrada manual', null)$$,
  'accepts manual stock entry'
);
select is(
  (select stock_quantity from public.products where name = '__ticket02_stock__'),
  15,
  'manual entry increases stock'
);

select lives_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'entry_purchase', 3, 11, 'entrada de compra', null)$$,
  'accepts purchase stock entry'
);
select lives_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'exit_manual', 4, null, 'saída manual', null)$$,
  'accepts manual stock exit'
);
select lives_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'exit_sale_comanda', 2, null, 'saída de venda', null)$$,
  'accepts comanda sale stock exit'
);
select lives_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'exit_internal_use', 1, null, 'uso interno', null)$$,
  'accepts internal-use stock exit'
);
select lives_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'adjustment', 7, null, 'ajuste de inventário', null)$$,
  'accepts target stock adjustment'
);

select is(
  (select stock_quantity from public.products where name = '__ticket02_stock__'),
  7,
  'all valid movements produce the expected final stock'
);
select is(
  (select count(*) from public.product_movements pm join public.products p on p.id = pm.product_id where p.name = '__ticket02_stock__'),
  6::bigint,
  'all valid movements create one history row each'
);
select is(
  (select bool_and(quantity > 0) from public.product_movements pm join public.products p on p.id = pm.product_id where p.name = '__ticket02_stock__'),
  true,
  'all persisted movement quantities remain positive'
);
select is(
  (select string_agg(quantity::text, ',' order by pm.created_at) from public.product_movements pm join public.products p on p.id = pm.product_id where p.name = '__ticket02_stock__'),
  '5,3,4,2,1,4',
  'history stores absolute quantities for each movement'
);

select throws_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'unknown', 1, null, null, null)$$,
  'P0001',
  'Tipo de movimentação inválido: unknown',
  'rejects unknown movement type'
);
select throws_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'exit_manual', 100, null, null, null)$$,
  'P0001',
  'Estoque insuficiente para a saída solicitada.',
  'rejects insufficient stock'
);
select throws_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'entry_manual', 0, null, null, null)$$,
  'P0001',
  'Quantidade de entrada deve ser maior que zero.',
  'rejects zero quantity'
);
select throws_ok(
  $$select public.adjust_product_stock((select id from public.products where name = '__ticket02_stock__'), 'adjustment', -1, null, null, null)$$,
  'P0001',
  'Ajuste de estoque não pode ser negativo.',
  'rejects negative adjustment'
);
select is(
  (select stock_quantity from public.products where name = '__ticket02_stock__'),
  7,
  'invalid movements do not change stock'
);
select is(
  (select count(*) from public.product_movements pm join public.products p on p.id = pm.product_id where p.name = '__ticket02_stock__'),
  6::bigint,
  'invalid movements do not create partial history'
);

reset role;
select * from finish(true);
rollback;
