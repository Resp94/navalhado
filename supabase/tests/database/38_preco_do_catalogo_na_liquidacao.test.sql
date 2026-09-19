begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create temporary table ticket40_01_context (
  user_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  service_fixed_id uuid not null,
  service_starting_id uuid not null,
  product_id uuid not null,
  comanda_fixed_id uuid not null,
  comanda_produto_id uuid not null,
  comanda_abaixo_id uuid not null,
  comanda_acima_id uuid not null,
  comanda_igual_id uuid not null,
  professional_id uuid not null,
  service_inativo_id uuid not null,
  service_outro_id uuid not null,
  comanda_rateio_id uuid not null,
  comanda_mudou_id uuid not null,
  comanda_inativo_id uuid not null,
  comanda_outro_id uuid not null,
  comanda_replay_id uuid not null,
  operation_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket40_01_ctx__', '__ticket40_01_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket40_01_ctx__auth@teste.com')
  returning id
), svc_fixed as (
  insert into public.services (tenant_id, name, price, price_type, category, is_active)
  select t.id, 'Corte Fixo T40', 100, 'fixed', 'corte', true
  from t
  returning id
), svc_starting as (
  insert into public.services (tenant_id, name, price, price_type, category, is_active)
  select t.id, 'Quimica T40', 80, 'starting_at', 'quimica', true
  from t
  returning id
), prod as (
  insert into public.products (tenant_id, name, price, cost_price, stock_quantity, product_type)
  select t.id, 'Pomada T40', 50, 20, 10, 'retail'
  from t
  returning id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open'
  from t, au
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Prof T40-01', '11988880051', 10, true from t returning id
), svc_inativo as (
  insert into public.services (tenant_id, name, price, price_type, category, is_active)
  select t.id, 'Inativo T40', 100, 'fixed', 'corte', false from t returning id
), t2 as (
  insert into public.tenants (name, email, phone)
  values ('__ticket40_01_outro__', '__ticket40_01_outro__@teste.com', '11999999997')
  returning id
), svc_outro as (
  insert into public.services (tenant_id, name, price, price_type, category, is_active)
  select t2.id, 'Outro Tenant T40', 100, 'fixed', 'corte', true from t2 returning id
)
insert into ticket40_01_context
select au.id, t.id, cs.id, svc_fixed.id, svc_starting.id, prod.id,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  prof.id, svc_inativo.id, svc_outro.id,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid()
from t, au, svc_fixed, svc_starting, prod, cs, prof, svc_inativo, svc_outro;

update public.users
set tenant_id = (select tenant_id from ticket40_01_context), role = 'gerente', is_active = true
where id = (select user_id from ticket40_01_context);

grant select on ticket40_01_context to authenticated;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select c, tenant_id, 'aberta', 0, 0, 0
from ticket40_01_context,
  unnest(array[comanda_fixed_id, comanda_produto_id, comanda_abaixo_id, comanda_acima_id, comanda_igual_id, comanda_rateio_id, comanda_mudou_id, comanda_inativo_id, comanda_outro_id, comanda_replay_id]) as c;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket40_01_context), true);
set local role authenticated;

-- Servico fixo com preco adulterado (1) grava o preco do catalogo (100).
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_fixed_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_fixed_id from ticket40_01_context),'quantity',1,'unit_price',1)),
    '[{"payment_method":"pix","amount":100}]'::jsonb
  )$$,
  'servico fixo com preco adulterado fecha pelo preco do catalogo'
);
select is(
  (select unit_price from public.comanda_itens where comanda_id = (select comanda_fixed_id from ticket40_01_context)),
  100::numeric,
  'servico fixo grava o preco do catalogo, nao o enviado'
);
select is(
  (select total_amount from public.comandas where id = (select comanda_fixed_id from ticket40_01_context)),
  100::numeric,
  'total da comanda usa o preco do catalogo'
);

-- Produto com preco adulterado (5) grava o preco do catalogo (50 x 2).
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_produto_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','produto','product_id',(select product_id from ticket40_01_context),'quantity',2,'unit_price',5)),
    '[{"payment_method":"pix","amount":100}]'::jsonb
  )$$,
  'produto com preco adulterado fecha pelo preco do catalogo'
);
select is(
  (select unit_price from public.comanda_itens where comanda_id = (select comanda_produto_id from ticket40_01_context)),
  50::numeric,
  'produto grava o preco do catalogo'
);

