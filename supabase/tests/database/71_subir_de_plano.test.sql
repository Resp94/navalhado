begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Spec 052, ticket 10: subir de plano com diferenca proporcional. A Edge Function de cobranca le o
-- contexto da troca (get_plan_change_context), cobra a diferenca no provedor e so entao chama
-- apply_plan_change, que troca o plano na hora (o limite de profissionais sobe junto) e grava a
-- cobranca no historico. Em teste a troca e livre e sem cobranca. So o service_role executa as duas.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('71000000-0000-0000-0000-000000000001', 'T71 A', 't71-a@test.local', '92999997101', 't71-a', true),
  ('71000000-0000-0000-0000-000000000002', 'T71 B', 't71-b@test.local', '92999997102', 't71-b', true),
  ('71000000-0000-0000-0000-000000000003', 'T71 C', 't71-c@test.local', '92999997103', 't71-c', true),
  ('71000000-0000-0000-0000-000000000004', 'T71 D', 't71-d@test.local', '92999997104', 't71-d', true),
  ('71000000-0000-0000-0000-000000000005', 'T71 E', 't71-e@test.local', '92999997105', 't71-e', true),
  ('71000000-0000-0000-0000-000000000006', 'T71 Z', 't71-z@test.local', '92999997106', 't71-z', true);

-- A: ativa, Tesoura, 1 profissional. B: em teste, Maquina, 1 profissional. C: em teste, Maquina, 2 profissionais
-- ativos e 1 excluido. D: ativa, Maquina, com descida para a Tesoura agendada. E: so para as situacoes recusadas.
-- Z: sem assinatura. O gatilho de cadastro pode ter criado assinaturas; as de teste mandam.
delete from public.tenant_subscriptions where tenant_id in (
  '71000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000003',
  '71000000-0000-0000-0000-000000000004', '71000000-0000-0000-0000-000000000005', '71000000-0000-0000-0000-000000000006');

insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, card_brand, card_last4, mp_subscription_id)
values ('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'visa', '5682', 'mp-71-a');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at)
values
  ('71000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-05-20 12:00:00+00'),
  ('71000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-05-20 12:00:00+00');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, scheduled_plan_id, mp_subscription_id)
