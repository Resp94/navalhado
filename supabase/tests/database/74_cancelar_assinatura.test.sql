begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- Spec 052, ticket 12: cancelar a assinatura. A funcao de cobranca cancela no Mercado Pago e grava a situacao
-- (cancel_subscription); o webhook faz o mesmo quando o Gerente cancela fora do Navalhado
-- (record_subscription_cancellation). A cancelada tem acesso, com aviso, ate o fim do periodo pago e fica bloqueada
-- depois; a rotina diaria grava o bloqueio. So o service_role executa as funcoes novas.
-- Da revisao: o cancelamento tira o cartao (a cancelada que ja assinou de novo e a que tem cartao de novo); assinar de novo tira
-- a data do cancelamento (a assinatura nova e a que vale); e a mensalidade aprovada depois do cancelamento paga o mes sem
-- reativar a barbearia (a assinatura cancelada no Mercado Pago nao cobra mais).

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values
  ('74000000-0000-0000-0000-000000000001', 'T74 A', 't74-a@test.local', '92999997401', 't74-a', true),
  ('74000000-0000-0000-0000-000000000002', 'T74 B', 't74-b@test.local', '92999997402', 't74-b', true),
  ('74000000-0000-0000-0000-000000000003', 'T74 C', 't74-c@test.local', '92999997403', 't74-c', true),
  ('74000000-0000-0000-0000-000000000004', 'T74 D', 't74-d@test.local', '92999997404', 't74-d', true),
  ('74000000-0000-0000-0000-000000000005', 'T74 E', 't74-e@test.local', '92999997405', 't74-e', true),
  ('74000000-0000-0000-0000-000000000006', 'T74 F', 't74-f@test.local', '92999997406', 't74-f', true),
  ('74000000-0000-0000-0000-000000000007', 'T74 G', 't74-g@test.local', '92999997407', 't74-g', true),
  ('74000000-0000-0000-0000-000000000008', 'T74 H', 't74-h@test.local', '92999997408', 't74-h', true),
  ('74000000-0000-0000-0000-000000000009', 'T74 Z', 't74-z@test.local', '92999997409', 't74-z', true),
  ('74000000-0000-0000-0000-000000000010', 'T74 I', 't74-i@test.local', '92999997410', 't74-i', true),
  ('74000000-0000-0000-0000-000000000011', 'T74 J', 't74-j@test.local', '92999997411', 't74-j', true),
  ('74000000-0000-0000-0000-000000000012', 'T74 K', 't74-k@test.local', '92999997412', 't74-k', true),
  ('74000000-0000-0000-0000-000000000013', 'T74 L', 't74-l@test.local', '92999997413', 't74-l', true),
  ('74000000-0000-0000-0000-000000000014', 'T74 M', 't74-m@test.local', '92999997414', 't74-m', true),
  ('74000000-0000-0000-0000-000000000015', 'T74 N', 't74-n@test.local', '92999997415', 't74-n', true),
  ('74000000-0000-0000-0000-000000000016', 'T74 O', 't74-o@test.local', '92999997416', 't74-o', true),
  ('74000000-0000-0000-0000-000000000017', 'T74 P', 't74-p@test.local', '92999997417', 't74-p', true),
  ('74000000-0000-0000-0000-000000000018', 'T74 Q', 't74-q@test.local', '92999997418', 't74-q', true),
  ('74000000-0000-0000-0000-000000000019', 'T74 R', 't74-r@test.local', '92999997419', 't74-r', true),
  ('74000000-0000-0000-0000-000000000020', 'T74 S', 't74-s@test.local', '92999997420', 't74-s', true);

