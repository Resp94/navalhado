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

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket06_ctx__', '__ticket06_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket06_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket06', '11988880006', 30, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Ticket06', 30, 'corte', true
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket06_context (
  user_id, tenant_id, product_id, comanda_id, appointment_id, appointment_comanda_id
)
select au.id, t.id, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from t, au, prof, svc, cs;

update public.users
set tenant_id = (select tenant_id from ticket06_context), role = 'gerente', is_active = true
where id = (select user_id from ticket06_context);

-- Fixture: um agendamento ja concluido e pago, com comanda fechada e sem itens de produto.
insert into public.appointments (
  id, tenant_id, customer_id, professional_id, service_id,
  start_time, end_time, status, payment_status
)
select
  appointment_id, tenant_id, null,
  (select id from public.professionals where tenant_id = ticket06_context.tenant_id limit 1),
  (select id from public.services where tenant_id = ticket06_context.tenant_id limit 1),
  (((case when extract(dow from current_date + 1) = 0 then current_date + 2 else current_date + 1 end) + time '10:00') at time zone 'America/Sao_Paulo'),
  (((case when extract(dow from current_date + 1) = 0 then current_date + 2 else current_date + 1 end) + time '10:30') at time zone 'America/Sao_Paulo'),
  'confirmed', 'pending'
from ticket06_context;

update public.appointments
set status = 'completed', payment_status = 'paid'
where id = (select appointment_id from ticket06_context);

update ticket06_context
set appointment_comanda_id = (
  select c.id from public.comandas c
  where c.appointment_id = ticket06_context.appointment_id
  limit 1
);

-- A comanda auto-criada pelo agendamento ja tem o item de servico; paga-la
-- integralmente antes de fecha-la para nao acionar o trigger de consistencia.
insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount)
select ticket06_context.appointment_comanda_id, ticket06_context.tenant_id, 'pix', c.total_amount, 0
from ticket06_context
join public.comandas c on c.id = ticket06_context.appointment_comanda_id;

update public.comandas
set status = 'fechada', closed_at = timezone('utc'::text, now())
where id = (select appointment_comanda_id from ticket06_context);

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
select comanda_id, tenant_id, 'aberta', 20, 0, 0
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

-- A comanda so transita para fechada apos os pagamentos ja persistidos,
-- para nao acionar o trigger de consistencia entre total e soma dos pagamentos.
update public.comandas
set status = 'fechada', closed_at = timezone('utc'::text, now())
where id = (select comanda_id from ticket06_context);

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
select * from finish(true);
rollback;
