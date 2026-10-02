begin;
create extension if not exists pgtap with schema extensions;
select plan(123);

-- Spec 052, ticket 15: ferramentas do Proprietario. Funcoes do banco so para o Proprietario (estender o teste, dar e tirar
-- cortesia, desbloquear ate uma data com o motivo registrado, bloquear a mao, ler os detalhes da assinatura e listar os avisos por
-- e-mail que falharam). Cada uma recusa Gerente, Barbeiro, anonimo e Gerente com tenant_id nulo. O desbloqueio e uma data em cima
-- da assinatura (tenant_subscriptions.unblocked_until): enquanto vale, o Estado de Acesso e `warning/unblocked`; depois, volta ao
-- motivo de antes e o acesso fecha de novo no fim do desbloqueio (e e dali que contam a data do bloqueio e os 7 dias da Instancia
-- WhatsApp). O motivo fica so na trilha de auditoria, com tenant_id nulo, para o Gerente nao le-lo. Os dias terminam as 23:59:59 no
-- fuso da barbearia (Manaus UTC-4 na T01; Sao Paulo UTC-3 nas outras).

insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone)
values
  ('78000000-0000-0000-0000-000000000001', 'T78 Trial', 't78-01@test.local', '92999978001', 't78-01', true, 'America/Manaus'),
  ('78000000-0000-0000-0000-000000000002', 'T78 TesteVencido', 't78-02@test.local', '92999978002', 't78-02', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000003', 'T78 Ativa', 't78-03@test.local', '92999978003', 't78-03', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000004', 'T78 Cortesia', 't78-04@test.local', '92999978004', 't78-04', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000005', 'T78 Recusa', 't78-05@test.local', '92999978005', 't78-05', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000006', 'T78 Cancelada', 't78-06@test.local', '92999978006', 't78-06', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000007', 'T78 CortesiaVencida', 't78-07@test.local', '92999978007', 't78-07', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000008', 'T78 Estorno', 't78-08@test.local', '92999978008', 't78-08', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000009', 'T78 Manual', 't78-09@test.local', '92999978009', 't78-09', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000010', 'T78 TrialVencidoNaoProcessado', 't78-10@test.local', '92999978010', 't78-10', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000011', 'T78 Detalhes', 't78-11@test.local', '92999978011', 't78-11', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000012', 'T78 SemAssinatura', 't78-12@test.local', '92999978012', 't78-12', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000013', 'T78 WhatsApp', 't78-13@test.local', '92999978013', 't78-13', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000014', 'T78 ManualParaCortesia', 't78-14@test.local', '92999978014', 't78-14', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000015', 'T78 AtivaParaBloqueio', 't78-15@test.local', '92999978015', 't78-15', true, 'America/Sao_Paulo'),
  ('78000000-0000-0000-0000-000000000016', 'T78 GatilhoDoDesbloqueio', 't78-16@test.local', '92999978016', 't78-16', true, 'America/Sao_Paulo');

delete from public.tenant_subscriptions where tenant_id::text like '78000000-0000-0000-0000-0000000000%';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, first_failed_at, blocked_at, blocked_reason, canceled_at, courtesy_ends_at, updated_at)
values
  ('78000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() + interval '5 days', null, null, null, null, null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '3 days', 'trial_expired', null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, now() - interval '5 days', now() + interval '25 days', null, null, null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'courtesy', null, null, null, null, null, null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, now() - interval '36 days', now() - interval '6 days', now() - interval '6 days', null, null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, now() - interval '35 days', now() - interval '5 days', null, null, null, now() - interval '10 days', null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000007', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'courtesy', null, null, null, null, null, null, null, now() - interval '1 day', now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000008', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '2 days', 'refunded', null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000009', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '2 days', null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000010', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() - interval '1 day', null, null, null, null, null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000011', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, now() - interval '5 days', now() + interval '25 days', null, null, null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000013', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '20 days', 'trial_expired', null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000014', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '2 days', null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000015', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, now() - interval '5 days', now() + interval '25 days', null, null, null, null, null, now() - interval '30 days'),
  ('78000000-0000-0000-0000-000000000016', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, null, null, null, now() - interval '3 days', 'trial_expired', null, null, now() - interval '30 days');

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, deleted_at)
values
  ('78000000-0000-0000-0000-0000000000b1', '78000000-0000-0000-0000-000000000011', 'Profissional T78 A', '92999978101', 0, true, null),
  ('78000000-0000-0000-0000-0000000000b2', '78000000-0000-0000-0000-000000000011', 'Profissional T78 B', '92999978102', 0, true, null),
  ('78000000-0000-0000-0000-0000000000b3', '78000000-0000-0000-0000-000000000011', 'Profissional T78 excluido', '92999978103', 0, true, now() - interval '1 day');

