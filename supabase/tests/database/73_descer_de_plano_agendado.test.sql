begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Spec 052, ticket 11: descer de plano agendado. Na assinatura ativa o plano menor vale so na proxima
-- cobranca, sem reembolso, e so se os profissionais ativos couberem nele: schedule_plan_downgrade grava
-- o plano agendado (scheduled_plan_id), cancel_plan_downgrade o desfaz. Com a descida agendada o limite
-- do plano menor ja vale para novos cadastros e reativacoes (o gatilho do ticket 02), e a proxima
-- mensalidade aprovada aplica o plano agendado (apply_subscription_payment). Em teste descer troca na
-- hora (apply_plan_change, ticket 10). So o service_role executa as funcoes novas.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('73000000-0000-0000-0000-000000000001', 'T73 A', 't73-a@test.local', '92999997301', 't73-a', true),
  ('73000000-0000-0000-0000-000000000002', 'T73 B', 't73-b@test.local', '92999997302', 't73-b', true),
  ('73000000-0000-0000-0000-000000000003', 'T73 C', 't73-c@test.local', '92999997303', 't73-c', true),
  ('73000000-0000-0000-0000-000000000004', 'T73 D', 't73-d@test.local', '92999997304', 't73-d', true),
  ('73000000-0000-0000-0000-000000000005', 'T73 E', 't73-e@test.local', '92999997305', 't73-e', true),
  ('73000000-0000-0000-0000-000000000006', 'T73 F', 't73-f@test.local', '92999997306', 't73-f', true),
  ('73000000-0000-0000-0000-000000000007', 'T73 G', 't73-g@test.local', '92999997307', 't73-g', true),
  ('73000000-0000-0000-0000-000000000008', 'T73 H', 't73-h@test.local', '92999997308', 't73-h', true),
  ('73000000-0000-0000-0000-000000000009', 'T73 I', 't73-i@test.local', '92999997309', 't73-i', true),
  ('73000000-0000-0000-0000-00000000000a', 'T73 Z', 't73-z@test.local', '92999997310', 't73-z', true);

-- A: ativa, Maquina, 1 profissional ativo e 1 excluido. B: ativa, Bancada, 3 profissionais. C: em teste, Maquina.
-- D: ativa, Tesoura. E: pagamento recusado (past_due), Maquina. F: ativa, Maquina, com a Tesoura agendada, para a
-- mensalidade recusada e depois aprovada. G: bloqueada, Maquina. H: ativa, Maquina, com a Tesoura agendada, para a
-- mensalidade aprovada na data. I: ativa, Maquina, com a Tesoura agendada, para a cobranca que nao e mensalidade.
-- Z: sem assinatura. O gatilho de cadastro pode ter criado assinaturas; as de teste mandam.
delete from public.tenant_subscriptions where tenant_id::text like '73000000-0000-0000-0000-0000000000%';

insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, card_brand, card_last4, mp_subscription_id, scheduled_plan_id, first_failed_at)
values
  ('73000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-a', null, null),
  ('73000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-b', null, null),
  ('73000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-d', null, null),
  ('73000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-e', null, '2040-06-01 12:00:00+00'),
  ('73000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-f', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', null),
  ('73000000-0000-0000-0000-000000000007', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-g', null, null),
  ('73000000-0000-0000-0000-000000000008', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-h', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', null),
  ('73000000-0000-0000-0000-000000000009', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-73-i', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', null);
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at)
values ('73000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-05-20 12:00:00+00');

insert into public.professionals(tenant_id, name, phone, commission_percentage)
values
  ('73000000-0000-0000-0000-000000000001', 'T73 A1', '11988807301', 10),
  ('73000000-0000-0000-0000-000000000002', 'T73 B1', '11988807302', 10),
  ('73000000-0000-0000-0000-000000000002', 'T73 B2', '11988807303', 10),
  ('73000000-0000-0000-0000-000000000002', 'T73 B3', '11988807304', 10),
  ('73000000-0000-0000-0000-000000000003', 'T73 C1', '11988807305', 10),
  ('73000000-0000-0000-0000-000000000004', 'T73 D1', '11988807306', 10),
  ('73000000-0000-0000-0000-000000000005', 'T73 E1', '11988807307', 10),
  ('73000000-0000-0000-0000-000000000006', 'T73 F1', '11988807308', 10),
  ('73000000-0000-0000-0000-000000000007', 'T73 G1', '11988807309', 10),
  ('73000000-0000-0000-0000-000000000008', 'T73 H1', '11988807310', 10),
  ('73000000-0000-0000-0000-000000000009', 'T73 I1', '11988807311', 10);
insert into public.professionals(tenant_id, name, phone, commission_percentage, deleted_at)
values ('73000000-0000-0000-0000-000000000001', 'T73 A2', '11988807312', 10, now());

-- Contexto da troca: a descida ja agendada ----------------------------------------------------
select is(
  (select c.scheduled_plan_id::text from public.get_plan_change_context('73000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22') c),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11',
  'o contexto traz o plano da descida agendada'
);

select is(
  (select coalesce(c.scheduled_plan_id::text, 'sem descida agendada')
   from public.get_plan_change_context('73000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11') c),
  'sem descida agendada',
  'sem descida agendada o contexto traz nulo'
);

-- Agendar a descida (assinatura ativa) ----------------------------------------------------------
select is(
  public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'),
  'scheduled',
  'na assinatura ativa a descida para um plano menor, que comporta os profissionais, e agendada'
);

select is(
  (select s.plan_id || '|' || s.scheduled_plan_id || '|' || s.status || '|' || s.current_period_start::text || '|' || s.current_period_end::text || '|' || s.card_brand || '|' || s.card_last4 || '|' || s.mp_subscription_id
   from public.tenant_subscriptions s where s.tenant_id = '73000000-0000-0000-0000-000000000001'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22|b3fa7384-d113-4a1b-a5ed-1efeb7e51c11|active|2040-05-01 12:00:00+00|2040-06-01 12:00:00+00|visa|5682|mp-73-a',
  'agendar nao troca o plano agora nem mexe na situacao, no periodo pago, no cartao ou na assinatura do Mercado Pago'
);

select throws_ok(
  $$insert into public.professionals(tenant_id, name, phone, commission_percentage)
    values ('73000000-0000-0000-0000-000000000001', 'T73 A3', '11988807313', 10)$$,
  '53400', 'PROFESSIONAL_LIMIT_REACHED',
  'com a descida agendada o limite do plano menor ja vale para um novo cadastro (a Maquina aceitaria 5)'
);

select throws_ok(
  $$update public.professionals set deleted_at = null where tenant_id = '73000000-0000-0000-0000-000000000001' and name = 'T73 A2'$$,
  '53400', 'PROFESSIONAL_LIMIT_REACHED',
  'e para reativar um profissional excluido'
);

select is(
  public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'),
  'unchanged',
  'agendar de novo o mesmo plano nao muda nada (clique repetido)'
);

-- Desfazer -----------------------------------------------------------------------------------
select is(
  public.cancel_plan_downgrade('73000000-0000-0000-0000-000000000001'),
  'canceled',
  'o Gerente desfaz a descida agendada antes da data'
);

select is(
  (select coalesce(s.scheduled_plan_id::text, 'sem descida agendada') || '|' || s.plan_id
   from public.tenant_subscriptions s where s.tenant_id = '73000000-0000-0000-0000-000000000001'),
  'sem descida agendada|b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
  'desfeita, o plano agendado some e o plano atual continua'
);

select lives_ok(
  $$insert into public.professionals(tenant_id, name, phone, commission_percentage)
    values ('73000000-0000-0000-0000-000000000001', 'T73 A3', '11988807313', 10)$$,
  'desfeita a descida, o limite da Maquina volta a valer para novos cadastros'
);

select is(
  public.cancel_plan_downgrade('73000000-0000-0000-0000-000000000001'),
  'none',
  'desfazer quando nao ha descida agendada nao muda nada'
);

-- Profissionais que nao cabem no plano menor --------------------------------------------------
select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')$$,
  '53400', 'PLAN_BELOW_ACTIVE_PROFESSIONALS',
  'com 3 profissionais ativos nao se agenda a descida para a Tesoura (aceita 1)'
);

select is(
  (select coalesce(s.scheduled_plan_id::text, 'sem descida agendada') from public.tenant_subscriptions s where s.tenant_id = '73000000-0000-0000-0000-000000000002'),
  'sem descida agendada',
  'a recusa nao agenda nada'
);

select is(
  public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'),
  'scheduled',
  'os 3 profissionais cabem na Maquina (aceita 5): a descida da Bancada para a Maquina e agendada'
);

-- Recusas de estado e de plano ---------------------------------------------------------------
select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22')$$,
  '22023', null,
  'um plano mais caro nao e descida: subir de plano e outra acao'
);

