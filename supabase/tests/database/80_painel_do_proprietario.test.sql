begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Spec 054, tickets 02 a 04: metricas do painel do Proprietario (public.get_admin_dashboard_metrics).
-- Ticket 02: "Faturamento do mes" e "Evolucao da receita" somam as cobrancas aprovadas (public.billing_charges, status `approved`,
-- mensalidade `recurring` e diferenca de plano `upgrade`) no mes do calendario de Brasilia (America/Sao_Paulo). Recusada, em analise,
-- estornada e contestada ficam fora. O grafico tem 12 meses, do mais antigo ao atual, com zero no mes sem cobranca, e usa a mesma regra
-- do cartao. So o Proprietario le (Gerente, Barbeiro, anonimo e Gerente com tenant_id nulo recebem 42501).
-- Ticket 03: o MRR soma o preco do plano que a proxima cobranca vai cobrar das assinaturas `active` e `past_due` (o plano agendado,
-- quando ha descida agendada) e da `canceled` que assinou de novo e teve a assinatura nova autorizada (Estado de Acesso `allowed` com o
-- motivo `active`: a cobranca recomeca no fim do periodo pago); "liberadas" e "bloqueadas" contam pelo Estado de Acesso de agora (private.subscription_access_state), e
-- barbearia sem assinatura nao entra em nenhum contador.
-- Ticket 04: a tabela public.invoices, que nenhum codigo gravava, saiu do banco.
-- As barbearias de teste que ja existem no DEV mexem nos numeros, entao cada prova compara o valor de antes com o de depois de
-- inserir; o preco de cada plano vem da tabela plans (pg_temp.preco), e nao de um numero fixo. Planos: Tesoura (b3fa...c11),
-- Maquina (c22) e Bancada (c33).

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
create function pg_temp.metricas() returns jsonb language sql as $$ select public.get_admin_dashboard_metrics()::jsonb $$;
create function pg_temp.tirar_foto() returns void language plpgsql as $$ begin perform set_config('t80.foto', pg_temp.metricas()::text, true); end $$;
-- O que mudou desde a ultima foto, nos tres contadores. Cada um aparece com o nome na falha da comparacao.
create function pg_temp.diferenca_desde_a_foto() returns text language sql as $$
  select 'liberadas=' || ((pg_temp.metricas() ->> 'released_tenants')::int - (current_setting('t80.foto')::jsonb ->> 'released_tenants')::int)::text
    || ' bloqueadas=' || ((pg_temp.metricas() ->> 'blocked_tenants')::int - (current_setting('t80.foto')::jsonb ->> 'blocked_tenants')::int)::text
    || ' mrr=' || to_char((pg_temp.metricas() ->> 'mrr')::numeric - (current_setting('t80.foto')::jsonb ->> 'mrr')::numeric, 'FM999990.00')
$$;
create function pg_temp.preco(p_plano uuid) returns text language sql as $$ select to_char(price, 'FM999990.00') from public.plans where id = p_plano $$;
-- Uma barbearia de teste (T80 NN) sem a assinatura que o banco cria sozinho; cada caso insere a dele logo depois.
create function pg_temp.nova_barbearia(p_n int, p_nome text) returns void language plpgsql as $$
declare
  v_sufixo text := lpad(p_n::text, 2, '0');
  v_id uuid := format('80000000-0000-0000-0000-%s', lpad(p_n::text, 12, '0'))::uuid;
begin
  insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone)
  values (v_id, 'T80 ' || p_nome, 't80-' || v_sufixo || '@test.local', '929999800' || v_sufixo, 't80-' || v_sufixo, true, 'America/Sao_Paulo');
  delete from public.tenant_subscriptions where tenant_id = v_id;
end $$;
-- Quanto o mes `p_posicao` do grafico (0 = o mais antigo, 11 = o corrente) mudou entre as fotos `antes` e `depois` da secao C.
create function pg_temp.delta_do_mes(p_posicao int) returns numeric language sql as $$
  select (current_setting('t80.depois')::jsonb -> 'revenue_trend' -> p_posicao ->> 'revenue')::numeric
    - (current_setting('t80.antes')::jsonb -> 'revenue_trend' -> p_posicao ->> 'revenue')::numeric
