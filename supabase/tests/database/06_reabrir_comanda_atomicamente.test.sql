begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create temporary table ticket06_context (
  user_id uuid not null,
  tenant_id uuid not null,
  product_id uuid not null,
  comanda_id uuid not null,
  appointment_id uuid not null,
  appointment_comanda_id uuid not null
) on commit drop;

insert into ticket06_context (
  user_id, tenant_id, product_id, comanda_id, appointment_id, appointment_comanda_id
)
select
  u.id,
  u.tenant_id,
  gen_random_uuid(),
  gen_random_uuid(),
  fixture.appointment_id,
  fixture.comanda_id
from public.users u
join public.cash_sessions cs
  on cs.tenant_id = u.tenant_id
 and cs.status = 'open'
cross join lateral (
  select a.id as appointment_id, c.id as comanda_id
  from public.appointments a
  join public.comandas c on c.appointment_id = a.id
  where a.tenant_id = u.tenant_id
    and a.status = 'completed'
    and a.payment_status = 'paid'
    and c.status = 'fechada'
    and not exists (
      select 1
      from public.comanda_itens ci
      where ci.comanda_id = c.id
        and ci.item_type = 'produto'
    )
  order by a.updated_at desc
  limit 1
) fixture
where u.is_active
  and u.role = 'gerente'
order by u.id
limit 1;
grant select on ticket06_context to authenticated;

select ok((select count(*) from ticket06_context) = 1, 'encontra gerente e comanda fechada elegível');
select has_function(
  'public',
  'reopen_comanda',
  array['uuid', 'uuid'],
  'RPC transacional de reabertura existe'
);

reset role;
insert into public.products (id, tenant_id, name, price, cost_price, stock_quantity, product_type)
select product_id, tenant_id, 'Ticket 06 Produto', 10, 4, 1, 'retail'
from ticket06_context;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, tenant_id, 'fechada', 20, 0, 0
from ticket06_context;

insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, product_id, quantity, unit_price, total_price
)
select comanda_id, tenant_id, 'produto', product_id, 2, 10, 20
from ticket06_context;

insert into public.comanda_pagamentos (
  comanda_id, tenant_id, payment_method, amount, change_amount
)
select comanda_id, tenant_id, 'pix', 20, 0
from ticket06_context;

insert into public.product_movements (
  tenant_id, product_id, movement_type, quantity, unit_cost, reason, comanda_id
)
select tenant_id, product_id, 'exit_sale_comanda', 2, 4, 'Venda da comanda', comanda_id
from ticket06_context;

insert into public.product_movements (
  tenant_id, product_id, movement_type, quantity, unit_cost, reason
)
select tenant_id, product_id, 'exit_manual', 1, 4, 'Movimento independente posterior'
from ticket06_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket06_context), true);
set local role authenticated;

select lives_ok(
  $$select public.reopen_comanda(
    (select comanda_id from ticket06_context),
    (select tenant_id from ticket06_context)
  )$$,
  'reabre comanda e reverte pagamentos, estoque e efeitos vinculados'
);
select is(
  (select status from public.comandas where id = (select comanda_id from ticket06_context)),
  'aberta',
  'comanda volta a ficar aberta'
);
select is(
  (select stock_quantity from public.products where id = (select product_id from ticket06_context)),
  3,
  'restaura somente a baixa vinculada e preserva movimento independente'
);
select is(
  (select count(*) from public.comanda_pagamentos where comanda_id = (select comanda_id from ticket06_context)),
  0::bigint,
  'remove os pagamentos conforme o comportamento atual'
);
select is(
  (select count(*) from public.product_movements where comanda_id = (select comanda_id from ticket06_context) and movement_type = 'exit_sale_comanda'),
  1::bigint,
  'preserva o movimento original da venda'
);
select is(
  (select count(*) from public.product_movements where comanda_id = (select comanda_id from ticket06_context) and movement_type = 'entry_manual'),
  1::bigint,
  'registra um movimento de estorno rastreável'
);
select is(
  (select quantity from public.product_movements where comanda_id = (select comanda_id from ticket06_context) and movement_type = 'entry_manual' limit 1),
  2,
  'estorna a quantidade exata da baixa original'
);

select throws_ok(
  $$select public.reopen_comanda(
    (select comanda_id from ticket06_context),
    (select tenant_id from ticket06_context)
  )$$,
  'P0001',
  'A comanda não está fechada ou não existe.',
  'rejeita segunda reabertura sem duplicar estorno'
);
select is(
  (select count(*) from public.product_movements where comanda_id = (select comanda_id from ticket06_context) and movement_type = 'entry_manual'),
  1::bigint,
  'segunda reabertura não duplica estorno'
);

reset role;
insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, product_id, quantity, unit_price, total_price
)
select appointment_comanda_id, tenant_id, 'produto', product_id, 1, 10, 10
from ticket06_context;
set local role authenticated;
select throws_ok(
  $$select public.reopen_comanda(
    (select appointment_comanda_id from ticket06_context),
    (select tenant_id from ticket06_context)
  )$$,
  'P0001',
  'Os movimentos de estoque da comanda não são compatíveis com o estorno.',
  'bloqueia estorno quando falta o movimento original'
);
select is(
  (select status from public.comandas where id = (select appointment_comanda_id from ticket06_context)),
  'fechada',
  'falha de estorno preserva a comanda fechada'
);
select is(
  (select stock_quantity from public.products where id = (select product_id from ticket06_context)),
  3,
  'falha de estorno não altera estoque'
);

reset role;
delete from public.comanda_itens
where comanda_id = (select appointment_comanda_id from ticket06_context)
  and product_id = (select product_id from ticket06_context);
set local role authenticated;
select lives_ok(
  $$select public.reopen_comanda(
    (select appointment_comanda_id from ticket06_context),
    (select tenant_id from ticket06_context)
  )$$,
  'reabre comanda vinculada ao agendamento'
);
select is(
  (select status from public.appointments where id = (select appointment_id from ticket06_context)),
  'confirmed',
  'retorna o agendamento para confirmado'
);
select is(
  (select payment_status from public.appointments where id = (select appointment_id from ticket06_context)),
  'pending',
  'retorna o pagamento do agendamento para pendente'
);
select is(
  (select status from public.comandas where id = (select appointment_comanda_id from ticket06_context)),
  'aberta',
  'abre também a comanda do agendamento'
);

reset role;
select * from finish();
rollback;
