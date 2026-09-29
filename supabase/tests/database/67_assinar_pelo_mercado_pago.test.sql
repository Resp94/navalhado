begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

-- Spec 052, ticket 05: assinar pelo Mercado Pago.
--
-- Cobre as funcoes do banco que a Edge Function de cobranca e o webhook usam
-- (get_billing_context, record_mp_subscription, record_billing_event, finish_billing_event,
-- apply_subscription_payment, record_subscription_card, get_tenant_by_mp_subscription) e as duas
-- tabelas novas: billing_events (ninguem do front le) e billing_charges (so o Gerente do proprio
-- tenant le, e ninguem escreve). Todas as funcoes sao so do service_role.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('67000000-0000-0000-0000-000000000001', 'T67 A', 't67-a@test.local', '92999990701', 't67-a', true),
  ('67000000-0000-0000-0000-000000000002', 'T67 B', 't67-b@test.local', '92999990702', 't67-b', true),
  ('67000000-0000-0000-0000-000000000003', 'T67 C', 't67-c@test.local', '92999990703', 't67-c', true);

-- Assinaturas: A em teste (Maquina), B bloqueada (Tesoura), C ativa (Maquina). O gatilho de
-- cadastro pode ter criado uma assinatura; a de teste manda.
delete from public.tenant_subscriptions where tenant_id in (
  '67000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000003');

insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at)
values ('67000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() + interval '10 days');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason)
values ('67000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'blocked', now() - interval '1 day', 'trial_expired');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, mp_subscription_id)
values ('67000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', now() - interval '10 days', now() + interval '20 days', 'mp-c-1');

insert into auth.users(id, email)
select gen_random_uuid(), '__t67_' || n || '__@teste.com'
from unnest(array['ger', 'barb', 'gernulo', 'gerb', 'inativo']) as n;

update public.users set tenant_id = '67000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where email = '__t67_ger__@teste.com';
update public.users set tenant_id = '67000000-0000-0000-0000-000000000001', role = 'barbeiro', is_active = true where email = '__t67_barb__@teste.com';
update public.users set tenant_id = null, role = 'gerente', is_active = true where email = '__t67_gernulo__@teste.com';
update public.users set tenant_id = '67000000-0000-0000-0000-000000000002', role = 'gerente', is_active = true where email = '__t67_gerb__@teste.com';
update public.users set tenant_id = '67000000-0000-0000-0000-000000000001', role = 'gerente', is_active = false where email = '__t67_inativo__@teste.com';

-- Contexto de cobranca ----------------------------------------------------------
select is(
  (select c.plan_name || '|' || c.plan_price || '|' || c.status || '|' || (c.first_charge_at = s.trial_ends_at)::text
   from public.get_billing_context((select id from public.users where email = '__t67_ger__@teste.com')) c
   join public.tenant_subscriptions s on s.tenant_id = c.tenant_id),
  'Máquina|89.90|trialing|true',
  'em teste: o contexto traz o plano, o valor e a primeira cobranca no fim do teste'
);

select is(
  (select c.plan_name || '|' || c.status || '|' || (c.first_charge_at is null)::text
   from public.get_billing_context((select id from public.users where email = '__t67_gerb__@teste.com')) c),
  'Tesoura|blocked|true',
  'bloqueada: a primeira cobranca e imediata (data nula)'
);

select is(
  (select count(*)::integer from public.get_billing_context((select id from public.users where email = '__t67_barb__@teste.com'))),
  0,
  'o Barbeiro nao recebe contexto de cobranca'
);

select is(
  (select count(*)::integer from public.get_billing_context((select id from public.users where email = '__t67_gernulo__@teste.com'))),
  0,
  'o Gerente sem tenant nao recebe contexto de cobranca'
);

select is(
  (select count(*)::integer from public.get_billing_context((select id from public.users where email = '__t67_inativo__@teste.com'))),
  0,
  'o Gerente inativo nao recebe contexto de cobranca'
);

select is(
  (select count(*)::integer from public.get_billing_context(gen_random_uuid())),
  0,
  'usuario desconhecido nao recebe contexto de cobranca'
);

update public.tenant_subscriptions
set status = 'canceled', canceled_at = now(), current_period_end = now() + interval '5 days'
where tenant_id = '67000000-0000-0000-0000-000000000001';

select is(
  (select c.first_charge_at = s.current_period_end
   from public.get_billing_context((select id from public.users where email = '__t67_ger__@teste.com')) c
   join public.tenant_subscriptions s on s.tenant_id = c.tenant_id),
  true,
  'cancelada com periodo pago pela frente: a nova cobranca so comeca no fim dele'
);

update public.tenant_subscriptions
set current_period_end = now() - interval '1 day'
where tenant_id = '67000000-0000-0000-0000-000000000001';

select is(
  (select c.first_charge_at is null
   from public.get_billing_context((select id from public.users where email = '__t67_ger__@teste.com')) c),
  true,
  'cancelada com o periodo pago vencido: cobranca imediata'
);

update public.tenant_subscriptions
set status = 'trialing', canceled_at = null, current_period_end = null
where tenant_id = '67000000-0000-0000-0000-000000000001';

-- Guarda o id da assinatura no Mercado Pago ---------------------------------------
update public.tenant_subscriptions set card_brand = 'visa', card_last4 = '1111'
where tenant_id = '67000000-0000-0000-0000-000000000001';

select public.record_mp_subscription('67000000-0000-0000-0000-000000000001', 'mp-a-1');

select is(
  (select mp_subscription_id || '|' || coalesce(card_last4, 'sem cartao')
   from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000001'),
  'mp-a-1|sem cartao',
  'a nova assinatura guarda o id e tira da vista o cartao da anterior'
);

select throws_ok(
  $$select public.record_mp_subscription('67000000-0000-0000-0000-000000000003', 'mp-c-2')$$,
  '55000', null,
  'assinatura ativa nao troca de id no Mercado Pago por essa funcao'
);

select lives_ok(
  $$select public.record_mp_subscription('67000000-0000-0000-0000-000000000002', 'mp-b-1')$$,
  'bloqueada: assinar de novo guarda o id da assinatura nova'
);

-- Eventos do webhook ------------------------------------------------------------
select is(public.record_billing_event('evt-1', 'payment', '111', '{"id": 1}'::jsonb), 'new',
  'o primeiro aviso e novo');
select is(public.record_billing_event('evt-1', 'payment', '111', '{"id": 1}'::jsonb), 'retry',
  'o mesmo aviso que nao foi concluido volta como retry (o Mercado Pago reenviou)');

select public.finish_billing_event('evt-1', 'processed', 'ativada');
select is(public.record_billing_event('evt-1', 'payment', '111', '{"id": 1}'::jsonb), 'duplicate',
  'aviso ja concluido e ignorado');

select public.record_billing_event('evt-2', 'payment', '222', '{}'::jsonb);
select public.finish_billing_event('evt-2', 'failed', 'Mercado Pago fora do ar');
select is(public.record_billing_event('evt-2', 'payment', '222', '{}'::jsonb), 'retry',
  'aviso que falhou volta a ser processado quando o Mercado Pago reenvia');

select throws_ok(
  $$select public.finish_billing_event('evt-1', 'talvez', null)$$,
  '22023', null,
  'o aviso so termina como processed, ignored ou failed'
);

-- Pagamento da assinatura --------------------------------------------------------
select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-1', 'mp-a-1', 'approved', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'activated',
  'primeiro pagamento aprovado: o tenant em teste vira ativo'
);

select is(
  (select status || '|' || current_period_start::text || '|' || current_period_end::text || '|' || card_brand || card_last4
   from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000001'),
  'active|2040-03-01 12:00:00+00|2040-04-01 12:00:00+00|visa4444',
  'o periodo pago vai da data do pagamento a um mes depois, e o cartao fica para exibicao'
);

select is(
  (select count(*)::integer from public.billing_charges
   where tenant_id = '67000000-0000-0000-0000-000000000001' and mp_payment_id = 'pay-1' and amount = 89.90 and status = 'approved' and kind = 'recurring'),
  1,
  'o pagamento vira uma linha no historico, com valor, situacao e tipo'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-1', 'mp-a-1', 'approved', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'duplicate',
  'o mesmo pagamento aprovado de novo nao faz nada'
);

select is(
  (select current_period_end from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000001'),
  '2040-04-01 12:00:00+00'::timestamptz,
  'o aviso repetido nao avanca o periodo duas vezes'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-2', 'mp-a-1', 'approved', 89.90,
    '2040-04-01 12:05:00+00', 'recurring', 'visa', '4444'),
  'renewed',
  'pagamento perto do fim do periodo renova'
);

select is(
  (select current_period_start::text || '|' || current_period_end::text
   from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000001'),
  '2040-04-01 12:00:00+00|2040-05-01 12:00:00+00',
  'a renovacao continua do fim do periodo anterior, sem deslocar o ciclo'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-3', 'mp-a-1', 'rejected', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'recorded',
  'pagamento recusado so entra no historico'
);

select is(
  (select current_period_end from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000001'),
  '2040-05-01 12:00:00+00'::timestamptz,
  'pagamento recusado nao mexe no periodo pago'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-4', 'mp-outra', 'approved', 89.90,
    '2040-05-01 12:00:00+00', 'recurring', null, null),
  'ignored_other_subscription',
  'pagamento de outra assinatura no Mercado Pago e ignorado'
);

select is(
  (select count(*)::integer from public.billing_charges where mp_payment_id = 'pay-4'),
  0,
  'o pagamento de outra assinatura nao entra no historico'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-5', 'mp-a-1', 'approved', 10.00,
    '2040-05-02 12:00:00+00', 'upgrade', null, null),
  'recorded',
  'cobranca de upgrade aprovada entra no historico e nao avanca o periodo da mensalidade'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000002', 'pay-b1', 'mp-b-1', 'approved', 59.90,
    '2040-06-10 09:00:00+00', 'recurring', 'master', '5555'),
  'activated',
  'bloqueada: o pagamento aprovado libera o acesso'
);

select is(
  (select status || '|' || coalesce(blocked_reason, 'sem motivo') || '|' || (blocked_at is null)::text || '|' || current_period_end::text
   from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000002'),
  'active|sem motivo|true|2040-07-10 09:00:00+00',
  'ao voltar depois do bloqueio, o periodo comeca na data do pagamento e a marca de bloqueio some'
);

select is(
  public.apply_subscription_payment(gen_random_uuid(), 'pay-x', null, 'approved', 10.00,
    '2040-05-02 12:00:00+00', 'recurring', null, null),
  'ignored_no_subscription',
  'tenant sem assinatura: pagamento ignorado'
);

-- Aviso fora de ordem: o pagamento aprovado nao volta atras ---------------------------
select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-1', 'mp-a-1', 'pending', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', null, null),
  'duplicate',
  'um aviso atrasado (pending) de um pagamento ja aprovado e tratado como repeticao'
);

select is(
  (select status from public.billing_charges where mp_payment_id = 'pay-1'),
  'approved',
  'o pagamento aprovado continua aprovado no historico'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-1', 'mp-a-1', 'approved', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', 'visa', '4444'),
  'duplicate',
  'o aprovado que chega depois do atrasado nao avanca o periodo de novo'
);