select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')$$,
  '22023', null,
  'o plano em que a barbearia ja esta nao e descida'
);

select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000')$$,
  '22023', null,
  'plano que nao existe e recusado'
);

select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')$$,
  '55000', null,
  'em teste nao ha o que agendar: descer troca na hora (apply_plan_change)'
);

select throws_ok(
  $$select public.cancel_plan_downgrade('73000000-0000-0000-0000-000000000003')$$,
  '55000', null,
  'em teste nao ha descida para desfazer'
);

select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')$$,
  '55000', null,
  'com o pagamento recusado nao se agenda descida: primeiro regulariza o cartao'
);

select throws_ok(
  $$select public.cancel_plan_downgrade('73000000-0000-0000-0000-000000000007')$$,
  '55000', null,
  'bloqueada nao desfaz descida'
);

select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-00000000000a', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')$$,
  '55000', null,
  'barbearia sem assinatura nao agenda descida'
);

select throws_ok(
  $$select public.cancel_plan_downgrade('73000000-0000-0000-0000-00000000000a')$$,
  '55000', null,
  'barbearia sem assinatura nao desfaz descida'
);

-- A proxima mensalidade aprovada aplica o plano agendado -------------------------------------------
select is(
  public.apply_subscription_payment('73000000-0000-0000-0000-000000000008', 'pay-73-h', 'mp-73-h', 'approved', 59.90, '2040-06-01 12:00:00+00', 'recurring', 'visa', '5682'),
  'renewed',
  'a mensalidade aprovada na data renova o periodo'
);

