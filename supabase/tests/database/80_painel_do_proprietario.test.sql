begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Spec 054, tickets 02 a 04: metricas do painel do Proprietario (public.get_admin_dashboard_metrics).
-- Ticket 02: "Faturamento do mes" e "Evolucao da receita" somam as cobrancas aprovadas (public.billing_charges, status `approved`,
-- mensalidade `recurring` e diferenca de plano `upgrade`) no mes do calendario de Brasilia (America/Sao_Paulo). Recusada, em analise,
-- estornada e contestada ficam fora. O grafico tem 12 meses, do mais antigo ao atual, com zero no mes sem cobranca, e usa a mesma regra
-- do cartao. So o Proprietario le (Gerente, Barbeiro, anonimo e Gerente com tenant_id nulo recebem 42501).
-- Ticket 03: o MRR soma o preco do plano que a proxima cobranca vai cobrar das assinaturas `active` e `past_due` (o plano agendado,
-- quando ha descida agendada); "liberadas" e "bloqueadas" contam pelo Estado de Acesso de agora (private.subscription_access_state), e
-- barbearia sem assinatura nao entra em nenhum contador.
-- As barbearias de teste que ja existem no DEV mexem nos numeros, entao cada prova compara o valor de antes com o de depois de
-- inserir. Plano Tesoura 59,90 (b3fa...c11), Maquina 89,90 (c22), Bancada 159,90 (c33).

insert into auth.users(id, email)
values
  ('80000000-0000-0000-0000-0000000000a1', 't80-proprietario@test.local'),
  ('80000000-0000-0000-0000-0000000000a2', 't80-gerente@test.local'),
  ('80000000-0000-0000-0000-0000000000a3', 't80-barbeiro@test.local'),
  ('80000000-0000-0000-0000-0000000000a4', 't80-gerente-sem-tenant@test.local');
update public.users set tenant_id = null, role = 'proprietario', is_active = true where id = '80000000-0000-0000-0000-0000000000a1';
update public.users set tenant_id = null, role = 'gerente', is_active = true where id = '80000000-0000-0000-0000-0000000000a4';

-- O Proprietario chama a RPC como dono do banco, so com o `sub` dele: a guarda olha auth.uid() e a tabela users.
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a1', true);
create function pg_temp.m() returns jsonb language sql as $$ select public.get_admin_dashboard_metrics()::jsonb $$;
create function pg_temp.snap() returns void language plpgsql as $$ begin perform set_config('t80.base', pg_temp.m()::text, true); end $$;
-- O que mudou desde o ultimo snap(), no formato liberadas/bloqueadas/mrr.
create function pg_temp.d() returns text language sql as $$
  select ((pg_temp.m() ->> 'released_tenants')::int - (current_setting('t80.base')::jsonb ->> 'released_tenants')::int)::text
    || '/' || ((pg_temp.m() ->> 'blocked_tenants')::int - (current_setting('t80.base')::jsonb ->> 'blocked_tenants')::int)::text
    || '/' || to_char((pg_temp.m() ->> 'mrr')::numeric - (current_setting('t80.base')::jsonb ->> 'mrr')::numeric, 'FM999990.00')
$$;