$$;

-- A. Contadores e MRR, uma barbearia por caso (liberadas/bloqueadas/mrr que cada uma acrescenta) ---------------------------------
select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(1, 'Ativa');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end) values ('80000000-0000-0000-0000-000000000001', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'active', now() - interval '5 days', now() + interval '25 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=' || pg_temp.preco('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'), 'ativa (Maquina): liberada e soma o plano no MRR');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(2, 'Teste');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at) values ('80000000-0000-0000-0000-000000000002', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() + interval '10 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=0.00', 'em teste: liberada e fora do MRR');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(3, 'TesteAcabando');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at) values ('80000000-0000-0000-0000-000000000003', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() + interval '2 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=0.00', 'teste terminando (aviso): ainda liberada e fora do MRR');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(4, 'Cortesia');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, courtesy_ends_at) values ('80000000-0000-0000-0000-000000000004', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'courtesy', now() + interval '30 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=0.00', 'cortesia (plano Bancada): liberada e fora do MRR, porque nao e cobrada');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(5, 'Recusa');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, first_failed_at) values ('80000000-0000-0000-0000-000000000005', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', now() - interval '31 days', now() - interval '1 day', now() - interval '1 day');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=' || pg_temp.preco('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'), 'pagamento recusado (past_due): ainda liberada e ainda no MRR enquanto o Mercado Pago tenta cobrar');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(6, 'CanceladaPaga');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, canceled_at) values ('80000000-0000-0000-0000-000000000006', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', now() - interval '20 days', now() + interval '10 days', now() - interval '3 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=0.00', 'cancelada com periodo pago pela frente: liberada e fora do MRR, porque nao renova');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(7, 'CanceladaSemPeriodo');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, canceled_at) values ('80000000-0000-0000-0000-000000000007', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', now() - interval '32 days', now() - interval '2 days', now() - interval '12 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=0 bloqueadas=1 mrr=0.00', 'cancelada com o periodo pago vencido: bloqueada e fora do MRR');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(8, 'Bloqueada');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason) values ('80000000-0000-0000-0000-000000000008', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '3 days', 'payment_failed');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=0 bloqueadas=1 mrr=0.00', 'bloqueada: conta como bloqueada e fica fora do MRR');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(9, 'DesbloqueadaAMao');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, blocked_at, blocked_reason, unblocked_until) values ('80000000-0000-0000-0000-000000000009', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'blocked', now() - interval '3 days', 'trial_expired', now() + interval '5 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=0.00', 'desbloqueada a mao (Desbloqueio Manual em vigor): conta como liberada, nao como bloqueada');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(10, 'TesteVencidoHoje');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, trial_ends_at) values ('80000000-0000-0000-0000-000000000010', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'trialing', now() - interval '1 hour');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=0 bloqueadas=1 mrr=0.00', 'teste vencido hoje, sem bloqueio gravado ainda: ja conta como bloqueada');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(11, 'DescidaAgendada');
insert into public.tenant_subscriptions(tenant_id, plan_id, scheduled_plan_id, status, current_period_start, current_period_end) values ('80000000-0000-0000-0000-000000000011', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c33', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c11', 'active', now() - interval '5 days', now() + interval '25 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=' || pg_temp.preco('b3fa7384-d113-4a1b-a5ed-1efeb7e51c11'), 'descida agendada (Bancada para Tesoura): o MRR soma o plano menor, que e o que a proxima cobranca vai cobrar');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(12, 'SemAssinatura');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=0 bloqueadas=0 mrr=0.00', 'barbearia sem linha de assinatura: nao entra em nenhum contador');

select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(13, 'CortesiaVencida');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, courtesy_ends_at) values ('80000000-0000-0000-0000-000000000013', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'courtesy', now() - interval '1 day');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=0 bloqueadas=1 mrr=0.00', 'cortesia vencida: bloqueada e fora do MRR');