values ('71000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'mp-71-d');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, mp_subscription_id)
values ('71000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', 'mp-71-e');

insert into public.professionals(tenant_id, name, phone, commission_percentage)
values
  ('71000000-0000-0000-0000-000000000001', 'T71 A1', '11988807101', 10),
  ('71000000-0000-0000-0000-000000000002', 'T71 B1', '11988807102', 10),
  ('71000000-0000-0000-0000-000000000003', 'T71 C1', '11988807103', 10),
  ('71000000-0000-0000-0000-000000000003', 'T71 C2', '11988807104', 10);
insert into public.professionals(tenant_id, name, phone, commission_percentage, deleted_at)
values ('71000000-0000-0000-0000-000000000003', 'T71 C3', '11988807105', 10, now());

-- Contexto da troca -------------------------------------------------------------
select is(
  (select c.status || '|' || c.mp_subscription_id || '|' || c.current_plan_id || '|' || c.current_plan_price || '|' || c.target_plan_name
     || '|' || c.target_plan_price || '|' || c.target_max_professionals || '|' || c.current_period_start::text || '|' || c.current_period_end::text
     || '|' || c.active_professionals
   from public.get_plan_change_context('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22') c),
  'active|mp-71-a|b3fa7384-d113-4a1b-a5ed-1efeb7e51c11|59.90|Máquina|89.90|5|2040-05-01 12:00:00+00|2040-06-01 12:00:00+00|1',
  'o contexto traz a situacao, o plano atual, o plano de destino, o periodo pago e os profissionais ativos'
);

select is(
  (select c.active_professionals from public.get_plan_change_context('71000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11') c),
  2,
  'o profissional excluido nao conta nos profissionais ativos'
);

select is(
  (select count(*)::integer from public.get_plan_change_context('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000')),
  0,
  'plano que nao existe: sem contexto'
);

select is(
  (select count(*)::integer from public.get_plan_change_context('71000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22')),
  0,
  'barbearia sem assinatura: sem contexto'
);

-- Subir de plano (assinatura ativa, com a diferenca paga) --------------------------
select throws_ok(
  $$insert into public.professionals(tenant_id, name, phone, commission_percentage)
    values ('71000000-0000-0000-0000-000000000001', 'T71 A2', '11988807106', 10)$$,
  '53400', 'PROFESSIONAL_LIMIT_REACHED',
  'antes de subir de plano a Tesoura recusa o segundo profissional'
);

select is(
  public.apply_plan_change('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'pay-71-a', 30.00, '2040-05-10 12:00:00+00', 'master', '5555'),
  'changed',
  'com a diferenca paga, o plano troca'
);

select is(
  (select s.plan_id || '|' || s.status || '|' || s.current_period_start::text || '|' || s.current_period_end::text || '|' || s.card_brand || '|' || s.card_last4 || '|' || s.mp_subscription_id
   from public.tenant_subscriptions s where s.tenant_id = '71000000-0000-0000-0000-000000000001'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22|active|2040-05-01 12:00:00+00|2040-06-01 12:00:00+00|visa|5682|mp-71-a',
  'trocar o plano nao mexe na situacao, no periodo pago, no cartao da assinatura nem na assinatura do Mercado Pago'
);

select is(
  (select c.kind || '|' || c.status || '|' || c.amount || '|' || c.card_brand || '|' || c.card_last4 || '|' || coalesce(c.mp_subscription_id, 'sem assinatura')
   from public.billing_charges c where c.mp_payment_id = 'pay-71-a' and c.tenant_id = '71000000-0000-0000-0000-000000000001'),
  'upgrade|approved|30.00|master|5555|sem assinatura',
  'a diferenca vai para o historico como cobranca de upgrade, com o cartao digitado na hora'
);

select lives_ok(
  $$insert into public.professionals(tenant_id, name, phone, commission_percentage)
    values ('71000000-0000-0000-0000-000000000001', 'T71 A2', '11988807106', 10)$$,
  'o limite novo vale na hora: depois de subir de plano o segundo profissional e aceito'
);

select is(
  public.apply_plan_change('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'pay-71-a', 30.00, '2040-05-10 12:00:00+00', 'master', '5555'),
  'duplicate',
  'o mesmo pagamento aplicado de novo (aviso repetido, duplo clique) nao troca nem grava nada outra vez'
);

select is(
  (select count(*)::integer from public.billing_charges where tenant_id = '71000000-0000-0000-0000-000000000001'),
  1,
  'a repeticao nao cria uma segunda cobranca no historico'
);

select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'pay-71-a2', 30.00, '2040-05-10 12:00:00+00', 'master', '5555')$$,
  '22023', null,
  'um pagamento novo para o plano em que a barbearia ja esta e recusado, para o Gerente nao pagar duas vezes por ele sem que ninguem veja'
);

-- O pagamento aprovado antes de o plano trocar (o webhook chega primeiro) nao impede a troca.
insert into public.billing_charges(tenant_id, mp_payment_id, kind, status, amount, charged_at)
values ('71000000-0000-0000-0000-000000000004', 'pay-71-d', 'upgrade', 'approved', 70.00, '2040-05-10 12:00:00+00');

select is(
  public.apply_plan_change('71000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'pay-71-d', 70.00, '2040-05-10 12:00:00+00', 'visa', '5682'),
  'changed',
  'o webhook pode gravar o pagamento antes: a troca acontece mesmo assim'
);

select is(
  (select s.plan_id || '|' || coalesce(s.scheduled_plan_id::text, 'sem descida agendada')
   from public.tenant_subscriptions s where s.tenant_id = '71000000-0000-0000-0000-000000000004'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33|sem descida agendada',
  'subir de plano desfaz a descida agendada: o que o Gerente pediu por ultimo vale'
);

-- So sobe: o plano mais barato na assinatura ativa e recusado (descer e outra acao, so no proximo ciclo).
select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'pay-71-a3', 10.00, '2040-05-10 12:00:00+00', 'visa', '1111')$$,
  '22023', null,
  'na assinatura ativa so se troca para um plano mais caro'
);

select is(
  (select s.plan_id::text from public.tenant_subscriptions s where s.tenant_id = '71000000-0000-0000-0000-000000000001'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
  'a troca recusada deixa o plano como estava'
);

select is(
  (select count(*)::integer from public.billing_charges where tenant_id = '71000000-0000-0000-0000-000000000001' and mp_payment_id = 'pay-71-a3'),
  0,
  'a troca recusada nao grava a cobranca'
);

-- Sem cobranca (diferenca abaixo do minimo do provedor): o plano troca e nada vai para o historico.
select is(
  public.apply_plan_change('71000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', null, null, null, null, null),
  'changed',
  'sem cobranca avulsa (diferenca abaixo do minimo do provedor) o plano troca'
);

select is(
  (select count(*)::integer from public.billing_charges where tenant_id = '71000000-0000-0000-0000-000000000005'),
  0,
  'a troca sem cobranca nao grava cobranca no historico'
);

-- Em teste a troca e livre, para cima e para baixo, sem cobranca.
select is(
  public.apply_plan_change('71000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', null, null, null, null, null),
  'changed',
  'em teste sobe de plano sem cobranca'
);

select is(
  public.apply_plan_change('71000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', null, null, null, null, null),
  'changed',
  'em teste desce de plano sem cobranca, se os profissionais ativos couberem'
);

select is(
  (select s.plan_id || '|' || s.status || '|' || s.trial_ends_at::text from public.tenant_subscriptions s where s.tenant_id = '71000000-0000-0000-0000-000000000002'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11|trialing|2040-05-20 12:00:00+00',
  'a troca em teste nao mexe na situacao nem no fim do teste'
);

select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', null, null, null, null, null)$$,
  '53400', null,
  'em teste, descer para um plano menor que os profissionais ativos e recusado'
);

select is(
  (select s.plan_id::text from public.tenant_subscriptions s where s.tenant_id = '71000000-0000-0000-0000-000000000003'),
  'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22',
  'a descida recusada deixa o plano como estava'
);

select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', null, null, null, null, null)$$,
  '22023', null,
  'trocar para o plano em que a barbearia ja esta e recusado'
);

-- Situacoes que nao trocam de plano ------------------------------------------------
update public.tenant_subscriptions set status = 'past_due', first_failed_at = '2040-05-05 12:00:00+00'
where tenant_id = '71000000-0000-0000-0000-000000000005';
select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'pay-71-e1', 10.00, '2040-05-10 12:00:00+00', 'visa', '1111')$$,
  '55000', null,
  'com pagamento recusado nao troca de plano'
);

