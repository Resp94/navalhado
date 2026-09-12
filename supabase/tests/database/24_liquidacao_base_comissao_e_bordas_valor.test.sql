begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temporary table ticket24_context (
  user_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null,
  comanda_a_id uuid not null,
  comanda_cortesia_id uuid not null,
  comanda_cortesia_pagto_id uuid not null,
  comanda_desconto_excesso_id uuid not null,
  comanda_dinheiro_insuficiente_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket24_ctx__', '__ticket24_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket24_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket24', '11988880024', 20, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Corte Ticket24', 100, 'corte', true
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket24_context (
  user_id, tenant_id, cash_session_id, service_id, professional_id,
  comanda_a_id, comanda_cortesia_id, comanda_cortesia_pagto_id,
  comanda_desconto_excesso_id, comanda_dinheiro_insuficiente_id
)
select au.id, t.id, cs.id, svc.id, prof.id,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid()
from t, au, prof, svc, cs;

update public.users
set tenant_id = (select tenant_id from ticket24_context), role = 'gerente', is_active = true
where id = (select user_id from ticket24_context);

grant select on ticket24_context to authenticated;

select has_column('public', 'comanda_itens', 'snapshot_commission_base', 'snapshot do item grava a base usada no calculo da comissao');
select ok(
  (select true from pg_constraint where conrelid='public.comanda_itens'::regclass and conname='comanda_itens_snapshot_commission_base_check'),
  'constraint de valores aceitos para a base de comissao existe'
);

select set_config('request.jwt.claim.sub', (select user_id::text from ticket24_context), true);
set local role authenticated;

-- Item com comissao e desconto: a base gravada deve ser o valor bruto, antes do rateio de desconto.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_a_id, tenant_id, 'aberta', 0, 0, 0
from ticket24_context;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_a_id from ticket24_context),
    (select tenant_id from ticket24_context),
    null, null,
    20, 0,
    (select cash_session_id from ticket24_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket24_context),'professional_id',(select professional_id from ticket24_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":80}]'::jsonb
  )$$,
  'liquida comanda com desconto e comissao'
);
select is(
  (select snapshot_commission_base from public.comanda_itens where comanda_id = (select comanda_a_id from ticket24_context) limit 1),
  'gross_amount',
  'grava a base de comissao como valor bruto do item'
);
select is(
  (select snapshot_commission_amount from public.comanda_itens where comanda_id = (select comanda_a_id from ticket24_context) limit 1),
  20::numeric,
  'comissao calculada sobre o bruto (100 * 20%), nao sobre o liquido pos-desconto'
);

-- Comanda de cortesia: desconto integral, total zero, sem forma de pagamento.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_cortesia_id, tenant_id, 'aberta', 0, 0, 0
from ticket24_context;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_cortesia_id from ticket24_context),
    (select tenant_id from ticket24_context),
    null, null,
    100, 0,
    null,
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket24_context),'quantity',1,'unit_price',100)),
    '[]'::jsonb
  )$$,
  'liquida comanda de cortesia com desconto integral e sem pagamento'
);
select is(
  (select status from public.comandas where id = (select comanda_cortesia_id from ticket24_context)),
  'fechada',
  'comanda de cortesia e fechada normalmente'
);
select is(
  (select total_amount from public.comandas where id = (select comanda_cortesia_id from ticket24_context)),
  0::numeric,
  'total da cortesia e zero'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select comanda_cortesia_id from ticket24_context)),
  0::bigint,
  'cortesia nao gera nenhum pagamento'
);

-- Cortesia com forma de pagamento informada por engano deve ser recusada.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_cortesia_pagto_id, tenant_id, 'aberta', 0, 0, 0
from ticket24_context;
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_cortesia_pagto_id from ticket24_context),
    (select tenant_id from ticket24_context),
    null, null,
    100, 0,
    (select cash_session_id from ticket24_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket24_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":0.01}]'::jsonb
  )$$,
  'P0001',
  'Comanda de cortesia com total zero não deve informar forma de pagamento.',
  'recusa forma de pagamento em cortesia de total zero'
);

-- Desconto maior que o subtotal continua recusado (protege contra total negativo).
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_desconto_excesso_id, tenant_id, 'aberta', 0, 0, 0
from ticket24_context;
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_desconto_excesso_id from ticket24_context),
    (select tenant_id from ticket24_context),
    null, null,
    150, 0,
    null,
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket24_context),'quantity',1,'unit_price',100)),
    '[]'::jsonb
  )$$,
  'P0001',
  'Desconto ou gorjeta inválidos.',
  'recusa desconto maior que o subtotal (o que geraria total negativo)'
);

-- Recebimento em dinheiro menor que o valor do pagamento e recusado.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_dinheiro_insuficiente_id, tenant_id, 'aberta', 0, 0, 0
from ticket24_context;
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_dinheiro_insuficiente_id from ticket24_context),
    (select tenant_id from ticket24_context),
    null, null,
    0, 0,
    (select cash_session_id from ticket24_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket24_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"cash","amount":100,"received_cash":80}]'::jsonb
  )$$,
  'P0001',
  'Pagamento de comanda inválido.',
  'recusa recebimento em dinheiro menor que o valor do pagamento'
);
select is(
  (select status from public.comandas where id = (select comanda_dinheiro_insuficiente_id from ticket24_context)),
  'aberta',
  'recebimento insuficiente nao fecha a comanda'
);

select * from finish(true);
rollback;