-- Recusa de 6 dias que a rotina diaria ainda nao gravou como bloqueio: o Estado de Acesso ja e `blocked` (5 dias depois da primeira
-- recusa), mas a situacao segue `past_due`, e o MRR da spec soma toda assinatura `active` ou `past_due`. Os dois contadores concordam
-- com o que cada um mede (acesso x cobranca): bloqueada e ainda no MRR.
select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(14, 'RecusaAntiga');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, first_failed_at) values ('80000000-0000-0000-0000-000000000014', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'past_due', now() - interval '36 days', now() - interval '6 days', now() - interval '6 days');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=0 bloqueadas=1 mrr=' || pg_temp.preco('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'), 'recusa de 6 dias (acesso ja bloqueado, ainda past_due): conta como bloqueada e segue no MRR');

-- Cancelada que assinou de novo e teve a assinatura nova autorizada (sem canceled_at, com o Mercado Pago e o cartao): o Estado de Acesso
-- e `allowed/active` e a cobranca recomeca no fim do periodo pago, entao entra no MRR pelo plano atual. A cancelada do caso 6 (sem
-- assinatura nova) continua fora.
select pg_temp.tirar_foto();
select pg_temp.nova_barbearia(15, 'CanceladaQueAssinouDeNovo');
insert into public.tenant_subscriptions(tenant_id, plan_id, status, current_period_start, current_period_end, canceled_at, mp_subscription_id, card_brand) values ('80000000-0000-0000-0000-000000000015', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22', 'canceled', now() - interval '20 days', now() + interval '10 days', null, 'mp-80-assinou-de-novo', 'visa');
select is(pg_temp.diferenca_desde_a_foto(), 'liberadas=1 bloqueadas=0 mrr=' || pg_temp.preco('b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'), 'cancelada que assinou de novo (assinatura nova autorizada): liberada e no MRR, porque a cobranca recomeca no fim do periodo pago');

-- B. So o Proprietario le as metricas ---------------------------------------------------------------------------------------------
update public.users set tenant_id = '80000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where id = '80000000-0000-0000-0000-0000000000a2';
update public.users set tenant_id = '80000000-0000-0000-0000-000000000001', role = 'barbeiro', is_active = true where id = '80000000-0000-0000-0000-0000000000a3';

select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', 'ADMIN_ONLY', 'get_admin_dashboard_metrics recusa o Gerente com ADMIN_ONLY');
reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', 'ADMIN_ONLY', 'get_admin_dashboard_metrics recusa o Barbeiro com ADMIN_ONLY');
reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', 'ADMIN_ONLY', 'get_admin_dashboard_metrics recusa o Gerente sem barbearia (tenant_id nulo) com ADMIN_ONLY');
reset role;
-- O anonimo nem chega na guarda: nao tem EXECUTE na funcao (permission denied, tambem 42501).
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$select public.get_admin_dashboard_metrics()$$, '42501', null, 'get_admin_dashboard_metrics recusa quem nao esta logado (anon)');
reset role;
select set_config('request.jwt.claim.sub', '80000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.get_admin_dashboard_metrics()$$, 'o Proprietario le as metricas');
reset role;

-- C. O faturamento vem das cobrancas aprovadas ------------------------------------------------------------------------------------
select set_config('t80.antes', pg_temp.metricas()::text, true);

-- mes.inicio = primeiro instante do mes corrente em Brasilia. Cada linha diz onde cai: mes corrente, mes seguinte (fora), mes anterior,
-- o mais antigo do grafico (11 meses atras), logo antes da janela (12 meses atras) ou 13 meses atras.
with mes as (select date_trunc('month', now() at time zone 'America/Sao_Paulo') as inicio)
insert into public.billing_charges(tenant_id, amount, charged_at, kind, mp_payment_id, status)
select '80000000-0000-0000-0000-000000000001', v.amount, v.charged_at, v.kind, v.pid, v.status
from mes, lateral (values
  (89.90, (mes.inicio + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-mensalidade', 'approved'),
  (20.00, (mes.inicio + interval '2 days') at time zone 'America/Sao_Paulo', 'upgrade', 'mp-80-upgrade', 'approved'),
  (11.00, mes.inicio at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-primeiro-instante', 'approved'),
  (7.00, (mes.inicio + interval '1 month') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-mes-seguinte', 'approved'),
  (50.00, (mes.inicio + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-recusada', 'rejected'),
  (40.00, (mes.inicio + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-em-analise', 'in_process'),
  (30.00, (mes.inicio + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-estornada', 'refunded'),
  (25.00, (mes.inicio + interval '1 day') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-contestada', 'charged_back'),
  (13.00, (mes.inicio at time zone 'America/Sao_Paulo') - interval '1 hour', 'recurring', 'mp-80-virada-do-mes', 'approved'),
  (100.00, (mes.inicio - interval '15 days') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-mes-anterior', 'approved'),
  (60.00, (mes.inicio - interval '11 months' + interval '5 days') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-onze-meses', 'approved'),
  (70.00, ((mes.inicio - interval '11 months') at time zone 'America/Sao_Paulo') - interval '1 microsecond', 'recurring', 'mp-80-doze-meses', 'approved'),
  (500.00, (mes.inicio - interval '13 months' + interval '5 days') at time zone 'America/Sao_Paulo', 'recurring', 'mp-80-treze-meses', 'approved')
) as v(amount, charged_at, kind, pid, status);

select set_config('t80.depois', pg_temp.metricas()::text, true);

select is(
  (current_setting('t80.depois')::jsonb ->> 'revenue_this_month')::numeric - (current_setting('t80.antes')::jsonb ->> 'revenue_this_month')::numeric,
  120.90::numeric,
  'faturamento do mes: soma a mensalidade, a diferenca de plano e a cobranca do primeiro instante do mes; recusada, em analise, estornada, contestada e a do primeiro instante do mes seguinte ficam fora'
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
  pg_temp.delta_do_mes(10),
  113.00::numeric,
  'mes anterior: a cobranca das 23h do ultimo dia (02h UTC do dia 1) fica no mes anterior de Brasilia, junto com a do meio do mes'
);
select is(
  pg_temp.delta_do_mes(0),
  60.00::numeric,
  'o mes mais antigo do grafico soma a cobranca dele e nao a do instante anterior a janela'
);
select is(
  pg_temp.delta_do_mes(5),
  0::numeric,
  'mes sem cobranca nova: o valor nao muda'
);
select is(
  (select sum((e ->> 'revenue')::numeric) from jsonb_array_elements(current_setting('t80.depois')::jsonb -> 'revenue_trend') e)
    - (select sum((e ->> 'revenue')::numeric) from jsonb_array_elements(current_setting('t80.antes')::jsonb -> 'revenue_trend') e),
  293.90::numeric,
  'o grafico inteiro soma so as aprovadas dos 12 meses: a de 12 e a de 13 meses atras ficam fora'
);
-- Prova independente do zero: cada mes do grafico e comparado com a soma das aprovadas daquele mes lida direto da tabela. Onde nao ha
-- cobranca aprovada, a soma e 0 e o grafico tem de mostrar 0 (nao nulo, nem mes faltando).
select is(
  (select jsonb_agg(jsonb_build_object('mes', e ->> 'month', 'valor', (e ->> 'revenue')::numeric) order by e ->> 'month') from jsonb_array_elements(current_setting('t80.depois')::jsonb -> 'revenue_trend') e),
  (select jsonb_agg(
      jsonb_build_object(
        'mes', to_char(g, 'YYYY-MM'),
        'valor', coalesce((select sum(c.amount) from public.billing_charges c where c.status = 'approved' and to_char(c.charged_at at time zone 'America/Sao_Paulo', 'YYYY-MM') = to_char(g, 'YYYY-MM')), 0)
      ) order by g)
   from generate_series(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '11 months', date_trunc('month', now() at time zone 'America/Sao_Paulo'), interval '1 month') g),
  'cada um dos 12 meses do grafico bate com a soma independente das aprovadas do mes, e o mes sem cobranca vale zero'
);
select is(
  (select array_agg(k::text order by k) from jsonb_object_keys(current_setting('t80.depois')::jsonb) k),
  array['blocked_tenants', 'mrr', 'released_tenants', 'revenue_this_month', 'revenue_trend'],
  'o contrato novo: liberadas e bloqueadas no lugar de ativas e suspensas'
);
select is(
  (select array_agg(k::text order by k) from jsonb_object_keys(current_setting('t80.depois')::jsonb -> 'revenue_trend' -> 0) k),
  array['month', 'revenue'],
  'cada mes do grafico traz so month e revenue: o rotulo em ingles do banco (month_label) saiu da RPC'
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
