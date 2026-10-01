begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Spec 052, ticket 12: cancelar a assinatura. A funcao de cobranca cancela no Mercado Pago e grava a situacao
-- (cancel_subscription); o webhook faz o mesmo quando o Gerente cancela fora do Navalhado
-- (record_subscription_cancellation). A cancelada tem acesso, com aviso, ate o fim do periodo pago e fica bloqueada
-- depois; a rotina diaria grava o bloqueio. So o service_role executa as funcoes novas.

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
  ('74000000-0000-0000-0000-000000000009', 'T74 Z', 't74-z@test.local', '92999997409', 't74-z', true);

-- A: ativa, Maquina, com a Tesoura agendada, periodo pago ate 01/06. B: pagamento recusado (periodo vencido). C: em teste, com
-- o cartao autorizado no Mercado Pago. D: em teste, sem assinatura no Mercado Pago. E: bloqueada (estorno). F: cortesia. G: ja
-- cancelada. H: ativa, cancelada fora do Navalhado. Z: sem assinatura. O gatilho de cadastro pode ter criado assinaturas; as
-- de teste mandam.
delete from public.tenant_subscriptions where tenant_id::text like '74000000-0000-0000-0000-0000000000%';

insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, first_failed_at, blocked_at, blocked_reason, canceled_at, card_brand, card_last4, mp_subscription_id, scheduled_plan_id)
values
  ('74000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null, 'visa', '5682', 'mp-74-a', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'),
  ('74000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, 'visa', '5682', 'mp-74-b', null),
  ('74000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-05-20 12:00:00+00', null, null, null, null, null, null, 'master', '0604', 'mp-74-c', null),
  ('74000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', '2040-05-20 12:00:00+00', null, null, null, null, null, null, null, null, null, null),
  ('74000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, '2040-05-10 12:00:00+00', 'refunded', null, 'visa', '5682', 'mp-74-e', null),
  ('74000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'courtesy', null, null, null, null, null, null, null, null, null, null, null),
  ('74000000-0000-0000-0000-000000000007', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, '2040-05-10 12:00:00+00', 'visa', '5682', 'mp-74-g', null),
  ('74000000-0000-0000-0000-000000000008', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', null, '2040-05-01 12:00:00+00', '2040-06-01 12:00:00+00', null, null, null, null, 'visa', '5682', 'mp-74-h', null);

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
  (select s.status || '|' || (s.canceled_at is not null)::text || '|' || s.current_period_end::text || '|' || s.mp_subscription_id || '|' || s.card_last4 || '|' || coalesce(s.scheduled_plan_id::text, 'sem descida agendada')
   from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000001'),
  'canceled|true|2040-06-01 12:00:00+00|mp-74-a|5682|sem descida agendada',
  'grava a situacao e a data do cancelamento; o periodo pago, o cartao e a assinatura ficam como estao; a descida agendada some'
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
  'bloqueada nao cancela por aqui (assina de novo, ou o Proprietario resolve)'
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
  'bloqueada nao muda com o cancelamento no Mercado Pago'
);

select is(
  (select s.status || '|' || s.blocked_reason from public.tenant_subscriptions s where s.tenant_id = '74000000-0000-0000-0000-000000000005'),
  'blocked|refunded',
  'e segue bloqueada pelo motivo de antes'
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
