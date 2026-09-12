begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create temporary table ticket23_context (
  gerente_id uuid not null,
  barbeiro_id uuid not null,
  tenant_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  product_id uuid not null,
  comanda_id uuid not null,
  comanda_item_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket23_ctx__', '__ticket23_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket23_ctx__auth@teste.com')
  returning id
), au2 as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket23_ctx__auth2@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket23', '11988880023', 30, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Corte Ticket23', 50, 'corte', true
  from t
  returning id, tenant_id
), prod as (
  insert into public.products (tenant_id, name, price, cost_price, stock_quantity, product_type)
  select t.id, 'Produto Ticket23', 10, 4, 5, 'retail'
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket23_context (
  gerente_id, barbeiro_id, tenant_id, professional_id, service_id, product_id, comanda_id, comanda_item_id
)
select au.id, au2.id, t.id, prof.id, svc.id, prod.id, gen_random_uuid(), gen_random_uuid()
from t, au, au2, prof, svc, prod, cs;

update public.users
set tenant_id = (select tenant_id from ticket23_context), role = 'gerente', is_active = true
where id = (select gerente_id from ticket23_context);

update public.users
set tenant_id = (select tenant_id from ticket23_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_id from ticket23_context);

grant select on ticket23_context to authenticated;

-- adjust_product_stock (funcao exposta a aplicacao) recusa o tipo de estorno interno.
select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket23_context), true);
set local role authenticated;
select throws_ok(
  $$select public.adjust_product_stock((select product_id from ticket23_context), 'entry_reversal', 1, null, null, null)$$,
  'P0001',
  'Tipo de movimentação inválido: entry_reversal',
  'ajuste de estoque exposto a aplicacao recusa o tipo de estorno interno'
);

reset role;

-- Fecha uma comanda com item de servico para gerar a obrigacao de comissao com rotulo de origem.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, tenant_id, 'aberta', 50, 0, 0
from ticket23_context;

insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price,
  snapshot_status, snapshot_commission_amount, snapshot_commission_rule
)
select comanda_item_id, comanda_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50,
  'confirmed', 15, 'professional_service'
from ticket23_context;

insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount)
select comanda_id, tenant_id, 'pix', 50, 0
from ticket23_context;

update public.comandas
set status = 'fechada', closed_at = timezone('utc'::text, now())
where id = (select comanda_id from ticket23_context);

select is(
  (select origin_item_label from public.commission_obligations where comanda_item_id = (select comanda_item_id from ticket23_context)),
  'Corte Ticket23',
  'obrigacao de comissao grava o rotulo de origem do item no momento da criacao'
);

-- Simula o refaturamento: o item antigo e substituido/excluido.
delete from public.comanda_itens where id = (select comanda_item_id from ticket23_context);

select is(
  (select comanda_item_id from public.commission_obligations where origin_item_label = 'Corte Ticket23'),
  null,
  'vinculo referencial e desfeito quando o item e excluido (comportamento esperado do ON DELETE SET NULL)'
);
select is(
  (select origin_item_label from public.commission_obligations where comanda_id = (select comanda_id from ticket23_context)),
  'Corte Ticket23',
  'rotulo de origem sobrevive a exclusao do item por nao ter vinculo referencial'
);

-- Leitura dos estornos de pagamento de comanda por papel financeiro.
insert into public.comanda_payment_reversals (
  tenant_id, comanda_id, original_payment_id, payment_method, amount, change_amount, paid_at, reversed_by, reason
)
select tenant_id, comanda_id, gen_random_uuid(), 'pix', 50, 0, timezone('utc'::text, now()), gerente_id, 'Teste ticket23'
from ticket23_context;

select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket23_context), true);
set local role authenticated;
select is(
  (select count(*) from public.comanda_payment_reversals where comanda_id = (select comanda_id from ticket23_context)),
  1::bigint,
  'gerente le os estornos de pagamento da propria unidade'
);

reset role;
select set_config('request.jwt.claim.sub', (select barbeiro_id::text from ticket23_context), true);
set local role authenticated;
select is(
  (select count(*) from public.comanda_payment_reversals where comanda_id = (select comanda_id from ticket23_context)),
  0::bigint,
  'barbeiro nao enxerga estornos de pagamento (RLS bloqueia, nao papel invalido)'
);

reset role;
select has_index('public', 'comanda_payment_reversals', 'comanda_payment_reversals_tenant_comanda_idx', 'indice por unidade e comanda existe');

select ok(
  (select true from pg_constraint where conrelid='public.product_movements'::regclass and conname='product_movements_movement_type_check'
    and pg_get_constraintdef(oid) like '%entry_reversal%'),
  'tipo de estorno de estoque foi acrescentado ao conjunto de tipos aceitos'
);

select has_column('public', 'product_movements', 'reverses_movement_id', 'coluna de vinculo ao movimento original existe');
select has_column('public', 'commission_obligations', 'origin_item_label', 'coluna de rotulo de origem sem vinculo referencial existe');

select is(
  (select count(*) from pg_constraint where conrelid = 'public.commission_obligations'::regclass and contype = 'f' and confrelid = 'public.comanda_itens'::regclass and conkey = array[(
    select attnum from pg_attribute where attrelid = 'public.commission_obligations'::regclass and attname = 'origin_item_label'
  )]),
  0::bigint,
  'origin_item_label nao possui vinculo referencial (foreign key) com comanda_itens'
);

select * from finish(true);
rollback;
