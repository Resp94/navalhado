begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Spec 052, ticket 10 (achados da revisao): tres garantias do banco para o upgrade.
--
-- 1. O pagamento de upgrade aprovado DEPOIS da resposta da funcao de cobranca (em analise que o
--    Mercado Pago aprova mais tarde, falha do banco depois da cobranca, timeout) e aplicado pelo
--    webhook com apply_plan_change, e uma repeticao do aviso nunca troca o plano de novo, mesmo que
--    a barbearia ja tenha mudado de plano depois (billing_charges.plan_applied_at).
-- 2. O estorno de uma cobranca de upgrade so entra no historico: nao bloqueia a barbearia. A
--    contestacao e o estorno da mensalidade continuam bloqueando.
-- 3. get_plan_change_context conta as tentativas de upgrade que nao foram aprovadas no periodo
--    (failed_upgrade_attempts): a funcao de cobranca as usa na chave de idempotencia.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('72000000-0000-0000-0000-000000000001', 'T72 A', 't72-a@test.local', '92999997201', 't72-a', true),
  ('72000000-0000-0000-0000-000000000002', 'T72 B', 't72-b@test.local', '92999997202', 't72-b', true),
  ('72000000-0000-0000-0000-000000000003', 'T72 C', 't72-c@test.local', '92999997203', 't72-c', true),
  ('72000000-0000-0000-0000-000000000004', 'T72 D', 't72-d@test.local', '92999997204', 't72-d', true),
  ('72000000-0000-0000-0000-000000000005', 'T72 E', 't72-e@test.local', '92999997205', 't72-e', true);

delete from public.tenant_subscriptions where tenant_id in (
  '72000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000003',
  '72000000-0000-0000-0000-000000000004', '72000000-0000-0000-0000-000000000005');

-- Todas ativas na Tesoura, periodo de 01/05 a 01/06/2040.
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, mp_subscription_id)
select t.id, 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'mp-72-' || right(t.id::text, 1)
from public.tenants t
where t.id::text like '72000000-0000-0000-0000-00000000000%';

-- 1. Aprovado depois ----------------------------------------------------------------------
select is(
  public.apply_subscription_payment('72000000-0000-0000-0000-000000000001', 'pay-72-a', null, 'in_process', 30.00, '2040-05-10 12:00:00+00', 'upgrade', 'visa', '5682'),
  'recorded',
  'a cobranca em analise entra no historico'
);

select is(
  public.apply_subscription_payment('72000000-0000-0000-0000-000000000001', 'pay-72-a', null, 'approved', 30.00, '2040-05-10 12:05:00+00', 'upgrade', 'visa', '5682'),
  'recorded',
  'aprovada depois, a cobranca continua so no historico: quem troca o plano e apply_plan_change'
);

select is(
  public.apply_plan_change('72000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'pay-72-a', 30.00, '2040-05-10 12:05:00+00', 'visa', '5682'),
  'changed',
  'o webhook aplica o upgrade aprovado depois da resposta da funcao de cobranca'
);

select is(
  (select plan_id::text from public.tenant_subscriptions where tenant_id = '72000000-0000-0000-0000-000000000001'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
  'a barbearia esta no plano novo'
);

select ok(
  (select plan_applied_at is not null from public.billing_charges where mp_payment_id = 'pay-72-a'),
  'a cobranca fica marcada como aplicada'
);

-- A barbearia sobe de novo (Bancada) e o aviso do primeiro pagamento chega outra vez: nao desfaz nada.
select is(
  public.apply_plan_change('72000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'pay-72-b', 70.00, '2040-05-12 12:00:00+00', 'visa', '5682'),
  'changed',
  'a barbearia sobe de novo, para a Bancada'
);

select is(
  public.apply_plan_change('72000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'pay-72-a', 30.00, '2040-05-10 12:05:00+00', 'visa', '5682'),
  'duplicate',
  'o aviso repetido do primeiro pagamento nao muda o plano outra vez'
);

select is(
  (select plan_id::text from public.tenant_subscriptions where tenant_id = '72000000-0000-0000-0000-000000000001'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33',
  'a barbearia continua na Bancada'
);

-- 3. Tentativas de upgrade nao aprovadas no periodo ------------------------------------------
insert into public.billing_charges(tenant_id, mp_payment_id, kind, status, amount, charged_at)
values
  ('72000000-0000-0000-0000-000000000002', 'pay-72-b1', 'upgrade', 'rejected', 30.00, '2040-05-10 12:00:00+00'),
  ('72000000-0000-0000-0000-000000000002', 'pay-72-b2', 'upgrade', 'in_process', 30.00, '2040-05-11 12:00:00+00'),
  ('72000000-0000-0000-0000-000000000002', 'pay-72-b3', 'upgrade', 'approved', 30.00, '2040-05-12 12:00:00+00'),
  ('72000000-0000-0000-0000-000000000002', 'pay-72-b4', 'upgrade', 'refunded', 30.00, '2040-05-13 12:00:00+00'),
  ('72000000-0000-0000-0000-000000000002', 'pay-72-b5', 'upgrade', 'rejected', 30.00, '2040-04-10 12:00:00+00'),
  ('72000000-0000-0000-0000-000000000002', 'pay-72-b6', 'recurring', 'rejected', 59.90, '2040-05-14 12:00:00+00'),
  ('72000000-0000-0000-0000-000000000003', 'pay-72-c0', 'upgrade', 'rejected', 30.00, '2040-05-10 12:00:00+00');

select is(
  (select c.failed_upgrade_attempts from public.get_plan_change_context('72000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22') c),
  2,
  'conta so as tentativas de upgrade deste periodo e desta barbearia que nao foram aprovadas nem estornadas'
);

-- 2. Estorno de upgrade ----------------------------------------------------------------------
select is(
  public.apply_subscription_payment('72000000-0000-0000-0000-000000000003', 'pay-72-c1', null, 'refunded', 30.00, '2040-05-10 12:00:00+00', 'upgrade', 'visa', '5682'),
  'recorded',
  'o estorno de uma cobranca de upgrade so entra no historico'
);

select is(
  (select status || '|' || coalesce(blocked_reason, 'sem motivo') from public.tenant_subscriptions where tenant_id = '72000000-0000-0000-0000-000000000003'),
  'active|sem motivo',
  'a barbearia que paga em dia nao e bloqueada pelo estorno da diferenca'
);

select is(
  (select count(*)::integer from public.billing_notices where tenant_id = '72000000-0000-0000-0000-000000000003'),
  0,
  'nenhum e-mail de bloqueio e enfileirado'
);

select is(
  public.apply_subscription_payment('72000000-0000-0000-0000-000000000004', 'pay-72-d1', 'mp-72-4', 'refunded', 59.90, '2040-05-10 12:00:00+00', 'recurring', 'visa', '5682'),
  'blocked',
  'o estorno da mensalidade continua bloqueando'
);

select is(
  public.apply_subscription_payment('72000000-0000-0000-0000-000000000005', 'pay-72-e1', null, 'charged_back', 30.00, '2040-05-10 12:00:00+00', 'upgrade', 'visa', '5682'),
  'blocked',
  'a contestacao, inclusive de um upgrade, continua bloqueando'
);

select ok(
  has_function_privilege('service_role', 'public.get_plan_change_context(uuid,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.get_plan_change_context(uuid,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.get_plan_change_context(uuid,uuid)', 'execute'),
  'so o service_role le o contexto da troca (a funcao foi recriada)'
);

select * from finish();
rollback;
