begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Spec 052, ticket 14: exportar dados. A exportacao e feita pelo front, com a sessao do proprio Gerente: le os clientes, os
-- agendamentos e as comandas (e os nomes de profissionais, servicos e produtos, e os itens e pagamentos das comandas). Nada de
-- novo no banco; este teste prova a premissa da spec: o bloqueio do painel e so no front, entao o Gerente de uma barbearia
-- BLOQUEADA continua lendo todos os dados da barbearia dele (e so os dele), pelas mesmas politicas de leitura por tenant: com o
-- motivo do bloqueio que for (os sete da tela de bloqueio), com a invariante conferida nas politicas (nenhuma olha a assinatura) e
-- com os indices da leitura por chave no lugar. Tambem prova que a barbearia bloqueada deixa o rastro da exportacao na trilha de
-- auditoria (public.log_audit_event), que e como o front registra quem exportou os dados.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('76000000-0000-0000-0000-000000000001', 'T76 Bloqueada', 't76-bloqueada@test.local', '92999997601', 't76-bloqueada', true),
  ('76000000-0000-0000-0000-000000000002', 'T76 Outra', 't76-outra@test.local', '92999997602', 't76-outra', true);

delete from public.tenant_subscriptions where tenant_id::text like '76000000-0000-0000-0000-0000000000%';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason, current_period_end)
values
  ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '3 days', 'trial_expired', null),
  ('76000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, null, now() + interval '20 days');

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values
  ('76000000-0000-0000-0000-000000000011', '76000000-0000-0000-0000-000000000001', 'Corte T76 A', 40, 60, 'Cabelo', true, 1),
  ('76000000-0000-0000-0000-000000000012', '76000000-0000-0000-0000-000000000002', 'Corte T76 B', 40, 60, 'Cabelo', true, 1);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active)
values
  ('76000000-0000-0000-0000-000000000021', '76000000-0000-0000-0000-000000000001', 'Profissional T76 A', '92999997603', 0, true),
  ('76000000-0000-0000-0000-000000000022', '76000000-0000-0000-0000-000000000002', 'Profissional T76 B', '92999997604', 0, true);

insert into public.products(id, tenant_id, name, price)
values
  ('76000000-0000-0000-0000-000000000051', '76000000-0000-0000-0000-000000000001', 'Pomada T76 A', 30),
  ('76000000-0000-0000-0000-000000000052', '76000000-0000-0000-0000-000000000002', 'Pomada T76 B', 30);

insert into public.customers(id, tenant_id, name, phone, cadastro_completo, registration_origin)
values
  ('76000000-0000-0000-0000-000000000031', '76000000-0000-0000-0000-000000000001', 'Cliente T76 A1', '92999997605', true, 'balcao'),
  ('76000000-0000-0000-0000-000000000032', '76000000-0000-0000-0000-000000000001', 'Cliente T76 A2', '92999997606', true, 'agenda'),
  ('76000000-0000-0000-0000-000000000033', '76000000-0000-0000-0000-000000000002', 'Cliente T76 B1', '92999997607', true, 'balcao');