update public.tenant_subscriptions set status = 'blocked', first_failed_at = null, blocked_at = '2040-05-08 12:00:00+00', blocked_reason = 'payment_failed'
where tenant_id = '71000000-0000-0000-0000-000000000005';
select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'pay-71-e2', 10.00, '2040-05-10 12:00:00+00', 'visa', '1111')$$,
  '55000', null,
  'bloqueada nao troca de plano'
);

update public.tenant_subscriptions set status = 'canceled', blocked_at = null, blocked_reason = null, canceled_at = '2040-05-09 12:00:00+00'
where tenant_id = '71000000-0000-0000-0000-000000000005';
select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'pay-71-e3', 10.00, '2040-05-10 12:00:00+00', 'visa', '1111')$$,
  '55000', null,
  'cancelada nao troca de plano'
);

update public.tenant_subscriptions set status = 'courtesy', canceled_at = null
where tenant_id = '71000000-0000-0000-0000-000000000005';
select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'pay-71-e4', 10.00, '2040-05-10 12:00:00+00', 'visa', '1111')$$,
  '55000', null,
  'cortesia nao troca de plano: nao ha cobranca'
);

select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', null, null, null, null, null)$$,
  '55000', null,
  'barbearia sem assinatura nao troca de plano'
);

select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', null, null, null, null, null)$$,
  '22023', null,
  'plano que nao existe e recusado'
);

select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'pay-71-b', 10.00, '2040-05-10 12:00:00+00', 'visa', 'abcd')$$,
  '22023', null,
  'o final do cartao so aceita 4 digitos'
);

select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'pay-71-b', 10.00, '2040-05-10 12:00:00+00', 'visa; drop table x', '1111')$$,
  '22023', null,
  'a bandeira so aceita letras, numeros e sublinhado'
);

-- Acesso --------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.apply_plan_change(uuid,uuid,text,numeric,timestamptz,text,text)', 'execute')
    and has_function_privilege('service_role', 'public.get_plan_change_context(uuid,uuid)', 'execute')
    and not has_function_privilege('anon', 'public.apply_plan_change(uuid,uuid,text,numeric,timestamptz,text,text)', 'execute')
    and not has_function_privilege('anon', 'public.get_plan_change_context(uuid,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.apply_plan_change(uuid,uuid,text,numeric,timestamptz,text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.get_plan_change_context(uuid,uuid)', 'execute'),
  'so o service_role troca o plano e le o contexto da troca'
);

-- Gerente logado, com barbearia: a guarda e o grant.
insert into auth.users(id, email)
values ('71000000-0000-0000-0000-0000000000a1', 't71-gerente@test.local');
update public.users
set tenant_id = '71000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true
where id = '71000000-0000-0000-0000-0000000000a1';

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', null, null, null, null, null)$$,
  '42501', null,
  'o Gerente logado nao troca o plano direto pelo front: quem cobra e a Edge Function'
);
select throws_ok(
  $$select * from public.get_plan_change_context('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33')$$,
  '42501', null,
  'o Gerente logado nao le o contexto da troca direto pelo front'
);
reset role;

-- Gerente sem barbearia (public.users.tenant_id nulo): a guarda e o grant, nao uma comparacao de
-- tenant que o NULL contornaria (ver o teste 32), entao ele tambem nao chama as funcoes.
insert into auth.users(id, email)
values ('71000000-0000-0000-0000-0000000000a2', 't71-gerente-sem-tenant@test.local');
update public.users
set tenant_id = null, role = 'gerente', is_active = true
where id = '71000000-0000-0000-0000-0000000000a2';

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_plan_change('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', null, null, null, null, null)$$,
  '42501', null,
  'o Gerente sem barbearia (tenant_id nulo) tambem nao troca o plano direto pelo front'
);
select throws_ok(
  $$select * from public.get_plan_change_context('71000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33')$$,
  '42501', null,
  'o Gerente sem barbearia (tenant_id nulo) tambem nao le o contexto da troca'
);
reset role;

select * from finish();
rollback;
