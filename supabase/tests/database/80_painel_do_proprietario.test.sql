begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Spec 054, tickets 02 a 04: metricas do painel do Proprietario (public.get_admin_dashboard_metrics).
-- Ticket 02: "Faturamento do mes" e "Evolucao da receita" somam as cobrancas aprovadas (public.billing_charges, status `approved`,
-- mensalidade `recurring` e diferenca de plano `upgrade`) no mes do calendario de Brasilia (America/Sao_Paulo). Recusada, em analise,
-- estornada e contestada ficam fora. O grafico tem 12 meses, do mais antigo ao atual, com zero no mes sem cobranca, e usa a mesma regra
-- do cartao. So o Proprietario le (Gerente, Barbeiro, anonimo e Gerente com tenant_id nulo recebem 42501).
-- As barbearias de teste que ja existem no DEV mexem nos numeros, entao cada prova compara o valor de antes com o de depois de inserir.

insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone)
values
  ('80000000-0000-0000-0000-000000000001', 'T80 Ativa', 't80-01@test.local', '92999980001', 't80-01', true, 'America/Sao_Paulo');

delete from public.tenant_subscriptions where tenant_id::text like '80000000-0000-0000-0000-0000000000%';
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, updated_at)
values
  ('80000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', now() - interval '5 days', now() + interval '25 days', now() - interval '30 days');

insert into auth.users(id, email)
values
  ('80000000-0000-0000-0000-0000000000a1', 't80-proprietario@test.local'),
  ('80000000-0000-0000-0000-0000000000a2', 't80-gerente@test.local'),
  ('80000000-0000-0000-0000-0000000000a3', 't80-barbeiro@test.local'),
  ('80000000-0000-0000-0000-0000000000a4', 't80-gerente-sem-tenant@test.local');
update public.users set tenant_id = null, role = 'proprietario', is_active = true where id = '80000000-0000-0000-0000-0000000000a1';
update public.users set tenant_id = '80000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where id = '80000000-0000-0000-0000-0000000000a2';
update public.users set tenant_id = '80000000-0000-0000-0000-000000000001', role = 'barbeiro', is_active = true where id = '80000000-0000-0000-0000-0000000000a3';
update public.users set tenant_id = null, role = 'gerente', is_active = true where id = '80000000-0000-0000-0000-0000000000a4';

-- A. So o Proprietario le as metricas ---------------------------------------------------------------------------------------------
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

-- B. O faturamento vem das cobrancas aprovadas ------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.get_admin_dashboard_metrics()$$, 'o Proprietario le as metricas');
select set_config('t80.antes', public.get_admin_dashboard_metrics()::text, true);
reset role;

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

select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select set_config('t80.depois', public.get_admin_dashboard_metrics()::text, true);
reset role;

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
  array['active_tenants', 'mrr', 'revenue_this_month', 'revenue_trend', 'suspended_tenants'],
  'o contrato deste ticket nao mudou'
);

select * from finish();
rollback;