insert into public.appointments(id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
values
  ('76000000-0000-0000-0000-000000000041', '76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000031',
   '76000000-0000-0000-0000-000000000021', '76000000-0000-0000-0000-000000000011', '2040-01-02 13:00:00+00', '2040-01-02 14:00:00+00', 'completed', 'paid', 'manual'),
  ('76000000-0000-0000-0000-000000000042', '76000000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000032',
   '76000000-0000-0000-0000-000000000021', '76000000-0000-0000-0000-000000000011', '2040-01-03 13:00:00+00', '2040-01-03 14:00:00+00', 'confirmed', 'pending', 'online'),
  ('76000000-0000-0000-0000-000000000043', '76000000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000033',
   '76000000-0000-0000-0000-000000000022', '76000000-0000-0000-0000-000000000012', '2040-01-02 15:00:00+00', '2040-01-02 16:00:00+00', 'confirmed', 'pending', 'manual');

-- O banco ja cria uma comanda aberta para o agendamento (indice unico de comanda aberta por agendamento): a que nao existir, o teste
-- cria, e os itens e o pagamento vao na comanda de cada agendamento.
insert into public.comandas(tenant_id, appointment_id, customer_id, status, total_amount)
select a.tenant_id, a.id, a.customer_id, 'fechada', 40
from public.appointments a
where a.id in ('76000000-0000-0000-0000-000000000041', '76000000-0000-0000-0000-000000000043')
  and not exists (select 1 from public.comandas c where c.appointment_id = a.id);

insert into public.comanda_itens(comanda_id, tenant_id, item_type, service_id, quantity, unit_price, total_price)
select c.id, c.tenant_id, 'servico', a.service_id, 1, 40, 40
from public.comandas c
join public.appointments a on a.id = c.appointment_id
where a.id in ('76000000-0000-0000-0000-000000000041', '76000000-0000-0000-0000-000000000043');

insert into public.comanda_pagamentos(comanda_id, tenant_id, payment_method, amount)
select c.id, c.tenant_id, 'pix', 40
from public.comandas c
where c.appointment_id = '76000000-0000-0000-0000-000000000041';

-- Gerente da barbearia bloqueada, e um Gerente sem barbearia (public.users.tenant_id nulo).
insert into auth.users(id, email)
values
  ('76000000-0000-0000-0000-0000000000a1', 't76-gerente@test.local'),
  ('76000000-0000-0000-0000-0000000000a2', 't76-gerente-sem-tenant@test.local');
update public.users
set tenant_id = '76000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true
where id = '76000000-0000-0000-0000-0000000000a1';
update public.users
set tenant_id = null, role = 'gerente', is_active = true
where id = '76000000-0000-0000-0000-0000000000a2';

-- A premissa: a barbearia esta bloqueada de verdade pelo Estado de Acesso.
select is(
  (select e.access from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked',
  'a barbearia do teste esta bloqueada'
);

-- O que o banco guarda da barbearia bloqueada (lido sem a RLS), para conferir que o Gerente le tudo: nem mais, nem menos.
select set_config('t76.comandas', (select count(*)::text from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'), true);
select set_config('t76.itens', (select count(*)::text from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'), true);
select set_config('t76.pagamentos', (select count(*)::text from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'), true);
-- Soma das linhas das oito tabelas da barbearia: o que o Gerente tem de ler, qualquer que seja o motivo do bloqueio.
select set_config('t76.total', (
  select count(*)::text from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) todo
), true);

-- O Gerente bloqueado le tudo o que a exportacao precisa, so da barbearia dele ------------------------------------------------
select set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select is((select count(*)::int from public.customers where tenant_id::text like '76000000-0000-0000-0000-0000000000%'), 2, 'le os clientes da barbearia');
select is((select count(*)::int from public.appointments where tenant_id::text like '76000000-0000-0000-0000-0000000000%'), 2, 'le os agendamentos da barbearia');
select ok(
  current_setting('t76.comandas')::int > 0
    and (select count(*)::int from public.comandas where tenant_id::text like '76000000-0000-0000-0000-0000000000%') = current_setting('t76.comandas')::int,
  'le todas as comandas da barbearia'
);
select ok(
  current_setting('t76.itens')::int > 0
    and (select count(*)::int from public.comanda_itens where tenant_id::text like '76000000-0000-0000-0000-0000000000%') = current_setting('t76.itens')::int,
  'le todos os itens das comandas'
);
select ok(
  current_setting('t76.pagamentos')::int > 0
    and (select count(*)::int from public.comanda_pagamentos where tenant_id::text like '76000000-0000-0000-0000-0000000000%') = current_setting('t76.pagamentos')::int,
  'le todos os pagamentos das comandas'
);
select is((select count(*)::int from public.professionals where tenant_id::text like '76000000-0000-0000-0000-0000000000%'), 1, 'le os profissionais (os nomes do arquivo)');
select is((select count(*)::int from public.services where tenant_id::text like '76000000-0000-0000-0000-0000000000%'), 1, 'le os servicos (os nomes do arquivo)');
select is((select count(*)::int from public.products where tenant_id::text like '76000000-0000-0000-0000-0000000000%'), 1, 'le os produtos (os nomes do arquivo)');

select is(
  (select count(*)::int
   from (
     select tenant_id from public.customers
     union all select tenant_id from public.appointments
     union all select tenant_id from public.comandas
     union all select tenant_id from public.comanda_itens
     union all select tenant_id from public.comanda_pagamentos
     union all select tenant_id from public.professionals
     union all select tenant_id from public.services
     union all select tenant_id from public.products
   ) lido
   where lido.tenant_id = '76000000-0000-0000-0000-000000000002'),
  0,
  'e nada de outra barbearia'
);
reset role;

-- Gerente sem barbearia (tenant_id nulo): nao le nada de ninguem (a politica nao e uma comparacao que o NULL contornaria).
select set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select is(
  (select count(*)::int
   from (
     select tenant_id from public.customers
     union all select tenant_id from public.appointments
     union all select tenant_id from public.comandas
   ) lido
   where lido.tenant_id::text like '76000000-0000-0000-0000-0000000000%'),
  0,
  'o Gerente sem barbearia (tenant_id nulo) nao le nenhum dado das barbearias'
);
reset role;


-- A invariante: nenhuma politica de leitura das oito tabelas olha a assinatura ou o Estado de Acesso -------------------------------
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public'
     and tablename in ('customers', 'appointments', 'comandas', 'comanda_itens', 'comanda_pagamentos', 'professionals', 'services', 'products')
     and cmd in ('SELECT', 'ALL')),
  8,
  'cada uma das oito tabelas tem a sua politica de leitura (8 de SELECT entre as 29 politicas das tabelas)'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public'
     and tablename in ('customers', 'appointments', 'comandas', 'comanda_itens', 'comanda_pagamentos', 'professionals', 'services', 'products')
     and cmd in ('SELECT', 'ALL')
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'tenant_access_state|subscription_access_state|tenant_subscriptions|blocked_reason|access_state'),
  0,
  'nenhuma politica de leitura das oito tabelas olha a assinatura nem o Estado de Acesso'
);

-- Os indices da leitura por chave (a exportacao le por `id > ultimo id`, em ordem de `id`, dentro de uma barbearia) ---------------
select is(
  (select count(*)::int from pg_indexes
   where schemaname = 'public'
     and indexname in ('idx_customers_tenant_id_id', 'idx_appointments_tenant_id_id', 'idx_comandas_tenant_id_id', 'idx_comanda_itens_tenant_id_id', 'idx_comanda_pagamentos_tenant_id_id')
     and indexdef ~ '\(tenant_id, id\)$'),
  5,
  'as cinco tabelas grandes tem o indice (tenant_id, id) da leitura por chave'
);

-- O Gerente bloqueado le tudo, com cada motivo de bloqueio que a tela de bloqueio conhece -----------------------------------------
select set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-0000000000a1', true);

-- Com o teste vencido (status trialing) ------------------------------------------------------------------------------------------------------------
delete from public.tenant_subscriptions where tenant_id = '76000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at) values ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() - interval '1 day');
select is(
  (select e.access || '/' || e.reason from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked/trial_expired',
  'a barbearia esta bloqueada: o teste vencido (status trialing)'
);
set local role authenticated;
select is(
  (select count(*)::int from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) lido),
  current_setting('t76.total')::int,
  'com o teste vencido (status trialing) o Gerente le tudo o que a exportacao precisa'
);
reset role;

-- Com o pagamento recusado ha 6 dias ------------------------------------------------------------------------------------------------------------
delete from public.tenant_subscriptions where tenant_id = '76000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, first_failed_at, current_period_end) values ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', now() - interval '6 days', now() - interval '6 days');
select is(
  (select e.access || '/' || e.reason from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked/payment_failed',
  'a barbearia esta bloqueada: o pagamento recusado ha 6 dias'
);
set local role authenticated;
select is(
  (select count(*)::int from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) lido),
  current_setting('t76.total')::int,
  'com o pagamento recusado ha 6 dias o Gerente le tudo o que a exportacao precisa'
);
reset role;

-- Com a assinatura cancelada com o periodo pago ja vencido ------------------------------------------------------------------------------------------------------------
delete from public.tenant_subscriptions where tenant_id = '76000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, canceled_at, current_period_end) values ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', now() - interval '10 days', now() - interval '5 days');
select is(
  (select e.access || '/' || e.reason from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked/canceled',
  'a barbearia esta bloqueada: a assinatura cancelada com o periodo pago ja vencido'
);
set local role authenticated;
select is(
  (select count(*)::int from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) lido),
  current_setting('t76.total')::int,
  'com a assinatura cancelada com o periodo pago ja vencido o Gerente le tudo o que a exportacao precisa'
);
reset role;

-- Com a cortesia vencida ------------------------------------------------------------------------------------------------------------
delete from public.tenant_subscriptions where tenant_id = '76000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, courtesy_ends_at) values ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'courtesy', now() - interval '1 day');
select is(
  (select e.access || '/' || e.reason from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked/courtesy_expired',
  'a barbearia esta bloqueada: a cortesia vencida'
);
set local role authenticated;
select is(
  (select count(*)::int from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) lido),
  current_setting('t76.total')::int,
  'com a cortesia vencida o Gerente le tudo o que a exportacao precisa'
);
reset role;

-- Com o pagamento estornado ------------------------------------------------------------------------------------------------------------
delete from public.tenant_subscriptions where tenant_id = '76000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason) values ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '1 day', 'refunded');
select is(
  (select e.access || '/' || e.reason from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked/refunded',
  'a barbearia esta bloqueada: o pagamento estornado'
);
set local role authenticated;
select is(
  (select count(*)::int from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) lido),
  current_setting('t76.total')::int,
  'com o pagamento estornado o Gerente le tudo o que a exportacao precisa'
);
reset role;

-- Com o pagamento contestado (chargeback) ------------------------------------------------------------------------------------------------------------
delete from public.tenant_subscriptions where tenant_id = '76000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason) values ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '1 day', 'charged_back');
select is(
  (select e.access || '/' || e.reason from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked/charged_back',
  'a barbearia esta bloqueada: o pagamento contestado (chargeback)'
);
set local role authenticated;
select is(
  (select count(*)::int from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) lido),
  current_setting('t76.total')::int,
  'com o pagamento contestado (chargeback) o Gerente le tudo o que a exportacao precisa'
);
reset role;

-- Com o bloqueio manual do Proprietario (sem motivo) ------------------------------------------------------------------------------------------------------------
delete from public.tenant_subscriptions where tenant_id = '76000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at) values ('76000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '1 day');
select is(
  (select e.access || '/' || e.reason from private.tenant_access_state('76000000-0000-0000-0000-000000000001') e),
  'blocked/blocked',
  'a barbearia esta bloqueada: o bloqueio manual do Proprietario (sem motivo)'
);
set local role authenticated;
select is(
  (select count(*)::int from (
    select 1 from public.customers where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.appointments where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comandas where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_itens where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.comanda_pagamentos where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.professionals where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.services where tenant_id = '76000000-0000-0000-0000-000000000001'
    union all select 1 from public.products where tenant_id = '76000000-0000-0000-0000-000000000001'
  ) lido),
  current_setting('t76.total')::int,
  'com o bloqueio manual do Proprietario (sem motivo) o Gerente le tudo o que a exportacao precisa'
);
reset role;

-- A barbearia bloqueada deixa o rastro da exportacao na trilha de auditoria ----------------------------------------------------
-- O front chama public.log_audit_event depois de montar os arquivos: a funcao guarda a barbearia e o usuario DA SESSAO (ninguem
-- registra em nome de outra barbearia) e nao olha a assinatura.
set local role authenticated;
select ok(
  public.log_audit_event('tenant_data_exported', 'tenant', '{"arquivos": 3, "linhas": {"clientes": 2, "agendamentos": 2, "comandas": 1}}'::jsonb) is not null,
  'o Gerente da barbearia bloqueada registra a exportacao na trilha de auditoria'
);
reset role;
select is(
  (select count(*)::int from public.audit_logs
   where tenant_id = '76000000-0000-0000-0000-000000000001'
     and user_id = '76000000-0000-0000-0000-0000000000a1'
     and action = 'tenant_data_exported'
     and resource = 'tenant'
     and details->>'arquivos' = '3'
     and details->'linhas'->>'clientes' = '2'),
  1,
  'a trilha guarda a barbearia e o usuario da sessao e o que saiu, sem nenhum dado de cliente'
);

select * from finish();
rollback;
