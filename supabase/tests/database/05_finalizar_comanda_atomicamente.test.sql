begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

create temporary table ticket05_context (
  user_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  product_id uuid not null,
  comanda_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null,
  invalid_comanda_id uuid,
  appointment_id uuid,
  appointment_comanda_id uuid
) on commit drop;

insert into ticket05_context (
  user_id, tenant_id, cash_session_id, product_id, comanda_id, service_id, professional_id
)
select
  u.id,
  u.tenant_id,
  cs.id,
  gen_random_uuid(),
  gen_random_uuid(),
  service.id,
  professional.id
from public.users u
join public.cash_sessions cs
  on cs.tenant_id = u.tenant_id
 and cs.status = 'open'
cross join lateral (
  select s.id
  from public.services s
  where s.tenant_id = u.tenant_id
    and coalesce(s.is_active, true) = true
    and s.deleted_at is null
  order by s.id
  limit 1
) service
cross join lateral (
  select p.id
  from public.professionals p
  where p.tenant_id = u.tenant_id
    and coalesce(p.is_active, true) = true
  order by p.id
  limit 1
) professional
where u.is_active
  and u.role = 'gerente'
order by u.id
limit 1;
grant select on ticket05_context to authenticated;

select ok((select count(*) from ticket05_context) = 1, 'encontra gerente ativo com sessão aberta');
select has_function(
  'public',
  'settle_comanda',
  array['uuid', 'uuid', 'uuid', 'uuid', 'numeric', 'numeric', 'uuid', 'jsonb', 'jsonb'],
  'RPC transacional de finalização existe'
);

reset role;
insert into public.products (id, tenant_id, name, price, cost_price, stock_quantity, product_type)
select product_id, tenant_id, 'Ticket 05 Produto', 10, 4, 5, 'retail'
from ticket05_context;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, tenant_id, 'aberta', 20, 0, 0
from ticket05_context;

insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, product_id, quantity, unit_price, total_price
)
select comanda_id, tenant_id, 'produto', product_id, 2, 10, 20
from ticket05_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket05_context), true);
set local role authenticated;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_id from ticket05_context),
    (select tenant_id from ticket05_context),
    null,
    null,
    0,
    0,
    (select cash_session_id from ticket05_context),
    jsonb_build_array(jsonb_build_object('item_type','produto','product_id',(select product_id from ticket05_context),'quantity',2,'unit_price',10)),
    '[{"payment_method":"pix","amount":20}]'::jsonb
  )$$,
  'fecha comanda com pagamento e baixa de estoque em uma operação'
);
select is(
  (select status from public.comandas where id = (select comanda_id from ticket05_context)),
  'fechada',
  'comanda é fechada'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select comanda_id from ticket05_context)),
  1::bigint,
  'registra um pagamento'
);
select is(
  (select sum(amount) from public.comanda_pagamentos where comanda_id = (select comanda_id from ticket05_context)),
  20::numeric,
  'mantém o valor total pago'
);
select is(
  (select stock_quantity from public.products where id = (select product_id from ticket05_context)),
  3,
  'baixa o estoque uma única vez'
);
select is(
  (select count(*) from public.product_movements where comanda_id = (select comanda_id from ticket05_context)),
  1::bigint,
  'cria um movimento vinculado à comanda'
);
select is(
  (select movement_type from public.product_movements where comanda_id = (select comanda_id from ticket05_context) limit 1),
  'exit_sale_comanda',
  'classifica a baixa como venda em comanda'
);

select throws_ok(
  $$select public.settle_comanda(
    (select comanda_id from ticket05_context),
    (select tenant_id from ticket05_context),
    null, null, 0, 0,
    (select cash_session_id from ticket05_context),
    '[]'::jsonb,
    '[{"payment_method":"pix","amount":20}]'::jsonb
  )$$,
  'P0001',
  'A comanda não está aberta ou não existe.',
  'rejeita segunda finalização sem duplicar efeitos'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select comanda_id from ticket05_context)),
  1::bigint,
  'repetição não duplica pagamento'
);

reset role;
update ticket05_context
set appointment_id = gen_random_uuid(),
    invalid_comanda_id = gen_random_uuid();