insert into public.billing_charges(tenant_id, amount, charged_at, kind, mp_payment_id, status)
values
  ('78000000-0000-0000-0000-000000000011', 89.90, now() - interval '35 days', 'recurring', 'mp-78-antiga', 'approved'),
  ('78000000-0000-0000-0000-000000000011', 89.90, now() - interval '5 days', 'recurring', 'mp-78-recente', 'approved');

insert into public.billing_notices(tenant_id, kind, ref_at, status, attempts, detail, created_at)
values
  ('78000000-0000-0000-0000-000000000011', 'trial_ending', now() - interval '3 days', 'failed', 3, 'Resend 401: chave invalida', now() - interval '3 days'),
  ('78000000-0000-0000-0000-000000000005', 'payment_failed_day0', now() - interval '6 days', 'failed', 3, 'Resend 403: dominio sem verificacao', now() - interval '1 day'),
  ('78000000-0000-0000-0000-000000000005', 'payment_failed_day4', now() - interval '2 days', 'sent', 1, null, now() - interval '2 days');

insert into auth.users(id, email)
values
  ('78000000-0000-0000-0000-0000000000a1', 't78-proprietario@test.local'),
  ('78000000-0000-0000-0000-0000000000a2', 't78-gerente@test.local'),
  ('78000000-0000-0000-0000-0000000000a3', 't78-barbeiro@test.local'),
  ('78000000-0000-0000-0000-0000000000a4', 't78-gerente-sem-tenant@test.local');
update public.users set tenant_id = null, role = 'proprietario', is_active = true where id = '78000000-0000-0000-0000-0000000000a1';
update public.users set tenant_id = '78000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where id = '78000000-0000-0000-0000-0000000000a2';
update public.users set tenant_id = '78000000-0000-0000-0000-000000000001', role = 'barbeiro', is_active = true where id = '78000000-0000-0000-0000-0000000000a3';
update public.users set tenant_id = null, role = 'gerente', is_active = true where id = '78000000-0000-0000-0000-0000000000a4';