select is(
  public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-1', 'mp-a-1', 'refunded', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', null, null),
  'recorded',
  'o estorno de um pagamento aprovado entra no historico'
);

select is(
  (select c.status from public.billing_charges c where c.mp_payment_id = 'pay-1')
    || '|' || public.apply_subscription_payment('67000000-0000-0000-0000-000000000001', 'pay-1', 'mp-a-1', 'approved', 89.90,
    '2040-03-01 12:00:00+00', 'recurring', null, null)
    || '|' || (select current_period_end::text from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000001'),
  'refunded|duplicate|2040-05-01 12:00:00+00',
  'depois do estorno, um aprovado atrasado nao reativa nem avanca o periodo'
);

-- Autorizacao da assinatura: bandeira do cartao e primeira cobranca real ---------------
-- O Mercado Pago converte o start_date em dias gratis contados da autorizacao, e a primeira
-- cobranca (next_payment_date) pode cair depois do fim do teste. O acesso vale ate ela.
insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('67000000-0000-0000-0000-000000000004', 'T67 D', 't67-d@test.local', '92999990704', 't67-d', true),
  ('67000000-0000-0000-0000-000000000005', 'T67 E', 't67-e@test.local', '92999990705', 't67-e', true);

delete from public.tenant_subscriptions where tenant_id in (
  '67000000-0000-0000-0000-000000000004', '67000000-0000-0000-0000-000000000005');

insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at, mp_subscription_id)
values ('67000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'trialing', '2040-01-01 12:00:00+00', 'mp-d-1');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, canceled_at, current_period_start, current_period_end, mp_subscription_id)
values ('67000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'canceled', now(), '2039-12-01 12:00:00+00', '2040-01-01 12:00:00+00', 'mp-e-1');

select is(
  public.record_subscription_authorization('mp-d-1', 'visa', null, '2040-01-02 10:00:00+00'),
  true,
  'a autorizacao da assinatura conhecida e gravada'
);

select is(
  (select trial_ends_at::text || '|' || status || '|' || card_brand || '|' || coalesce(card_last4, 'sem final')
   from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000004'),
  '2040-01-02 11:00:00+00|trialing|visa|sem final',
  'o teste vai ate a primeira cobranca (mais 1 hora), a bandeira e gravada e o final fica vazio'
);

select public.record_subscription_authorization('mp-d-1', null, null, '2039-12-31 10:00:00+00');

select is(
  (select trial_ends_at::text from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000004'),
  '2040-01-02 11:00:00+00',
  'uma primeira cobranca mais cedo nunca encurta o teste'
);

select public.record_subscription_authorization('mp-d-1', null, '5682', null);

select is(
  (select card_brand || '|' || card_last4 from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000004'),
  'visa|5682',
  'o final do cartao chega depois e nao apaga a bandeira'
);

select public.record_subscription_authorization('mp-e-1', 'master', null, '2040-01-02 10:00:00+00');

select is(
  (select status || '|' || current_period_end::text from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000005'),
  'canceled|2040-01-02 11:00:00+00',
  'cancelada que assina de novo: o periodo pago vai ate a primeira cobranca, e a situacao nao muda'
);

select public.record_subscription_authorization('mp-c-1', 'elo', null, '2050-01-01 10:00:00+00');

select is(
  (select status || '|' || (current_period_end < '2041-01-01')::text || '|' || card_brand
   from public.tenant_subscriptions where tenant_id = '67000000-0000-0000-0000-000000000003'),
  'active|true|elo',
  'assinatura ativa: grava a bandeira e nao mexe no periodo pago'
);

select is(public.record_subscription_authorization('mp-nao-existe', 'visa', null, null), false, 'assinatura desconhecida: nada a gravar');

-- Excluir o tenant nao apaga o historico de cobrancas: a linha fica sem tenant.
select public.apply_subscription_payment('67000000-0000-0000-0000-000000000004', 'pay-d1', 'mp-d-1', 'approved', 59.90,
  '2040-01-03 10:00:00+00', 'recurring', null, null);
delete from public.tenants where id = '67000000-0000-0000-0000-000000000004';

select is(
  (select count(*)::integer from public.billing_charges where mp_payment_id = 'pay-d1' and tenant_id is null and amount = 59.90),
  1,
  'excluir o tenant mantem a cobranca no historico, sem tenant'
);

-- Resolucao do tenant -----------------------------------------------------------------
select is(public.get_tenant_by_mp_subscription('mp-c-1'), '67000000-0000-0000-0000-000000000003'::uuid,
  'o tenant e resolvido pelo id da assinatura no Mercado Pago');
select is(public.get_tenant_by_mp_subscription('mp-nao-existe'), null, 'id desconhecido: nenhum tenant');

-- Privilegios: so o service_role -------------------------------------------------
select ok(
  (select bool_and(
     has_function_privilege('service_role', s, 'execute')
     and not has_function_privilege('anon', s, 'execute')
     and not has_function_privilege('authenticated', s, 'execute'))
   from unnest(array[
     'public.get_billing_context(uuid)',
     'public.record_mp_subscription(uuid,text)',
     'public.record_billing_event(text,text,text,jsonb)',
     'public.finish_billing_event(text,text,text)',
     'public.apply_subscription_payment(uuid,text,text,text,numeric,timestamptz,text,text,text)',
     'public.record_subscription_authorization(text,text,text,timestamptz)',
     'public.get_tenant_by_mp_subscription(text)'
   ]) as s),
  'todas as funcoes de cobranca so sao executaveis pelo service_role'
);

-- Tabelas: quem le e quem escreve ---------------------------------------------------
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = '__t67_ger__@teste.com'), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.billing_charges),
  4,
  'o Gerente le so o historico da propria barbearia'
);

select throws_ok(
  $$select * from public.billing_events$$,
  '42501', null,
  'o Gerente nao le os eventos do webhook'
);

select throws_ok(
  $$insert into public.billing_charges(tenant_id, mp_payment_id, status, amount, charged_at)
    values ('67000000-0000-0000-0000-000000000001', 'pay-front', 'approved', 1, now())$$,
  '42501', null,
  'o Gerente nao escreve no historico de cobrancas'
);

reset role;
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = '__t67_barb__@teste.com'), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.billing_charges),
  0,
  'o Barbeiro nao le o historico de cobrancas'
);

reset role;
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = '__t67_gernulo__@teste.com'), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.billing_charges),
  0,
  'o Gerente sem tenant nao le o historico de nenhuma barbearia'
);

reset role;
select set_config('request.jwt.claim.sub', (select id::text from public.users where email = '__t67_gerb__@teste.com'), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.billing_charges),
  1,
  'o Gerente de outra barbearia le so o proprio historico'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.billing_charges$$,
  '42501', null,
  'anonimo nao le o historico de cobrancas'
);

select throws_ok(
  $$select * from public.billing_events$$,
  '42501', null,
  'anonimo nao le os eventos do webhook'
);

reset role;

select * from finish();
rollback;