-- A. Contadores e MRR, uma barbearia por caso (liberadas/bloqueadas/mrr que cada uma acrescenta) ---------------------------------
select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000001', 'T80 Ativa', 't80-01@test.local', '92999980001', 't80-01', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000001';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end) values ('80000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', now() - interval '5 days', now() + interval '25 days');
select is(pg_temp.d(), '1/0/89.90', 'ativa (Maquina): liberada e soma o plano no MRR');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000002', 'T80 Teste', 't80-02@test.local', '92999980002', 't80-02', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000002';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at) values ('80000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() + interval '10 days');
select is(pg_temp.d(), '1/0/0.00', 'em teste: liberada e fora do MRR');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000003', 'T80 TesteAcabando', 't80-03@test.local', '92999980003', 't80-03', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000003';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at) values ('80000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() + interval '2 days');
select is(pg_temp.d(), '1/0/0.00', 'teste terminando (aviso): ainda liberada e fora do MRR');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000004', 'T80 Cortesia', 't80-04@test.local', '92999980004', 't80-04', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000004';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, courtesy_ends_at) values ('80000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'courtesy', now() + interval '30 days');
select is(pg_temp.d(), '1/0/0.00', 'cortesia (plano Bancada): liberada e fora do MRR, porque nao e cobrada');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000005', 'T80 Recusa', 't80-05@test.local', '92999980005', 't80-05', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000005';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, first_failed_at) values ('80000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', now() - interval '31 days', now() - interval '1 day', now() - interval '1 day');
select is(pg_temp.d(), '1/0/89.90', 'pagamento recusado (past_due): ainda liberada e ainda no MRR enquanto o Mercado Pago tenta cobrar');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000006', 'T80 CanceladaPaga', 't80-06@test.local', '92999980006', 't80-06', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000006';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, canceled_at) values ('80000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', now() - interval '20 days', now() + interval '10 days', now() - interval '3 days');
select is(pg_temp.d(), '1/0/0.00', 'cancelada com periodo pago pela frente: liberada e fora do MRR, porque nao renova');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000007', 'T80 CanceladaSemPeriodo', 't80-07@test.local', '92999980007', 't80-07', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000007';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, canceled_at) values ('80000000-0000-0000-0000-000000000007', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', now() - interval '32 days', now() - interval '2 days', now() - interval '12 days');
select is(pg_temp.d(), '0/1/0.00', 'cancelada com o periodo pago vencido: bloqueada e fora do MRR');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000008', 'T80 Bloqueada', 't80-08@test.local', '92999980008', 't80-08', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000008';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason) values ('80000000-0000-0000-0000-000000000008', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '3 days', 'payment_failed');
select is(pg_temp.d(), '0/1/0.00', 'bloqueada: conta como bloqueada e fica fora do MRR');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000009', 'T80 DesbloqueadaAMao', 't80-09@test.local', '92999980009', 't80-09', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000009';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason, unblocked_until) values ('80000000-0000-0000-0000-000000000009', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '3 days', 'trial_expired', now() + interval '5 days');
select is(pg_temp.d(), '1/0/0.00', 'desbloqueada a mao (Desbloqueio Manual em vigor): conta como liberada, nao como bloqueada');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000010', 'T80 TesteVencidoHoje', 't80-10@test.local', '92999980010', 't80-10', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000010';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at) values ('80000000-0000-0000-0000-000000000010', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() - interval '1 hour');
select is(pg_temp.d(), '0/1/0.00', 'teste vencido hoje, sem bloqueio gravado ainda: ja conta como bloqueada');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000011', 'T80 DescidaAgendada', 't80-11@test.local', '92999980011', 't80-11', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000011';
insert into public.tenant_subscriptions(tenant_id, plan_id, scheduled_plan_id, status, current_period_start, current_period_end) values ('80000000-0000-0000-0000-000000000011', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', now() - interval '5 days', now() + interval '25 days');
select is(pg_temp.d(), '1/0/59.90', 'descida agendada (Bancada para Tesoura): o MRR soma o plano menor, que e o que a proxima cobranca vai cobrar');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000012', 'T80 SemAssinatura', 't80-12@test.local', '92999980012', 't80-12', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000012';
select is(pg_temp.d(), '0/0/0.00', 'barbearia sem linha de assinatura: nao entra em nenhum contador');

select pg_temp.snap();
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone) values ('80000000-0000-0000-0000-000000000013', 'T80 CortesiaVencida', 't80-13@test.local', '92999980013', 't80-13', true, 'America/Sao_Paulo');
delete from public.tenant_subscriptions where tenant_id = '80000000-0000-0000-0000-000000000013';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, courtesy_ends_at) values ('80000000-0000-0000-0000-000000000013', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'courtesy', now() - interval '1 day');
select is(pg_temp.d(), '0/1/0.00', 'cortesia vencida: bloqueada e fora do MRR');

-- B. So o Proprietario le as metricas ---------------------------------------------------------------------------------------------
update public.users set tenant_id = '80000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where id = '80000000-0000-0000-0000-0000000000a2';
update public.users set tenant_id = '80000000-0000-0000-0000-000000000001', role = 'barbeiro', is_active = true where id = '80000000-0000-0000-0000-0000000000a3';

select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', null, 'get_admin_dashboard_metrics recusa o Gerente');
reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', null, 'get_admin_dashboard_metrics recusa o Barbeiro');
reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', null, 'get_admin_dashboard_metrics recusa o Gerente sem barbearia (tenant_id nulo)');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', null, 'get_admin_dashboard_metrics recusa quem nao esta logado (anon)');
reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.get_admin_dashboard_metrics()$$, 'o Proprietario le as metricas');
reset role;

-- C. O faturamento vem das cobrancas aprovadas ------------------------------------------------------------------------------------
select set_config('t80.antes', pg_temp.m()::text, true);