insert into public.appointments (
  id, tenant_id, customer_id, professional_id, service_id,
  start_time, end_time, status, payment_status
)
select
  appointment_id,
  tenant_id,
  null,
  professional_id,
  service_id,
  timezone('utc'::text, now()) + interval '1 day',
  timezone('utc'::text, now()) + interval '1 day 30 minutes',
  'confirmed',
  'pending'
from ticket05_context;
update ticket05_context
set appointment_comanda_id = (
  select c.id
  from public.comandas c
  where c.appointment_id = ticket05_context.appointment_id
  limit 1
);
set local role authenticated;

select is(
  (select count(*) from public.comandas where id = (select appointment_comanda_id from ticket05_context)),
  1::bigint,
  'cria comanda vinculada ao agendamento de teste'
);
select lives_ok(
  $$select public.settle_comanda(
    (select appointment_comanda_id from ticket05_context),
    (select tenant_id from ticket05_context),
    (select appointment_id from ticket05_context),
    null,
    0,
    0,
    (select cash_session_id from ticket05_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket05_context),'quantity',1,'unit_price',30)),
    '[{"payment_method":"pix","amount":15},{"payment_method":"cash","amount":15,"received_cash":20}]'::jsonb
  )$$,
  'fecha comanda vinculada com pagamentos divididos'
);
select is(
  (select status from public.appointments where id = (select appointment_id from ticket05_context)),
  'completed',
  'atualiza o agendamento junto com o fechamento'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select appointment_comanda_id from ticket05_context)),
  2::bigint,
  'registra cada parcela do pagamento dividido'
);
select is(
  (select sum(amount) from public.comanda_pagamentos where comanda_id = (select appointment_comanda_id from ticket05_context)),
  30::numeric,
  'mantém a soma dos pagamentos divididos'
);
select is(
  (select count(*) from public.product_movements where comanda_id = (select appointment_comanda_id from ticket05_context)),
  0::bigint,
  'serviço sem produto não cria movimento de estoque'
);

reset role;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select invalid_comanda_id, tenant_id, 'aberta', 20, 0, 0
from ticket05_context;
update ticket05_context
set appointment_comanda_id = invalid_comanda_id;
insert into public.comanda_itens (comanda_id, tenant_id, item_type, product_id, quantity, unit_price, total_price)
select appointment_comanda_id, tenant_id, 'produto', product_id, 2, 10, 20
from ticket05_context;
set local role authenticated;

select throws_ok(
  $$select public.settle_comanda(
    (select invalid_comanda_id from ticket05_context),
    (select tenant_id from ticket05_context),
    null, null, 0, 0,
    (select cash_session_id from ticket05_context),
    jsonb_build_array(jsonb_build_object('item_type','produto','product_id',(select product_id from ticket05_context),'quantity',2,'unit_price',10)),
    '[{"payment_method":"pix","amount":19}]'::jsonb
  )$$,
  'P0001',
  'A soma dos pagamentos deve ser igual ao total da comanda.',
  'rejeita soma de pagamentos inválida'
);
select is(
  (select status from public.comandas where id = (select invalid_comanda_id from ticket05_context)),
  'aberta',
  'pagamento inválido não fecha a comanda'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select invalid_comanda_id from ticket05_context)),
  0::bigint,
  'pagamento inválido não persiste pagamento'
);

reset role;
update public.products
set stock_quantity = 1
where id = (select product_id from ticket05_context);
set local role authenticated;
select throws_ok(
  $$select public.settle_comanda(
    (select invalid_comanda_id from ticket05_context),
    (select tenant_id from ticket05_context),
    null, null, 0, 0,
    (select cash_session_id from ticket05_context),
    jsonb_build_array(jsonb_build_object('item_type','produto','product_id',(select product_id from ticket05_context),'quantity',2,'unit_price',10)),
    '[{"payment_method":"pix","amount":20}]'::jsonb
  )$$,
  'P0001',
  'Estoque insuficiente para o produto.',
  'rejeita estoque insuficiente'
);
select is(
  (select stock_quantity from public.products where id = (select product_id from ticket05_context)),
  1,
  'estoque insuficiente não altera saldo'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select invalid_comanda_id from ticket05_context)),
  0::bigint,
  'estoque insuficiente não persiste pagamento'
);

reset role;
select * from finish();
rollback;
