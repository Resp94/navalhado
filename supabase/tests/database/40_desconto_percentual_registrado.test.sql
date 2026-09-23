begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

create temporary table ticket40_03_context (
  user_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  service_id uuid not null,
  comanda_percent_id uuid not null,
  comanda_invalido_id uuid not null,
  comanda_negativo_id uuid not null,
  comanda_reais_id uuid not null,
  comanda_cortesia_id uuid not null,
  operation_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket40_03_ctx__', '__ticket40_03_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket40_03_ctx__auth@teste.com')
  returning id
), svc as (
  insert into public.services (tenant_id, name, price, price_type, category, is_active)
  select t.id, 'Corte T40-03', 10.10, 'fixed', 'corte', true from t returning id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open' from t, au returning id
)
insert into ticket40_03_context
select au.id, t.id, cs.id, svc.id,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid()
from t, au, cs, svc;

update public.users
set tenant_id = (select tenant_id from ticket40_03_context), role = 'gerente', is_active = true
where id = (select user_id from ticket40_03_context);

grant select on ticket40_03_context to authenticated;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select c, tenant_id, 'aberta', 0, 0, 0
from ticket40_03_context,
  unnest(array[
    comanda_percent_id, comanda_invalido_id, comanda_negativo_id,
    comanda_reais_id, comanda_cortesia_id
  ]) as c;

select has_column('public', 'comandas', 'discount_type', 'comanda guarda o tipo do desconto');
select has_column('public', 'comandas', 'discount_percent', 'comanda guarda o percentual original do desconto');

select set_config('request.jwt.claim.sub', (select user_id::text from ticket40_03_context), true);
set local role authenticated;

-- 3 x 10,10 = 30,30; 15% = 4,545 -> 4,55; total 25,75. O valor em reais enviado (999) e ignorado.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_percent_id from ticket40_03_context),
    (select tenant_id from ticket40_03_context),
    null, null, 999, 0,
    (select cash_session_id from ticket40_03_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_03_context),'quantity',3,'unit_price',10.10)),
    '[{"payment_method":"pix","amount":25.75}]'::jsonb,
    null,
    15
  )$$,
  'liquida com desconto percentual'
);
select is(
  (select discount_type from public.comandas where id = (select comanda_percent_id from ticket40_03_context)),
  'percent',
  'grava o tipo percent'
);
select is(
  (select discount_percent from public.comandas where id = (select comanda_percent_id from ticket40_03_context)),
  15::numeric,
  'grava o percentual original'
);
select is(
  (select discount_amount from public.comandas where id = (select comanda_percent_id from ticket40_03_context)),
  4.55::numeric,
  'o banco converte o percentual em reais a centavo e ignora o valor enviado'
);
select is(
  (select total_amount from public.comandas where id = (select comanda_percent_id from ticket40_03_context)),
  25.75::numeric,
  'total gravado bate com subtotal menos desconto percentual'
);

-- Percentual fora de 0 a 100 e recusado e nao fecha a comanda.
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_invalido_id from ticket40_03_context),
    (select tenant_id from ticket40_03_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_03_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_03_context),'quantity',1,'unit_price',10.10)),
    '[{"payment_method":"pix","amount":10.10}]'::jsonb,
    null,
    100.01
  )$$,
  'P0001',
  'Percentual de desconto inválido.',
  'recusa percentual acima de 100'
);
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_negativo_id from ticket40_03_context),
    (select tenant_id from ticket40_03_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_03_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_03_context),'quantity',1,'unit_price',10.10)),
    '[{"payment_method":"pix","amount":10.10}]'::jsonb,
    null,
    -1
  )$$,
  'P0001',
  'Percentual de desconto inválido.',
  'recusa percentual negativo'
);
select is(
  (select status from public.comandas where id = (select comanda_invalido_id from ticket40_03_context)),
  'aberta',
  'recusa por percentual invalido nao fecha a comanda'
);

-- Desconto em reais continua funcionando e grava tipo amount sem percentual.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_reais_id from ticket40_03_context),
    (select tenant_id from ticket40_03_context),
    null, null, 3, 0,
    (select cash_session_id from ticket40_03_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_03_context),'quantity',1,'unit_price',10.10)),
    '[{"payment_method":"pix","amount":7.10}]'::jsonb
  )$$,
  'liquida com desconto em reais sem informar percentual'
);
select is(
  (select discount_type || '/' || coalesce(discount_percent::text, 'nulo') from public.comandas where id = (select comanda_reais_id from ticket40_03_context)),
  'amount/nulo',
  'desconto em reais grava tipo amount e percentual nulo'
);

-- 100% e cortesia: total zero e sem forma de pagamento.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_cortesia_id from ticket40_03_context),
    (select tenant_id from ticket40_03_context),
    null, null, 0, 0,
    null,
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_03_context),'quantity',1,'unit_price',10.10)),
    '[]'::jsonb,
    null,
    100
  )$$,
  'desconto de 100% fecha como cortesia'
);

-- O wrapper idempotente repassa o percentual.
select is(
  (select (public.settle_comanda_idempotent(
    (select operation_id from ticket40_03_context),
    null,
    (select tenant_id from ticket40_03_context),
    null, null, 0, 0,
    (select cash_session_id from ticket40_03_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_03_context),'quantity',1,'unit_price',10.10)),
    '[{"payment_method":"pix","amount":9.09}]'::jsonb,
    null,
    10
  ))->>'discount_percent'),
  '10',
  'settle_comanda_idempotent repassa o percentual e devolve na comanda'
);

select * from finish(true);
rollback;