-- ms = primeiro instante do mes corrente em Brasilia. Cada linha diz onde cai: mes corrente, mes anterior, o mais antigo do grafico
-- (11 meses atras), logo antes da janela (12 meses atras) ou 13 meses atras.
with m as (select date_trunc('month', now() at time zone 'America/Sao_Paulo') as ms)
insert into public.billing_charges(tenant_id, amount, charged_at, kind, mp_payment_id, status)
select '80000000-0000-0000-0000-000000000001', v.amount, v.charged_at, v.kind, v.pid, v.status
from m, lateral (values
  (89.90, (m.ms + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-mensalidade', 'approved'),
  (20.00, (m.ms + interval '2 days') at time zone 'America/Sao_Paulo', 'upgrade', 'mp-80-upgrade', 'approved'),
  (11.00, m.ms at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-primeiro-instante', 'approved'),
  (50.00, (m.ms + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-recusada', 'rejected'),
  (40.00, (m.ms + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-em-analise', 'in_process'),
  (30.00, (m.ms + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-estornada', 'refunded'),
  (25.00, (m.ms + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-contestada', 'charged_back'),
  (13.00, (m.ms at time zone 'America/Sao_Paulo') - interval '1 hour', 'recurring', 'mp-80-virada-do-mes', 'approved'),
  (100.00, (m.ms - interval '15 days') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-mes-anterior', 'approved'),
  (60.00, (m.ms - interval '11 months' + interval '5 days') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-onze-meses', 'approved'),
  (70.00, ((m.ms - interval '11 months') at time zone 'America/Sao_Paulo') - interval '1 microsecond', 'recurring', 'mp-80-doze-meses', 'approved'),
  (500.00, (m.ms - interval '13 months' + interval '5 days') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-treze-meses', 'approved')
) as v(amount, charged_at, kind, pid, status);

select set_config('t80.depois', pg_temp.m()::text, true);

select is(
  (current_setting('t80.depois')::jsonb ->> 'revenue_this_month')::numeric - (current_setting('t80.antes')::jsonb ->> 'revenue_this_month')::numeric,
  120.90::numeric,
  'faturamento do mes: soma a mensalidade, a diferenca de plano e a cobranca do primeiro instante do mes; recusada, em analise, estornada e contestada ficam fora'
);
select is(jsonb_array_length(current_setting('t80.depois')::jsonb -> 'revenue_trend'), 12, 'a evolucao da receita tem 12 meses');
select is(
  (current_setting('t80.depois')::jsonb -> 'revenue_trend' -> 0 ->> 'month'),
  to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '11 months', 'YYYY-MM'),
  'o grafico comeca 11 meses atras (mes de Brasilia)'
);
select is(
  (current_setting('t80.depois')::jsonb -> 'revenue_trend' -> 11 ->> 'month'),
  to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo'), 'YYYY-MM'),
  'o grafico termina no mes corrente de Brasilia'
);
select is(
  (current_setting('t80.depois')::jsonb -> 'revenue_trend' -> 11 ->> 'revenue')::numeric,
  (current_setting('t80.depois')::jsonb ->> 'revenue_this_month')::numeric,
  'o ultimo mes do grafico e o cartao do faturamento do mes nunca discordam'
);
select is(
  (current_setting('t80.depois')::jsonb -> 'revenue_trend' -> 10 ->> 'revenue')::numeric - (current_setting('t80.antes')::jsonb -> 'revenue_trend' -> 10 ->> 'revenue')::numeric,
  113.00::numeric,
  'mes anterior: a cobranca das 23h do ultimo dia (02h UTC do dia 1) fica no mes anterior de Brasilia, junto com a do meio do mes'
);
select is(
  (current_setting('t80.depois')::jsonb -> 'revenue_trend' -> 0 ->> 'revenue')::numeric - (current_setting('t80.antes')::jsonb -> 'revenue_trend' -> 0 ->> 'revenue')::numeric,
  60.00::numeric,
  'o mes mais antigo do grafico soma a cobranca dele e nao a do instante anterior a janela'
);
select is(
  (current_setting('t80.depois')::jsonb -> 'revenue_trend' -> 5 ->> 'revenue')::numeric - (current_setting('t80.antes')::jsonb -> 'revenue_trend' -> 5 ->> 'revenue')::numeric,
  0::numeric,
  'mes sem cobranca nova: o valor nao muda (zero no mes vazio, nunca nulo)'
);
select is(
  (select sum((e ->> 'revenue')::numeric) from jsonb_array_elements(current_setting('t80.depois')::jsonb -> 'revenue_trend') e)
    - (select sum((e ->> 'revenue')::numeric) from jsonb_array_elements(current_setting('t80.antes')::jsonb -> 'revenue_trend') e),
  293.90::numeric,
  'o grafico inteiro soma so as aprovadas dos 12 meses: a de 12 e a de 13 meses atras ficam fora'
);
select is(
  (select count(distinct e ->> 'month')::int from jsonb_array_elements(current_setting('t80.depois')::jsonb -> 'revenue_trend') e where e ->> 'revenue' is not null),
  12,
  'os 12 meses do grafico sao distintos e todos trazem valor'
);
select is(
  (select array_agg(k::text order by k) from jsonb_object_keys(current_setting('t80.depois')::jsonb) k),
  array['blocked_tenants', 'mrr', 'released_tenants', 'revenue_this_month', 'revenue_trend'],
  'o contrato novo: liberadas e bloqueadas no lugar de ativas e suspensas'
);

-- D. A tabela de faturas sem escritor saiu do banco (ticket 04), com as policies e os indices dela ---------------------------------
select hasnt_table('public', 'invoices', 'public.invoices nao existe mais: ninguem soma receita de uma tabela sem escritor');
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'invoices'),
  0,
  'e as policies da tabela de faturas sairam junto'
);

select * from finish();
rollback;