select is(
  (select s.plan_id || '|' || coalesce(s.scheduled_plan_id::text, 'sem descida agendada') || '|' || s.current_period_start::text || '|' || s.current_period_end::text
   from public.tenant_subscriptions s where s.tenant_id = '73000000-0000-0000-0000-000000000008'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11|sem descida agendada|2040-06-01 12:00:00+00|2040-07-01 12:00:00+00',
  'e aplica o plano agendado: a Tesoura passa a ser o plano e o agendamento some'
);

select throws_ok(
  $$insert into public.professionals(tenant_id, name, phone, commission_percentage)
    values ('73000000-0000-0000-0000-000000000008', 'T73 H2', '11988807314', 10)$$,
  '53400', 'PROFESSIONAL_LIMIT_REACHED',
  'depois de aplicada, o limite da Tesoura vale como o limite do plano da assinatura'
);

select is(
  public.apply_subscription_payment('73000000-0000-0000-0000-000000000006', 'pay-73-f-rej', 'mp-73-f', 'rejected', 59.90, '2040-06-01 12:00:00+00', 'recurring', 'visa', '5682'),
  'payment_failed',
  'a mensalidade recusada manda a assinatura para o pagamento recusado'
);

select is(
  (select s.status || '|' || s.plan_id || '|' || s.scheduled_plan_id from public.tenant_subscriptions s where s.tenant_id = '73000000-0000-0000-0000-000000000006'),
  'past_due|b3fa7384-d113-4a1b-a5ed-1efeb7e51c22|b3fa7384-d113-4a1b-a5ed-1efeb7e51c11',
  'a recusa nao aplica o plano agendado: o plano continua e a descida segue agendada'
);

select is(
  public.apply_subscription_payment('73000000-0000-0000-0000-000000000006', 'pay-73-f-ok', 'mp-73-f', 'approved', 59.90, '2040-06-03 12:00:00+00', 'recurring', 'visa', '5682'),
  'activated',
  'a mensalidade que o Mercado Pago aprova depois regulariza a assinatura'
);

select is(
  (select s.status || '|' || s.plan_id || '|' || coalesce(s.scheduled_plan_id::text, 'sem descida agendada') from public.tenant_subscriptions s where s.tenant_id = '73000000-0000-0000-0000-000000000006'),
  'active|b3fa7384-d113-4a1b-a5ed-1efeb7e51c11|sem descida agendada',
  'e aplica o plano agendado, porque o valor dela ja era o do plano menor'
);

select is(
  public.apply_subscription_payment('73000000-0000-0000-0000-000000000009', 'pay-73-i', null, 'approved', 30.00, '2040-05-10 12:00:00+00', 'upgrade', 'visa', '5682'),
  'recorded',
  'a cobranca da diferenca de um upgrade so entra no historico'
);

select is(
  (select s.plan_id || '|' || s.scheduled_plan_id from public.tenant_subscriptions s where s.tenant_id = '73000000-0000-0000-0000-000000000009'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22|b3fa7384-d113-4a1b-a5ed-1efeb7e51c11',
  'e nao aplica a descida agendada: so a mensalidade aprovada aplica'
);

-- Acesso --------------------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.schedule_plan_downgrade(uuid,uuid)', 'execute')
    and has_function_privilege('service_role', 'public.cancel_plan_downgrade(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.schedule_plan_downgrade(uuid,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.cancel_plan_downgrade(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.schedule_plan_downgrade(uuid,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.cancel_plan_downgrade(uuid)', 'execute'),
  'so o service_role agenda e desfaz a descida'
);

-- Gerente logado, com barbearia: a guarda e o grant.
insert into auth.users(id, email)
values ('73000000-0000-0000-0000-0000000000a1', 't73-gerente@test.local');
update public.users
set tenant_id = '73000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true
where id = '73000000-0000-0000-0000-0000000000a1';

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')$$,
  '42501', null,
  'o Gerente logado nao agenda a descida direto pelo front: quem agenda e a Edge Function'
);
select throws_ok(
  $$select public.cancel_plan_downgrade('73000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'o Gerente logado nao desfaz a descida direto pelo front'
);
reset role;

-- Gerente sem barbearia (public.users.tenant_id nulo): a guarda e o grant, nao uma comparacao de
-- tenant que o NULL contornaria (ver o teste 32), entao ele tambem nao chama as funcoes.
insert into auth.users(id, email)
values ('73000000-0000-0000-0000-0000000000a2', 't73-gerente-sem-tenant@test.local');
update public.users
set tenant_id = null, role = 'gerente', is_active = true
where id = '73000000-0000-0000-0000-0000000000a2';

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok(
  $$select public.schedule_plan_downgrade('73000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11')$$,
  '42501', null,
  'o Gerente sem barbearia (tenant_id nulo) tambem nao agenda a descida direto pelo front'
);
select throws_ok(
  $$select public.cancel_plan_downgrade('73000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'o Gerente sem barbearia (tenant_id nulo) tambem nao desfaz a descida direto pelo front'
);
reset role;

select * from finish();
rollback;