-- Servico "a partir de" abaixo do minimo cadastrado (80) e recusado.
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_abaixo_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_starting_id from ticket40_01_context),'quantity',1,'unit_price',79.99)),
    '[{"payment_method":"pix","amount":79.99}]'::jsonb
  )$$,
  'P0001',
  'O valor do serviço não pode ser menor que o preço mínimo cadastrado.',
  'servico a partir de abaixo do minimo e recusado'
);
select is(
  (select status from public.comandas where id = (select comanda_abaixo_id from ticket40_01_context)),
  'aberta',
  'recusa por valor abaixo do minimo nao fecha a comanda'
);

-- Servico "a partir de" acima do minimo e aceito pelo valor informado.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_acima_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_starting_id from ticket40_01_context),'quantity',1,'unit_price',120)),
    '[{"payment_method":"pix","amount":120}]'::jsonb
  )$$,
  'servico a partir de acima do minimo fecha'
);
select is(
  (select unit_price from public.comanda_itens where comanda_id = (select comanda_acima_id from ticket40_01_context)),
  120::numeric,
  'servico a partir de grava o valor informado'
);

-- Servico "a partir de" exatamente no minimo e aceito.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_igual_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_starting_id from ticket40_01_context),'quantity',1,'unit_price',80)),
    '[{"payment_method":"pix","amount":80}]'::jsonb
  )$$,
  'servico a partir de exatamente no minimo fecha'
);

-- Desconto rateado usa o preco efetivo: bruto do item fixo continua 100.
select is(
  (select snapshot_gross_amount from public.comanda_itens where comanda_id = (select comanda_fixed_id from ticket40_01_context)),
  100::numeric,
  'snapshot bruto do item usa o preco efetivo do catalogo'
);

-- Desconto rateado, snapshot liquido e comissao usam o preco efetivo (100), nao o enviado (1).
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_rateio_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 10, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_fixed_id from ticket40_01_context),'professional_id',(select professional_id from ticket40_01_context),'quantity',1,'unit_price',1)),
    '[{"payment_method":"pix","amount":90}]'::jsonb
  )$$,
  'liquida com desconto sobre o preco efetivo do catalogo'
);
select is(
  (select snapshot_discount_amount from public.comanda_itens where comanda_id = (select comanda_rateio_id from ticket40_01_context)),
  10::numeric,
  'desconto rateado sobre o preco efetivo'
);
select is(
  (select snapshot_net_amount from public.comanda_itens where comanda_id = (select comanda_rateio_id from ticket40_01_context)),
  90::numeric,
  'snapshot liquido = preco efetivo menos desconto'
);
select is(
  (select snapshot_commission_amount from public.comanda_itens where comanda_id = (select comanda_rateio_id from ticket40_01_context)),
  10::numeric,
  'comissao calculada sobre o preco efetivo (100 * 10%)'
);

-- Tela com preco desatualizado: mensagem explica a causa, nao so a soma dos pagamentos.
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_mudou_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_fixed_id from ticket40_01_context),'quantity',1,'unit_price',60)),
    '[{"payment_method":"pix","amount":60}]'::jsonb
  )$$,
  'P0001',
  'Os preços do catálogo mudaram desde que a comanda foi aberta. Recarregue os preços e tente novamente.',
  'preco desatualizado na tela recebe mensagem propria'
);

-- Servico inativo e servico de outra unidade sao recusados.
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_inativo_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_inativo_id from ticket40_01_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":100}]'::jsonb
  )$$,
  'P0001',
  'Serviço não encontrado ou inativo.',
  'servico inativo e recusado'
);
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_outro_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_outro_id from ticket40_01_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":100}]'::jsonb
  )$$,
  'P0001',
  'Serviço não encontrado ou inativo.',
  'servico de outra unidade e recusado'
);

-- Replay idempotente com a assinatura nova: mesma operacao devolve o resultado gravado, sem segundo pagamento.
select lives_ok(
  $$select public.settle_comanda_idempotent(
    (select operation_id from ticket40_01_context),
    (select comanda_replay_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_fixed_id from ticket40_01_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":100}]'::jsonb
  )$$,
  'primeira chamada idempotente liquida'
);
select lives_ok(
  $$select public.settle_comanda_idempotent(
    (select operation_id from ticket40_01_context),
    (select comanda_replay_id from ticket40_01_context),
    (select tenant_id from ticket40_01_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_01_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_fixed_id from ticket40_01_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":100}]'::jsonb
  )$$,
  'replay da mesma operacao nao falha'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select comanda_replay_id from ticket40_01_context)),
  1::bigint,
  'replay nao duplica o pagamento'
);

select * from finish(true);
rollback;