-- A. As funcoes recusam Gerente, Barbeiro, anonimo e Gerente com tenant_id nulo ----------------------------------------------
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000001', date '2040-03-10')$$, '42501', null, 'admin_extend_trial recusa o Gerente');
select throws_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000001', null::date)$$, '42501', null, 'admin_set_courtesy recusa o Gerente');
select throws_ok($$select public.admin_end_courtesy('78000000-0000-0000-0000-000000000004')$$, '42501', null, 'admin_end_courtesy recusa o Gerente');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000002', date '2040-03-10', 'motivo')$$, '42501', null, 'admin_unblock_tenant recusa o Gerente');
select throws_ok($$select public.admin_block_tenant('78000000-0000-0000-0000-000000000003', 'motivo')$$, '42501', null, 'admin_block_tenant recusa o Gerente');
select throws_ok($$select public.admin_get_tenant_subscription('78000000-0000-0000-0000-000000000001')$$, '42501', null, 'admin_get_tenant_subscription recusa o Gerente');
select throws_ok($$select public.admin_list_failed_billing_notices(10)$$, '42501', null, 'admin_list_failed_billing_notices recusa o Gerente');
reset role;
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000001', date '2040-03-10')$$, '42501', null, 'admin_extend_trial recusa o Barbeiro');
select throws_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000001', null::date)$$, '42501', null, 'admin_set_courtesy recusa o Barbeiro');
select throws_ok($$select public.admin_end_courtesy('78000000-0000-0000-0000-000000000004')$$, '42501', null, 'admin_end_courtesy recusa o Barbeiro');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000002', date '2040-03-10', 'motivo')$$, '42501', null, 'admin_unblock_tenant recusa o Barbeiro');
select throws_ok($$select public.admin_block_tenant('78000000-0000-0000-0000-000000000003', 'motivo')$$, '42501', null, 'admin_block_tenant recusa o Barbeiro');
select throws_ok($$select public.admin_get_tenant_subscription('78000000-0000-0000-0000-000000000001')$$, '42501', null, 'admin_get_tenant_subscription recusa o Barbeiro');
select throws_ok($$select public.admin_list_failed_billing_notices(10)$$, '42501', null, 'admin_list_failed_billing_notices recusa o Barbeiro');
reset role;
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000001', date '2040-03-10')$$, '42501', null, 'admin_extend_trial recusa o Gerente sem barbearia (tenant_id nulo)');
select throws_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000001', null::date)$$, '42501', null, 'admin_set_courtesy recusa o Gerente sem barbearia (tenant_id nulo)');
select throws_ok($$select public.admin_end_courtesy('78000000-0000-0000-0000-000000000004')$$, '42501', null, 'admin_end_courtesy recusa o Gerente sem barbearia (tenant_id nulo)');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000002', date '2040-03-10', 'motivo')$$, '42501', null, 'admin_unblock_tenant recusa o Gerente sem barbearia (tenant_id nulo)');
select throws_ok($$select public.admin_block_tenant('78000000-0000-0000-0000-000000000003', 'motivo')$$, '42501', null, 'admin_block_tenant recusa o Gerente sem barbearia (tenant_id nulo)');
select throws_ok($$select public.admin_get_tenant_subscription('78000000-0000-0000-0000-000000000001')$$, '42501', null, 'admin_get_tenant_subscription recusa o Gerente sem barbearia (tenant_id nulo)');
select throws_ok($$select public.admin_list_failed_billing_notices(10)$$, '42501', null, 'admin_list_failed_billing_notices recusa o Gerente sem barbearia (tenant_id nulo)');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000001', date '2040-03-10')$$, '42501', null, 'admin_extend_trial recusa quem nao esta logado (anon)');
select throws_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000001', null::date)$$, '42501', null, 'admin_set_courtesy recusa quem nao esta logado (anon)');
select throws_ok($$select public.admin_end_courtesy('78000000-0000-0000-0000-000000000004')$$, '42501', null, 'admin_end_courtesy recusa quem nao esta logado (anon)');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000002', date '2040-03-10', 'motivo')$$, '42501', null, 'admin_unblock_tenant recusa quem nao esta logado (anon)');
select throws_ok($$select public.admin_block_tenant('78000000-0000-0000-0000-000000000003', 'motivo')$$, '42501', null, 'admin_block_tenant recusa quem nao esta logado (anon)');
select throws_ok($$select public.admin_get_tenant_subscription('78000000-0000-0000-0000-000000000001')$$, '42501', null, 'admin_get_tenant_subscription recusa quem nao esta logado (anon)');
select throws_ok($$select public.admin_list_failed_billing_notices(10)$$, '42501', null, 'admin_list_failed_billing_notices recusa quem nao esta logado (anon)');
reset role;
select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000001') || '/' || (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000002') || '/' || (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000003') || '/' || (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000004') || '/' || coalesce((select s.unblocked_until from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000002')::text, 'sem desbloqueio'),
  'trialing/blocked/active/courtesy/sem desbloqueio',
  'as recusas nao mudaram nenhuma assinatura'
);
select is((select count(*)::int from public.audit_logs where action like 'admin\_%' and details->>'tenant_id' like '78000000-%'), 0, 'e as recusas nao deixaram rastro de acao'); 

-- B. Estender o teste ----------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000001', date '2040-03-10')$$, 'o Proprietario estende o teste da barbearia em teste');
reset role;
select is((select s.trial_ends_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000001'), timestamptz '2040-03-11 03:59:59.999999+00', 'o teste vai ate o fim do dia 10 no fuso da barbearia (Manaus, UTC-4)');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000001', timestamptz '2040-02-01 12:00:00+00') e), 'allowed/trial', 'longe do fim do teste: liberada');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000001', timestamptz '2040-03-11 03:59:59+00') e), 'warning/trial', 'no ultimo segundo do dia 10 (Manaus) ainda esta liberada, com o aviso dos 3 ultimos dias');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000001', timestamptz '2040-03-11 03:59:59.999999+00') e), 'blocked/trial_expired', 'no instante exato do fim (23:59:59.999999 de Manaus) o teste ja acabou');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000001', timestamptz '2040-03-11 04:00:00+00') e), 'blocked/trial_expired', 'a partir da meia-noite de Manaus o teste acabou');
select is(
  (select count(*)::int from public.audit_logs
   where action = 'admin_extend_trial' and tenant_id is null and user_id = '78000000-0000-0000-0000-0000000000a1'
     and details->>'tenant_id' = '78000000-0000-0000-0000-000000000001'::text and details->>'previous_status' = 'trialing'),
  1,
  'a extensao fica na trilha de auditoria (sem tenant_id, para o Gerente nao ler), com quem fez e o estado de antes'
);
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000002', date '2040-03-10')$$, 'estende tambem o teste vencido que ja bloqueou a barbearia');
reset role;
select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000002') || '/' || coalesce((select s.blocked_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000002')::text, 'sem bloqueio') || '/' || coalesce((select s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000002'), 'sem motivo'),
  'trialing/sem bloqueio/sem motivo',
  'a barbearia bloqueada pelo teste vencido volta a ser "em teste", sem a data nem o motivo do bloqueio'
);
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000002', timestamptz '2040-02-01 12:00:00+00') e), 'allowed/trial', 'e o acesso volta');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000003', date '2040-03-10')$$, '55000', 'NOT_IN_TRIAL', 'a barbearia ativa nao tem teste a estender');
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000009', date '2040-03-10')$$, '55000', 'NOT_IN_TRIAL', 'nem a bloqueada a mao, que se libera pelo desbloqueio');
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000001', date '2040-03-05')$$, '22023', 'INVALID_DATE', 'estender nao encurta: o teste ja vai ate 10/03');
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000010', date '2000-01-01')$$, '22023', 'INVALID_DATE', 'uma data que ja passou nao serve');
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000010', null)$$, '22023', 'INVALID_DATE', 'sem data nao serve');
select throws_ok($$select public.admin_extend_trial('78000000-0000-0000-0000-000000000012', date '2040-03-10')$$, 'P0002', 'SUBSCRIPTION_NOT_FOUND', 'barbearia sem assinatura');
reset role;