-- A: ativa, Maquina, com a Tesoura agendada, periodo pago ate 01/06. B: pagamento recusado (periodo vencido). C: em teste, com
-- o cartao autorizado no Mercado Pago. D: em teste, sem assinatura no Mercado Pago. E: bloqueada por teste vencido (a
-- assinatura que ele deixou no Mercado Pago nunca foi autorizada). F: cortesia. G: ja cancelada. H: ativa, cancelada fora do
-- Navalhado. Z: sem assinatura. I: cancelada pelo Gerente, com a mensalidade aprovada chegando depois. J: o mesmo, com a rotina
-- diaria ja tendo bloqueado (motivo canceled). K: cancelada que assina de novo e paga. L: cancelada que assinou de novo e ainda
-- nao autorizou. M: cancelada que assinou de novo e autorizou. N: cancelada de antes (sem assinatura no Mercado Pago, sem
-- data). O: bloqueada por estorno, com a assinatura ainda viva no Mercado Pago. P: bloqueada por pagamento recusado, idem. Q:
-- bloqueada pela rotina diaria depois de cancelar (motivo canceled). R: bloqueada (canceled) que assinou de novo. S: bloqueada
-- pelo Proprietario (sem motivo), com assinatura viva. O gatilho de cadastro pode ter criado assinaturas; as de teste mandam.
delete from public.tenant_subscriptions where tenant_id::text like '74000000-0000-0000-0000-0000000000%';

insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, first_failed_at, blocked_at, blocked_reason, canceled_at, card_brand, card_last4, mp_subscription_id, scheduled_plan_id)
values
  ('74000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null, 'visa', '5682', 'mp-74-a', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'),
  ('74000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, 'visa', '5682', 'mp-74-b', null),
  ('74000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-05-20 12:00:00+00', null, null, null, null, null, null, 'master', '0604', 'mp-74-c', null),
  ('74000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-05-20 12:00:00+00', null, null, null, null, null, null, null, null, null, null),
  ('74000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, '2040-05-10 12:00:00+00', 'trial_expired', null, null, null, 'mp-74-e', null),
  ('74000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'courtesy', null, null, null, null, null, null, null, null, null, null, null),
  ('74000000-0000-0000-0000-000000000007', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, '2040-05-10 12:00:00+00', 'visa', '5682', 'mp-74-g', null),
  ('74000000-0000-0000-0000-000000000008', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null, 'visa', '5682', 'mp-74-h', null),
  ('74000000-0000-0000-0000-000000000010', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, '2040-05-31 12:00:00+00', null, null, 'mp-74-i', null),
  ('74000000-0000-0000-0000-000000000011', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, '2040-06-02 03:05:00+00', 'canceled', '2040-05-31 12:00:00+00', null, null, 'mp-74-j', null),
  ('74000000-0000-0000-0000-000000000012', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, '2040-05-31 12:00:00+00', 'visa', '5682', 'mp-74-k', null),
  ('74000000-0000-0000-0000-000000000013', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null, null, null, 'mp-74-l', null),
  ('74000000-0000-0000-0000-000000000014', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null, 'master', null, 'mp-74-m', null),
  ('74000000-0000-0000-0000-000000000015', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null, null, null, null, null),
  ('74000000-0000-0000-0000-000000000016', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, '2040-05-10 12:00:00+00', 'refunded', null, 'visa', '5682', 'mp-74-o', null),
  ('74000000-0000-0000-0000-000000000017', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-05-01 12:00:00+00', '2040-05-06 12:00:00+00', 'payment_failed', null, 'visa', '5682', 'mp-74-p', null),
  ('74000000-0000-0000-0000-000000000018', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, '2040-06-02 03:05:00+00', 'canceled', '2040-05-20 12:00:00+00', null, null, 'mp-74-q', null),
  ('74000000-0000-0000-0000-000000000019', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, '2040-06-02 03:05:00+00', 'canceled', null, null, null, 'mp-74-r', null),
  ('74000000-0000-0000-0000-000000000020', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, '2040-05-10 12:00:00+00', null, null, 'visa', '5682', 'mp-74-s', null);

create function pg_temp.estado(p_tenant uuid, p_now timestamptz) returns text language sql as
  $$select e.access || '|' || e.reason || '|' || coalesce(to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'), '-')
    from private.tenant_access_state(p_tenant, p_now) e$$;

-- Cancelar a assinatura ativa ----------------------------------------------------------------------------------
select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000001'),
  'canceled',
  'a assinatura ativa e cancelada'
);

select is(
  (select s.status || '|' || (s.canceled_at is not null)::text || '|' || s.current_period_end::text || '|' || s.mp_subscription_id || '|' || coalesce(s.card_last4, 'sem cartao') || '|' || coalesce(s.scheduled_plan_id::text, 'sem descida agendada')
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000001'),
  'canceled|true|2040-06-01 12:00:00+00|mp-74-a|sem cartao|sem descida agendada',
  'grava a situacao e a data do cancelamento; o periodo pago e a assinatura ficam como estao; o cartao sai (nada o cobra mais) e a descida agendada some'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000001', '2040-05-20 12:00:00+00'),
  'warning|canceled|2040-06-01T12:00:00',
  'a cancelada tem acesso com aviso ate o fim do periodo pago (a faixa diz "Assinatura cancelada. Acesso ate DD/MM.")'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000001', '2040-06-01 12:00:00+00'),
  'blocked|canceled|2040-06-01T12:00:00',
  'no instante do fim do periodo pago ela fica bloqueada'
);

-- Pagamento recusado ---------------------------------------------------------------------------------------------
select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000002'),
  'canceled',
  'com o pagamento recusado tambem cancela: a cobranca pendente deixa de ser tentada'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000002', '2040-06-02 12:00:00+00'),
  'blocked|canceled|2040-06-01T12:00:00',
  'e o periodo pago ja acabou: o acesso fecha'
);

-- Em teste: o cartao autorizado sai e o teste segue -----------------------------------------------------------------
select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000003'),
  'trial_canceled',
  'em teste com o cartao autorizado, cancelar tira a cobranca do fim do teste'
);

select is(
  (select s.status || '|' || coalesce(s.card_brand, 'sem cartao') || '|' || coalesce(s.card_last4, 'sem final') || '|' || s.trial_ends_at::text || '|' || s.mp_subscription_id
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000003'),
  'trialing|sem cartao|sem final|2040-05-20 12:00:00+00|mp-74-c',
  'o teste continua ate o fim e o cartao some (a tela volta a oferecer "Assinar")'
);

-- O que nao tem o que cancelar ---------------------------------------------------------------------------------------
select throws_ok(
  $$select public.cancel_subscription('74000000-0000-0000-0000-000000000004')$$,
  '55000', null,
  'em teste sem assinatura no Mercado Pago nao ha o que cancelar'
);

select throws_like(
  $$select public.cancel_subscription('74000000-0000-0000-0000-000000000004')$$,
  'SUBSCRIPTION_NOT_CANCELABLE%',
  'e a recusa diz o motivo, para a funcao de cobranca explicar ao Gerente'
);

select throws_ok(
  $$select public.cancel_subscription('74000000-0000-0000-0000-000000000005')$$,
  '55000', null,
  'bloqueada por teste vencido nao tem assinatura paga para cancelar (a que ele deixou no Mercado Pago nunca foi autorizada)'
);

select throws_ok(
  $$select public.cancel_subscription('74000000-0000-0000-0000-000000000006')$$,
  '55000', null,
  'cortesia nao tem cobranca para cancelar'
);

select throws_ok(
  $$select public.cancel_subscription('74000000-0000-0000-0000-000000000009')$$,
  '55000', null,
  'barbearia sem assinatura nao cancela'
);

select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000007'),
  'already_canceled',
  'cancelar de novo uma cancelada nao muda nada (clique repetido)'
);

select is(
  (select s.canceled_at::text from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000007'),
  '2040-05-10 12:00:00+00',
  'e a data do primeiro cancelamento fica'
);

-- Cancelada fora do Navalhado: o aviso do Mercado Pago -------------------------------------------------------------
select is(
  public.record_subscription_cancellation('mp-74-h'),
  'canceled',
  'o aviso de assinatura cancelada no Mercado Pago cancela a ativa'
);

select is(
  public.record_subscription_cancellation('mp-74-h'),
  'already_canceled',
  'o aviso repetido, ou o que volta depois do cancelamento feito pelo Navalhado, nao muda nada'
);

select is(
  public.record_subscription_cancellation('mp-74-nenhuma'),
  'unknown_subscription',
  'assinatura que nenhuma barbearia tem e ignorada'
);

select is(
  public.record_subscription_cancellation('mp-74-e'),
  'not_cancelable',
  'bloqueada por teste vencido nao muda com o cancelamento no Mercado Pago'
);

select is(
  (select s.status || '|' || s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000005'),
  'blocked|trial_expired',
  'e segue bloqueada pelo motivo de antes'
);

-- Bloqueada (estorno, contestacao, pagamento recusado ha mais de 5 dias, bloqueio do Proprietario) com a assinatura ainda viva
-- no Mercado Pago: cancelar so tira a cobranca que viria no mes seguinte (e reativaria a barbearia). O acesso segue bloqueado,
-- agora com o motivo canceled: a tela de bloqueio manda assinar de novo, em vez de mandar trocar o cartao de uma assinatura
-- que nao existe mais.
select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000016'),
  'canceled',
  'a bloqueada por estorno, com a assinatura viva no Mercado Pago, cancela'
);

select is(
  (select s.status || '|' || s.blocked_reason || '|' || (s.canceled_at is not null)::text || '|' || coalesce(s.card_brand, 'sem cartao')
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000016'),
  'blocked|canceled|true|sem cartao',
  'segue bloqueada, agora pelo motivo canceled, e o cartao sai'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000016', '2040-05-20 12:00:00+00'),
  'blocked|canceled|2040-05-10T12:00:00',
  'o acesso nao volta: cancelar nao desbloqueia a barbearia bloqueada por estorno'
);

select is(
  public.record_subscription_cancellation('mp-74-p'),
  'canceled',
  'o aviso do Mercado Pago de que a assinatura da bloqueada por pagamento recusado foi cancelada tambem registra o cancelamento'
);

select is(
  (select s.status || '|' || s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000017'),
  'blocked|canceled',
  'e a tela de bloqueio passa a mandar assinar de novo em vez de trocar o cartao'
);

select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000020'),
  'canceled',
  'a bloqueada pelo Proprietario (sem motivo), com a assinatura viva, tambem cancela'
);

select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000018'),
  'already_canceled',
  'a bloqueada pela rotina depois de cancelar (motivo canceled, com a data) nao tem o que cancelar de novo'
);

select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000019'),
  'canceled',
  'a bloqueada (canceled) que assinou de novo e cancela a assinatura nova (sem a data, como a cancelada)'
);

select is(
  (select (s.canceled_at is not null)::text || '|' || s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000019'),
  'true|canceled',
  'e volta a ter a data do cancelamento'
);

-- Assinar de novo: o aviso da assinatura antiga nao cancela a nova ------------------------------------------------
select lives_ok(
  $$select public.record_mp_subscription('74000000-0000-0000-0000-000000000008', 'mp-74-h-nova')$$,
  'assinar de novo depois de cancelar grava a assinatura nova'
);

select is(
  public.record_subscription_cancellation('mp-74-h'),
  'unknown_subscription',
  'o aviso da assinatura antiga (cancelada) nao e mais de nenhuma barbearia: nao cancela a nova'
);

-- A mensalidade aprovada depois do cancelamento (cobrada nos instantes antes dele, ou em analise e aprovada depois) paga o
-- mes, mas a assinatura no Mercado Pago esta cancelada e nao cobra mais: a barbearia segue cancelada, com acesso ate o fim
-- desse mes, em vez de virar ativa (ativa e sempre liberada, e ninguem a bloquearia no fim do mes).
select is(
  public.apply_subscription_payment('74000000-0000-0000-0000-000000000010', 'pay-74-i', 'mp-74-i', 'approved', 89.90,
    '2040-06-01 12:00:00+00', 'recurring', 'visa', '5682'),
  'paid_while_canceled',
  'a mensalidade aprovada depois do cancelamento nao reativa a assinatura cancelada'
);

select is(
  (select s.status || '|' || (s.canceled_at is not null)::text || '|' || s.current_period_start::text || '|' || s.current_period_end::text
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000010'),
  'canceled|true|2040-06-01 12:00:00+00|2040-07-01 12:00:00+00',
  'o mes pago vale: o periodo avanca um mes, e a situacao e a data do cancelamento ficam'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000010', '2040-06-15 12:00:00+00'),
  'warning|canceled|2040-07-01T12:00:00',
  'e o acesso, com a faixa de cancelada, vai ate o fim desse mes'
);

select is(
  (select c.status || '|' || c.amount from public.billing_charges c where c.mp_payment_id = 'pay-74-i'),
  'approved|89.90',
  'o pagamento entra no historico'
);

-- A rotina diaria pode ja ter bloqueado a cancelada (motivo canceled): o mes pago a libera de novo.
select is(
  public.apply_subscription_payment('74000000-0000-0000-0000-000000000011', 'pay-74-j', 'mp-74-j', 'approved', 89.90,
    '2040-06-02 06:00:00+00', 'recurring', 'visa', '5682'),
  'paid_while_canceled',
  'o mesmo vale para a cancelada que a rotina diaria ja bloqueou (motivo canceled)'
);

select is(
  (select s.status || '|' || coalesce(s.blocked_reason, 'sem motivo') || '|' || s.current_period_end::text
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000011'),
  'canceled|sem motivo|2040-07-01 12:00:00+00',
  'o mes pago a libera de novo, ate o fim dele'
);

-- Assinar de novo: a assinatura nova e a que vale. Sem a data do cancelamento, o primeiro pagamento dela ativa a barbearia.
select lives_ok(
  $$select public.record_mp_subscription('74000000-0000-0000-0000-000000000012', 'mp-74-k-nova')$$,
  'assinar de novo depois de cancelar grava a assinatura nova'
);

select is(
  (select s.status || '|' || coalesce(s.canceled_at::text, 'sem data') || '|' || s.mp_subscription_id || '|' || coalesce(s.card_brand, 'sem cartao')
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000012'),
  'canceled|sem data|mp-74-k-nova|sem cartao',
  'a assinatura nova tira a data do cancelamento e o cartao da antiga'
);

select is(
  public.apply_subscription_payment('74000000-0000-0000-0000-000000000012', 'pay-74-k', 'mp-74-k-nova', 'approved', 89.90,
    '2040-06-01 12:00:00+00', 'recurring', 'visa', '5682'),
  'activated',
  'o primeiro pagamento da assinatura nova ativa a barbearia'
);

select is(
  (select s.status || '|' || coalesce(s.canceled_at::text, 'sem data') || '|' || s.current_period_end::text
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000012'),
  'active|sem data|2040-07-01 12:00:00+00',
  'ativa, com o periodo novo'
);

-- Estado de Acesso da cancelada que assinou de novo. Com a assinatura nova autorizada no Mercado Pago (cancelada, sem a data do
-- cancelamento e com a bandeira da assinatura nova) a barbearia esta liberada, sem a faixa "Assinatura cancelada": a pessoa
-- assinou de novo, e a cobranca recomeca no fim do periodo pago. Sem a autorizacao (a pagina do Mercado Pago ainda aberta, ou o
-- aviso a caminho) e a cancelada de antes, a faixa continua. No fim do periodo, sem o pagamento da assinatura nova, bloqueia.
select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000014', '2040-05-20 12:00:00+00'),
  'allowed|active|2040-06-01T12:00:00',
  'a cancelada que assinou de novo e teve a assinatura nova autorizada fica liberada, sem a faixa de cancelada'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000014', '2040-06-01 12:00:00+00'),
  'blocked|canceled|2040-06-01T12:00:00',
  'no fim do periodo, sem o pagamento da assinatura nova, bloqueia como qualquer cancelada'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000013', '2040-05-20 12:00:00+00'),
  'warning|canceled|2040-06-01T12:00:00',
  'a que assinou de novo e ainda nao autorizou a assinatura nova segue com a faixa de cancelada'
);

select is(
  pg_temp.estado('74000000-0000-0000-0000-000000000015', '2040-05-20 12:00:00+00'),
  'warning|canceled|2040-06-01T12:00:00',
  'a cancelada de antes, sem assinatura no Mercado Pago, segue com a faixa de cancelada'
);

-- Cancelar a assinatura nova (cancelada que assinou de novo e ainda nao pagou): pelo Navalhado e pelo aviso do Mercado Pago.
select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000013'),
  'canceled',
  'a cancelada que assinou de novo (sem autorizar) cancela a assinatura nova'
);

select is(
  (select (s.canceled_at is not null)::text || '|' || coalesce(s.card_brand, 'sem cartao')
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000013'),
  'true|sem cartao',
  'e volta a ter a data do cancelamento'
);

select is(
  public.record_subscription_cancellation('mp-74-m'),
  'canceled',
  'o aviso do Mercado Pago de que a assinatura nova, ja autorizada, foi cancelada tambem a cancela'
);

select is(
  (select (s.canceled_at is not null)::text || '|' || coalesce(s.card_brand, 'sem cartao')
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000014'),
  'true|sem cartao',
  'a data volta e o cartao da assinatura nova sai (a tela volta a oferecer "Assinar de novo")'
);

select is(
  public.record_subscription_cancellation('mp-74-m'),
  'already_canceled',
  'e o aviso repetido nao muda nada'
);

select is(
  public.cancel_subscription('74000000-0000-0000-0000-000000000015'),
  'already_canceled',
  'a cancelada de antes, sem assinatura no Mercado Pago, nao tem assinatura nova para cancelar'
);

select is(
  (select (s.canceled_at is null)::text from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000015'),
  'true',
  'e a data segue vazia'
);

-- A rotina diaria grava o bloqueio no dia seguinte ao fim do periodo pago (o estado e recalculado para essa data). Fica
-- depois dos outros casos porque tambem bloqueia o que vence ate la (o teste de C e D acaba antes).
select private.block_expired_subscriptions('2040-06-02 03:05:00+00');

select is(
  (select s.status || '|' || s.blocked_at::text || '|' || s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000001'),
  'blocked|2040-06-01 12:00:00+00|canceled',
  'a rotina diaria grava o bloqueio no fim do periodo pago, com o motivo "canceled"'
);

-- Acesso --------------------------------------------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.cancel_subscription(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.record_subscription_cancellation(text)', 'execute')
    and not has_function_privilege('anon', 'public.cancel_subscription(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.record_subscription_cancellation(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.cancel_subscription(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_subscription_cancellation(text)', 'execute'),
  'so o service_role cancela a assinatura'
);

-- Gerente logado, com barbearia: a guarda e o grant.
insert into auth.users(id, email)
values ('74000000-0000-0000-0000-0000000000a1', 't74-gerente@test.local');
update public.users
set tenant_id = '74000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true
where id = '74000000-0000-0000-0000-0000000000a1';

select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok(
  $$select public.cancel_subscription('74000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'o Gerente logado nao cancela direto pelo front: quem cancela e a Edge Function'
);
select throws_ok(
  $$select public.record_subscription_cancellation('mp-74-a')$$,
  '42501', null,
  'nem simula o aviso de cancelamento do Mercado Pago'
);
reset role;

-- Gerente sem barbearia (public.users.tenant_id nulo): a guarda e o grant, nao uma comparacao de tenant que o NULL
-- contornaria (ver o teste 32).
insert into auth.users(id, email)
values ('74000000-0000-0000-0000-0000000000a2', 't74-gerente-sem-tenant@test.local');
update public.users
set tenant_id = null, role = 'gerente', is_active = true
where id = '74000000-0000-0000-0000-0000000000a2';

select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok(
  $$select public.cancel_subscription('74000000-0000-0000-0000-000000000001')$$,
  '42501', null,
  'o Gerente sem barbearia (tenant_id nulo) tambem nao cancela direto pelo front'
);
reset role;

select * from finish();
rollback;