-- C. Cortesia ------------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000003', null::date)$$, 'marca cortesia sem data de fim numa barbearia ativa');
select lives_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000014', date '2040-06-30')$$, 'marca cortesia ate uma data numa barbearia bloqueada a mao');
reset role;
select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000003') || '/' || coalesce((select s.courtesy_ends_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000003')::text, 'sem fim'),
  'courtesy/sem fim',
  'cortesia sem fim: situacao cortesia e nenhuma data de fim'
);
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000003', timestamptz '2100-01-01 00:00:00+00') e), 'allowed/courtesy', 'sem fim, a cortesia nunca bloqueia');
select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000014') || '/' || coalesce((select s.blocked_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000014')::text, 'sem bloqueio') || '/' || (select s.courtesy_ends_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000014')::text,
  'courtesy/sem bloqueio/2040-07-01 02:59:59.999999+00',
  'cortesia ate o dia 30 (Sao Paulo, UTC-3): limpa o bloqueio e termina no fim do dia'
);
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000014', timestamptz '2040-07-01 02:59:59+00') e), 'allowed/courtesy', 'no ultimo segundo do dia 30 a cortesia vale');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000014', timestamptz '2040-07-01 03:00:00+00') e), 'blocked/courtesy_expired', 'depois do fim, segue a regra do teste vencido');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000015', date '2000-01-01')$$, '22023', 'INVALID_DATE', 'o fim da cortesia nao pode ser uma data que ja passou');
select throws_ok($$select public.admin_set_courtesy('78000000-0000-0000-0000-000000000012', null::date)$$, 'P0002', 'SUBSCRIPTION_NOT_FOUND', 'barbearia sem assinatura');
select lives_ok($$select public.admin_end_courtesy('78000000-0000-0000-0000-000000000004')$$, 'o Proprietario desmarca a cortesia');
select throws_ok($$select public.admin_end_courtesy('78000000-0000-0000-0000-000000000006')$$, '55000', 'NOT_COURTESY', 'so desmarca quem esta em cortesia');
reset role;
select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000004') || '/' || (select s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000004') || '/' || ((select s.blocked_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000004') = now())::text || '/' || ((select s.courtesy_ends_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000004') = now())::text,
  'blocked/courtesy_expired/true/true',
  'desmarcar encerra a cortesia agora: bloqueada, com o motivo e a data de agora (e dali que contam os 7 dias do WhatsApp)'
);
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000004', timestamptz '2040-01-01 00:00:00+00') e), 'blocked/courtesy_expired', 'e o acesso fecha');

-- D. Desbloquear ate uma data, com o motivo registrado -------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000005', date '2040-03-10', 'pagamento em analise (payment_failed)')$$, 'desbloqueia o pagamento recusado ha 6 dias');
reset role;
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000005', timestamptz '2040-03-01 12:00:00+00') e), 'warning/unblocked/2040-03-11 02:59', 'com o pagamento recusado ha 6 dias: liberada com aviso ate o fim do dia 10, e a data relevante e o fim do desbloqueio');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000005', timestamptz '2040-03-11 02:59:59+00') e), 'warning/unblocked', 'no ultimo segundo do desbloqueio ainda esta liberada (payment_failed)');
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000005', timestamptz '2040-03-11 03:00:00+00') e), 'blocked/payment_failed/2040-03-11 02:59', 'no fim do desbloqueio o acesso fecha de novo, com o motivo de antes e a data do fechamento (payment_failed)');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000006', date '2040-03-10', 'pagamento em analise (canceled)')$$, 'desbloqueia o periodo pago da cancelada vencido');
reset role;
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000006', timestamptz '2040-03-01 12:00:00+00') e), 'warning/unblocked/2040-03-11 02:59', 'com o periodo pago da cancelada vencido: liberada com aviso ate o fim do dia 10, e a data relevante e o fim do desbloqueio');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000006', timestamptz '2040-03-11 02:59:59+00') e), 'warning/unblocked', 'no ultimo segundo do desbloqueio ainda esta liberada (canceled)');
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000006', timestamptz '2040-03-11 03:00:00+00') e), 'blocked/canceled/2040-03-11 02:59', 'no fim do desbloqueio o acesso fecha de novo, com o motivo de antes e a data do fechamento (canceled)');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000007', date '2040-03-10', 'pagamento em analise (courtesy_expired)')$$, 'desbloqueia a cortesia vencida');
reset role;
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000007', timestamptz '2040-03-01 12:00:00+00') e), 'warning/unblocked/2040-03-11 02:59', 'com a cortesia vencida: liberada com aviso ate o fim do dia 10, e a data relevante e o fim do desbloqueio');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000007', timestamptz '2040-03-11 02:59:59+00') e), 'warning/unblocked', 'no ultimo segundo do desbloqueio ainda esta liberada (courtesy_expired)');
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000007', timestamptz '2040-03-11 03:00:00+00') e), 'blocked/courtesy_expired/2040-03-11 02:59', 'no fim do desbloqueio o acesso fecha de novo, com o motivo de antes e a data do fechamento (courtesy_expired)');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000008', date '2040-03-10', 'pagamento em analise (refunded)')$$, 'desbloqueia o estorno');
reset role;
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000008', timestamptz '2040-03-01 12:00:00+00') e), 'warning/unblocked/2040-03-11 02:59', 'com o estorno: liberada com aviso ate o fim do dia 10, e a data relevante e o fim do desbloqueio');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000008', timestamptz '2040-03-11 02:59:59+00') e), 'warning/unblocked', 'no ultimo segundo do desbloqueio ainda esta liberada (refunded)');
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000008', timestamptz '2040-03-11 03:00:00+00') e), 'blocked/refunded/2040-03-11 02:59', 'no fim do desbloqueio o acesso fecha de novo, com o motivo de antes e a data do fechamento (refunded)');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000009', date '2040-03-10', 'pagamento em analise (blocked)')$$, 'desbloqueia o bloqueio manual (sem motivo)');
reset role;
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000009', timestamptz '2040-03-01 12:00:00+00') e), 'warning/unblocked/2040-03-11 02:59', 'com o bloqueio manual (sem motivo): liberada com aviso ate o fim do dia 10, e a data relevante e o fim do desbloqueio');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000009', timestamptz '2040-03-11 02:59:59+00') e), 'warning/unblocked', 'no ultimo segundo do desbloqueio ainda esta liberada (blocked)');
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000009', timestamptz '2040-03-11 03:00:00+00') e), 'blocked/blocked/2040-03-11 02:59', 'no fim do desbloqueio o acesso fecha de novo, com o motivo de antes e a data do fechamento (blocked)');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000010', date '2040-03-10', 'pagamento em analise (trial_expired)')$$, 'desbloqueia o teste vencido que a rotina ainda nao bloqueou');
reset role;
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000010', timestamptz '2040-03-01 12:00:00+00') e), 'warning/unblocked/2040-03-11 02:59', 'com o teste vencido que a rotina ainda nao bloqueou: liberada com aviso ate o fim do dia 10, e a data relevante e o fim do desbloqueio');
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000010', timestamptz '2040-03-11 02:59:59+00') e), 'warning/unblocked', 'no ultimo segundo do desbloqueio ainda esta liberada (trial_expired)');
select is((select e.access || '/' || e.reason || '/' || to_char(e.relevant_date at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from private.tenant_access_state('78000000-0000-0000-0000-000000000010', timestamptz '2040-03-11 03:00:00+00') e), 'blocked/trial_expired/2040-03-11 02:59', 'no fim do desbloqueio o acesso fecha de novo, com o motivo de antes e a data do fechamento (trial_expired)');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000003', date '2040-03-10', 'motivo')$$, '55000', 'NOT_BLOCKED', 'a barbearia que nao esta bloqueada (cortesia, agora) nao se desbloqueia');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000011', date '2040-03-10', 'motivo')$$, '55000', 'NOT_BLOCKED', 'nem a ativa');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000013', date '2040-03-10', '   ')$$, '22023', 'REASON_REQUIRED', 'o motivo e obrigatorio');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000013', date '2040-03-10', null)$$, '22023', 'REASON_REQUIRED', 'sem motivo, nao');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000013', date '2000-01-01', 'motivo')$$, '22023', 'INVALID_DATE', 'a data nao pode ter passado');
select throws_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000012', date '2040-03-10', 'motivo')$$, 'P0002', 'SUBSCRIPTION_NOT_FOUND', 'barbearia sem assinatura');
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000005', date '2040-04-15', 'mais uma semana: o banco confirmou o pagamento')$$, 'desbloquear de novo uma barbearia ja desbloqueada muda a data');
reset role;
select is((select s.unblocked_until from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000005'), timestamptz '2040-04-16 02:59:59.999999+00', 'a nova data vale (15/04 ate o fim do dia)');
update public.audit_logs set created_at = created_at - interval '1 hour' where action = 'admin_unblock_tenant' and details->>'tenant_id' = '78000000-0000-0000-0000-000000000005'::text and details->>'reason' like 'pagamento em analise%';
select is(
  (select array_agg(a.details->>'reason' order by a.created_at, a.details->>'reason')
   from public.audit_logs a
   where a.action = 'admin_unblock_tenant' and a.details->>'tenant_id' = '78000000-0000-0000-0000-000000000005'::text and a.user_id = '78000000-0000-0000-0000-0000000000a1' and a.tenant_id is null),
  array['pagamento em analise (payment_failed)', 'mais uma semana: o banco confirmou o pagamento'],
  'o motivo de cada desbloqueio fica na trilha de auditoria, com quem fez'
);
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select is((select count(*)::int from public.audit_logs where action like 'admin\_%'), 0, 'o Gerente nao le a trilha das acoes do Proprietario (o motivo e nota interna)');
reset role;
-- O gatilho: mudar a situacao da assinatura (um pagamento aprovado, por exemplo) tira o desbloqueio.
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000016', date '2040-03-10', 'motivo')$$, 'desbloqueia a barbearia do teste do gatilho');
reset role;
select is(((select s.unblocked_until from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000016') is not null)::text, 'true', 'o desbloqueio nao muda a situacao da assinatura: continua bloqueada, com a data de desbloqueio');
update public.tenant_subscriptions set status = 'active', blocked_at = null, blocked_reason = null, current_period_end = now() + interval '25 days' where tenant_id = '78000000-0000-0000-0000-000000000016';
select is((select s.unblocked_until from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000016')::text, null, 'quando a situacao muda (pagou e ficou ativa) o desbloqueio sai: um bloqueio de depois nao herda uma data antiga');

-- E. Bloquear a mao (no relogio do banco) ---------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_block_tenant('78000000-0000-0000-0000-000000000015', 'uso indevido do sistema')$$, 'o Proprietario bloqueia a barbearia ativa');
select throws_ok($$select public.admin_block_tenant('78000000-0000-0000-0000-000000000008', 'motivo')$$, '55000', 'ALREADY_BLOCKED', 'quem ja esta bloqueado nao bloqueia de novo');
select throws_ok($$select public.admin_block_tenant('78000000-0000-0000-0000-000000000011', '  ')$$, '22023', 'REASON_REQUIRED', 'o motivo e obrigatorio');
reset role;
select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000015') || '/' || ((select s.blocked_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000015') = now())::text || '/' || coalesce((select s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000015'), 'sem motivo'),
  'blocked/true/sem motivo',
  'bloqueada, com a data de agora do banco (e nao a do navegador) e sem motivo de cobranca'
);
select is((select e.access || '/' || e.reason from private.tenant_access_state('78000000-0000-0000-0000-000000000015', timestamptz '2040-01-01 00:00:00+00') e), 'blocked/blocked', 'o acesso fecha');
select is(
  (select a.details->>'reason' from public.audit_logs a where a.action = 'admin_block_tenant' and a.details->>'tenant_id' = '78000000-0000-0000-0000-000000000015'::text),
  'uso indevido do sistema',
  'o motivo do bloqueio fica na trilha'
);

-- F. A Instancia WhatsApp: o desbloqueio segura a exclusao e o relogio dos 7 dias recomeca quando ele acaba ---------------------
insert into public.whatsapp_instances(tenant_id, instance_name, instance_token) values ('78000000-0000-0000-0000-000000000013', 'nav_t78_whatsapp', 'token-t78-whatsapp');
create function pg_temp.veredito(p_agora timestamptz) returns text language sql as $$select private.whatsapp_instance_deletion_verdict(i.id, p_agora) from public.whatsapp_instances i where i.tenant_id = '78000000-0000-0000-0000-000000000013'$$;
select is(pg_temp.veredito(now()), 'due', 'bloqueada ha 20 dias: a instancia e devida');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.admin_unblock_tenant('78000000-0000-0000-0000-000000000013', date '2040-03-10', 'o cliente avisou que paga na segunda')$$, 'desbloqueia a barbearia que ia perder a instancia');
reset role;
update public.tenant_subscriptions set updated_at = now() - interval '30 days' where tenant_id = '78000000-0000-0000-0000-000000000013';
select is(pg_temp.veredito(now()), 'not_blocked', 'com o desbloqueio em vigor a barbearia esta liberada: a instancia fica');
select is(pg_temp.veredito(timestamptz '2040-03-11 03:00:00+00' + interval '2 days'), 'too_recent', 'o desbloqueio acabou ha 2 dias: os 7 dias contam dali, e nao do bloqueio antigo');
select is(pg_temp.veredito(timestamptz '2040-03-11 03:00:00+00' + interval '7 days'), 'due', '7 dias depois do fim do desbloqueio a instancia e devida');

-- G. Ler os detalhes -----------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
create temp table t78_detalhes_ativa as select public.admin_get_tenant_subscription('78000000-0000-0000-0000-000000000011') as d;
create temp table t78_detalhes_recusa as select public.admin_get_tenant_subscription('78000000-0000-0000-0000-000000000005') as d;
create temp table t78_detalhes_sem as select public.admin_get_tenant_subscription('78000000-0000-0000-0000-000000000012') as d;
select is((select d->'tenant'->>'name' from t78_detalhes_ativa), 'T78 Detalhes', 'os detalhes trazem a barbearia');
select is((select d->'subscription'->>'status' from t78_detalhes_ativa) || '/' || (select d->'subscription'->'plan'->>'name' from t78_detalhes_ativa) || '/' || (select d->'subscription'->'plan'->>'max_professionals' from t78_detalhes_ativa), 'active/Máquina/5', 'a situacao e o plano, com o limite');
select is((select d->>'active_professionals' from t78_detalhes_ativa), '2', 'os profissionais ativos (o excluido nao conta)');
select is((select jsonb_array_length(d->'charges')::text || '/' || (d->'charges'->0->>'mp_payment_id') from t78_detalhes_ativa), '2/mp-78-recente', 'o historico de cobrancas, da mais nova para a mais antiga');
select is((select d->'access'->>'access' || '/' || (d->'access'->>'reason') from t78_detalhes_ativa), 'allowed/active', 'o Estado de Acesso de hoje');
select is((select d->'subscription'->>'mp_subscription_id' is null from t78_detalhes_ativa)::text, 'true', 'os ids do Mercado Pago aparecem quando existem (nulo aqui)');
select is((select (d->'subscription'->>'unblocked_until') is not null from t78_detalhes_recusa)::text || '/' || (select d->'unblock'->>'reason' from t78_detalhes_recusa), 'true/mais uma semana: o banco confirmou o pagamento', 'a barbearia desbloqueada mostra ate quando e o ultimo motivo');
select is((select d->'access'->>'access' || '/' || (d->'access'->>'reason') from t78_detalhes_recusa), 'warning/unblocked', 'e o Estado de Acesso diz que esta liberada pelo desbloqueio');
select is((select jsonb_array_length(d->'admin_actions')::text from t78_detalhes_recusa), '2', 'as acoes do Proprietario nessa barbearia (os dois desbloqueios)');
select is((select (d->'subscription')::text || '/' || (d->'access'->>'reason') from t78_detalhes_sem), 'null/no_subscription', 'a barbearia sem assinatura vem sem assinatura, e nao como erro');
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok($$select public.admin_get_tenant_subscription('78000000-0000-0000-0000-0000000000ff')$$, 'P0002', 'TENANT_NOT_FOUND', 'barbearia que nao existe');

-- H. Avisos por e-mail que falharam --------------------------------------------------------------------------------------------
create temp table t78_avisos as select * from public.admin_list_failed_billing_notices(200);
select is(
  (select array_agg(tenant_name || '|' || kind || '|' || attempts::text || '|' || detail order by created_at desc)
   from t78_avisos where tenant_id::text like '78000000-%'),
  array['T78 Recusa|payment_failed_day0|3|Resend 403: dominio sem verificacao', 'T78 Detalhes|trial_ending|3|Resend 401: chave invalida'],
  'lista so os avisos que falharam, do mais novo para o mais velho, com a barbearia, as tentativas e o motivo'
);
select set_config('request.jwt.claim.sub', '78000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is((select count(*)::int from public.admin_list_failed_billing_notices(1)), 1, 'o limite pedido vale');
select is((select count(*)::int from public.admin_list_failed_billing_notices(0)), 1, 'um limite que nao faz sentido cai para 1');
reset role;

-- I. A rotina diaria ------------------------------------------------------------------------------------------------------------
select private.block_expired_subscriptions(now());
select is((select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000010'), 'trialing', 'a rotina nao bloqueia o teste vencido que o Proprietario desbloqueou');
select private.block_expired_subscriptions(timestamptz '2040-03-11 04:00:00+00');
select is(
  (select s.status from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000010') || '/' || (select s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000010') || '/' || to_char((select s.blocked_at from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000010') at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || '/' || coalesce((select s.unblocked_until from public.tenant_subscriptions s where s.tenant_id = '78000000-0000-0000-0000-000000000010')::text, 'sem desbloqueio'),
  'blocked/trial_expired/2040-03-11 02:59/sem desbloqueio',
  'acabado o desbloqueio, a rotina bloqueia, grava como data do bloqueio o fim do desbloqueio (e nao o fim do teste, de antes) e o desbloqueio sai'
);
select * from finish();
rollback;