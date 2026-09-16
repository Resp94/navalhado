begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

-- Spec 038 (Modulo de Relatorios), ticket 09: Visita (segunda regra de
-- dominio compartilhada da spec) e Clientes sem Retorno (relatorio 8,
-- fotografia de hoje, sem periodo). Cobre private.report_customer_visits,
-- private.get_customers_without_return_core (relogio duplo injetado) e
-- public.get_customers_without_return.

create temporary table t09_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  tenant_c_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  gerente_b_id uuid not null,
  gerente_nulo_id uuid not null,
  proprietario_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t09_tenant_a__', '__t09_tenant_a__@teste.com', '11999981001', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t09_tenant_b__', '__t09_tenant_b__@teste.com', '11999981002', 'America/Sao_Paulo')
  returning id
), tc as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t09_tenant_c__', '__t09_tenant_c__@teste.com', '11999981003', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t09_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t09_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t09_gerente_b__@teste.com') returning id
), au_gerente_nulo as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t09_gerente_nulo__@teste.com') returning id
), au_proprietario as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t09_proprietario__@teste.com') returning id
)
insert into t09_context (
  tenant_a_id, tenant_b_id, tenant_c_id, gerente_a_id, barbeiro_a_id, gerente_b_id, gerente_nulo_id, proprietario_id
)
select ta.id, tb.id, tc.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, au_gerente_nulo.id, au_proprietario.id
from ta, tb, tc, au_gerente_a, au_barbeiro_a, au_gerente_b, au_gerente_nulo, au_proprietario;

update public.users set tenant_id = (select tenant_a_id from t09_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from t09_context);
update public.users set tenant_id = (select tenant_a_id from t09_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from t09_context);
update public.users set tenant_id = (select tenant_b_id from t09_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from t09_context);
update public.users set tenant_id = null, role = 'gerente', is_active = true
where id = (select gerente_nulo_id from t09_context);
update public.users set tenant_id = (select tenant_c_id from t09_context), role = 'proprietario', is_active = true
where id = (select proprietario_id from t09_context);

grant select on t09_context to authenticated;

-- Expediente aberto o dia inteiro nos tres tenants usados, so para permitir
-- a insercao de Agendamentos de fixture em qualquer horario (mesmo truque
-- dos tickets 07/08) -- nao muda a regra do relatorio, que nao depende de
-- expediente.
update public.tenants
set business_hours = jsonb_build_object(
  'segunda', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'terca', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'quarta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'quinta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'sexta', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'sabado', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true),
  'domingo', jsonb_build_object('open', '00:00', 'close', '23:59', 'active', true)
)
where id in (select tenant_a_id from t09_context union select tenant_b_id from t09_context);

-- ---------------------------------------------------------------------------
-- Contrato das funcoes: existencia, search_path vazio, privilegios.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'get_customers_without_return', array['uuid', 'text', 'uuid', 'integer', 'integer'],
  'public.get_customers_without_return(uuid, text, uuid, integer, integer) existe'
);
select has_function(
  'private', 'get_customers_without_return_core', array['uuid', 'text', 'uuid', 'integer', 'integer', 'date', 'timestamptz', 'text'],
  'private.get_customers_without_return_core(...) existe'
);
select has_function(
  'private', 'report_customer_visits', array['uuid', 'text'],
  'private.report_customer_visits(uuid, text) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_customers_without_return(uuid,text,uuid,integer,integer)'::regprocedure),
  'a funcao publica fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.get_customers_without_return_core(uuid,text,uuid,integer,integer,date,timestamptz,text)'::regprocedure),
  'o nucleo privado fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.report_customer_visits(uuid,text)'::regprocedure),
  'a funcao de Visita fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'public.get_customers_without_return(uuid,text,uuid,integer,integer)', 'EXECUTE'),
  'anon nao executa a funcao publica'
);
select ok(
  has_function_privilege('authenticated', 'public.get_customers_without_return(uuid,text,uuid,integer,integer)', 'EXECUTE'),
  'authenticated executa a funcao publica'
);
select ok(
  has_function_privilege('service_role', 'public.get_customers_without_return(uuid,text,uuid,integer,integer)', 'EXECUTE'),
  'service_role executa a funcao publica'
);

select ok(
  not has_function_privilege('anon', 'private.get_customers_without_return_core(uuid,text,uuid,integer,integer,date,timestamptz,text)', 'EXECUTE'),
  'anon nao executa o nucleo privado'
);
select ok(
  not has_function_privilege('authenticated', 'private.get_customers_without_return_core(uuid,text,uuid,integer,integer,date,timestamptz,text)', 'EXECUTE'),
  'authenticated nao executa o nucleo privado diretamente'
);
select ok(
  has_function_privilege('service_role', 'private.get_customers_without_return_core(uuid,text,uuid,integer,integer,date,timestamptz,text)', 'EXECUTE'),
  'service_role executa o nucleo privado'
);

select ok(
  not has_function_privilege('anon', 'private.report_customer_visits(uuid,text)', 'EXECUTE'),
  'anon nao executa a funcao de Visita'
);
select ok(
  not has_function_privilege('authenticated', 'private.report_customer_visits(uuid,text)', 'EXECUTE'),
  'authenticated nao executa a funcao de Visita'
);
select ok(
  not has_function_privilege('service_role', 'private.report_customer_visits(uuid,text)', 'EXECUTE'),
  'service_role nao executa a funcao de Visita diretamente (sem grant algum -- so a chamada interna do nucleo, dono do mesmo owner, funciona)'
);

-- ---------------------------------------------------------------------------
-- Acesso: barbeiro recusado, gerente pedindo outro tenant recusado, gerente
-- com tenant nulo recusado, proprietario aceito para qualquer tenant.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from t09_context), true);
set local role authenticated;
select throws_ok(
  $$select public.get_customers_without_return(null)$$,
  '42501',
  'Acesso negado. Apenas gerentes podem acessar os relatórios.',
  'barbeiro recebe erro de acesso'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from t09_context), true);
set local role authenticated;
select throws_ok(
  format($$select public.get_customers_without_return('%s'::uuid)$$, (select tenant_b_id from t09_context)),
  '42501',
  'Acesso negado para a unidade solicitada.',
  'gerente pedindo outro tenant e recusado'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_nulo_id::text from t09_context), true);
set local role authenticated;
select throws_ok(
  format($$select public.get_customers_without_return('%s'::uuid)$$, (select tenant_a_id from t09_context)),
  '42501',
  'Acesso negado. Gerente sem unidade vinculada.',
  'gerente com tenant nulo e recusado, mesmo pedindo um tenant valido'
);
reset role;

select set_config('request.jwt.claim.sub', (select proprietario_id::text from t09_context), true);
set local role authenticated;
select ok(
  (select public.get_customers_without_return((select tenant_a_id from t09_context))) ? 'totals',
  'proprietario acessa o relatorio de qualquer unidade'
);
reset role;

-- ---------------------------------------------------------------------------
-- Validacao de parametros (via nucleo, mesmas mensagens da funcao publica).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select private.get_customers_without_return_core('00000000-0000-0000-0000-000000000001'::uuid, null, null, 0, 0, '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'O limite deve estar entre 1 e 100.', 'p_limit abaixo de 1 e recusado'
);
select throws_ok(
  $$select private.get_customers_without_return_core('00000000-0000-0000-0000-000000000001'::uuid, null, null, 101, 0, '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'O limite deve estar entre 1 e 100.', 'p_limit acima de 100 e recusado'
);
select throws_ok(
  $$select private.get_customers_without_return_core('00000000-0000-0000-0000-000000000001'::uuid, null, null, 50, -1, '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'O deslocamento não pode ser negativo.', 'p_offset negativo e recusado'
);
select throws_ok(
  $$select private.get_customers_without_return_core('00000000-0000-0000-0000-000000000001'::uuid, 'faixa_invalida', null, 50, 0, '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo')$$,
  '22023', 'Faixa de atraso desconhecida. Use até 15, 16 a 30, 31 a 60 ou mais de 60 dias.', 'p_overdue_band invalido e recusado'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from t09_context), true);
set local role authenticated;
select throws_ok(
  format($$select public.get_customers_without_return('%s'::uuid, null, null, 0, 0)$$, (select tenant_a_id from t09_context)),
  '22023', 'O limite deve estar entre 1 e 100.', 'a funcao publica tambem valida p_limit'
);
reset role;

-- ---------------------------------------------------------------------------
-- Regras de dominio (tenant_a): prazo pelo menor servico, prazo padrao 20,
-- Agendamento futuro confirmed (fora) e canceled (dentro), Visita de balcao,
-- Agendamento + Comanda no mesmo dia como uma Visita so.
-- Relogio fixo: p_today = 2026-09-16, p_now = 2026-09-16 12:00:00-03.
-- ---------------------------------------------------------------------------
create temporary table t09_services (
  servico_10_id uuid not null,
  servico_30_id uuid not null,
  servico_20_id uuid not null,
  servico_15_id uuid not null
) on commit drop;
insert into t09_services (servico_10_id, servico_30_id, servico_20_id, servico_15_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
grant select on t09_services to authenticated;

insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active, return_period_days)
select servico_10_id, (select tenant_a_id from t09_context), '__t09_servico_10__', 50, 30, 'Corte', true, 10 from t09_services;
insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active, return_period_days)
select servico_30_id, (select tenant_a_id from t09_context), '__t09_servico_30__', 80, 30, 'Corte', true, 30 from t09_services;
insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active, return_period_days)
select servico_20_id, (select tenant_a_id from t09_context), '__t09_servico_20__', 60, 30, 'Corte', true, 20 from t09_services;
insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active, return_period_days)
select servico_15_id, (select tenant_a_id from t09_context), '__t09_servico_15__', 40, 30, 'Corte', true, 15 from t09_services;

create temporary table t09_profs (
  prof_a_id uuid not null,
  prof_b_id uuid not null
) on commit drop;
insert into t09_profs (prof_a_id, prof_b_id) values (gen_random_uuid(), gen_random_uuid());
grant select on t09_profs to authenticated;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_a_id, (select tenant_a_id from t09_context), '__t09_prof_a__', '11999971001', 30, true from t09_profs;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_b_id, (select tenant_a_id from t09_context), '__t09_prof_b__', '11999971002', 30, true from t09_profs;

create temporary table t09_customers (
  cli_menor_prazo_id uuid not null,
  cli_sem_servico_id uuid not null,
  cli_confirmed_futuro_id uuid not null,
  cli_canceled_futuro_id uuid not null,
  cli_balcao_id uuid not null,
  cli_mesmo_dia_id uuid not null,
  cli_servico_e_produto_mesmo_dia_id uuid not null
) on commit drop;
insert into t09_customers (
  cli_menor_prazo_id, cli_sem_servico_id, cli_confirmed_futuro_id, cli_canceled_futuro_id, cli_balcao_id, cli_mesmo_dia_id,
  cli_servico_e_produto_mesmo_dia_id
) values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid()
);
grant select on t09_customers to authenticated;

insert into public.customers (id, tenant_id, name, phone)
select cli_menor_prazo_id, (select tenant_a_id from t09_context), '__t09_cli_menor_prazo__', '11988880001' from t09_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_sem_servico_id, (select tenant_a_id from t09_context), '__t09_cli_sem_servico__', '11988880002' from t09_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_confirmed_futuro_id, (select tenant_a_id from t09_context), '__t09_cli_confirmed_futuro__', '11988880003' from t09_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_canceled_futuro_id, (select tenant_a_id from t09_context), '__t09_cli_canceled_futuro__', '11988880004' from t09_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_balcao_id, (select tenant_a_id from t09_context), '__t09_cli_balcao__', '11988880005' from t09_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_mesmo_dia_id, (select tenant_a_id from t09_context), '__t09_cli_mesmo_dia__', '11988880006' from t09_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_servico_e_produto_mesmo_dia_id, (select tenant_a_id from t09_context), '__t09_cli_servico_e_produto_mesmo_dia__', '11988880007' from t09_customers;

-- cli_menor_prazo: Comanda fechada 2026-08-01 com 2 itens de servico de
-- prazos diferentes (10 e 30) -- prazo da Visita deve ser o menor (10).
create temporary table t09_fix1 (comanda_id uuid not null, item_10_id uuid not null, item_30_id uuid not null) on commit drop;
insert into t09_fix1 (comanda_id, item_10_id, item_30_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t09_context), (select cli_menor_prazo_id from t09_customers), 'fechada', 130, 0, 0,
  '2026-08-01 10:00:00-03'::timestamptz
from t09_fix1;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select item_10_id, comanda_id, (select tenant_a_id from t09_context), 'servico', (select servico_10_id from t09_services), (select prof_a_id from t09_profs), 1, 50, 50, 'unavailable'
from t09_fix1;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select item_30_id, comanda_id, (select tenant_a_id from t09_context), 'servico', (select servico_30_id from t09_services), (select prof_a_id from t09_profs), 1, 80, 80, 'unavailable'
from t09_fix1;

-- cli_sem_servico: Comanda fechada 2026-07-01 so com item de produto (sem
-- servico identificavel) -- prazo padrao 20.
create temporary table t09_fix2 (comanda_id uuid not null, item_id uuid not null) on commit drop;
insert into t09_fix2 (comanda_id, item_id) values (gen_random_uuid(), gen_random_uuid());
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t09_context), (select cli_sem_servico_id from t09_customers), 'fechada', 30, 0, 0,
  '2026-07-01 10:00:00-03'::timestamptz
from t09_fix2;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_id, comanda_id, (select tenant_a_id from t09_context), 'produto', 1, 30, 30, 'unavailable'
from t09_fix2;

-- cli_confirmed_futuro: Visita muito atrasada (2026-01-01, prazo 20) e
-- Agendamento confirmed futuro (2026-09-20 > p_now) -- deve ficar fora da
-- lista de sem retorno (within_return).
create temporary table t09_fix3 (comanda_id uuid not null, item_id uuid not null, ap_id uuid not null) on commit drop;
insert into t09_fix3 (comanda_id, item_id, ap_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t09_context), (select cli_confirmed_futuro_id from t09_customers), 'fechada', 60, 0, 0,
  '2026-01-01 10:00:00-03'::timestamptz
from t09_fix3;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select item_id, comanda_id, (select tenant_a_id from t09_context), 'servico', (select servico_20_id from t09_services), (select prof_a_id from t09_profs), 1, 60, 60, 'unavailable'
from t09_fix3;
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
select ap_id, (select tenant_a_id from t09_context), (select cli_confirmed_futuro_id from t09_customers), (select prof_a_id from t09_profs), (select servico_20_id from t09_services),
  '2026-09-20 10:00:00-03'::timestamptz, '2026-09-20 10:30:00-03'::timestamptz, 'confirmed', 'pending', 'manual'
from t09_fix3;

-- cli_canceled_futuro: mesma Visita atrasada, mas o Agendamento futuro esta
-- canceled -- nao impede aparecer como sem retorno.
create temporary table t09_fix4 (comanda_id uuid not null, item_id uuid not null, ap_id uuid not null) on commit drop;
insert into t09_fix4 (comanda_id, item_id, ap_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t09_context), (select cli_canceled_futuro_id from t09_customers), 'fechada', 60, 0, 0,
  '2026-01-01 10:00:00-03'::timestamptz
from t09_fix4;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select item_id, comanda_id, (select tenant_a_id from t09_context), 'servico', (select servico_20_id from t09_services), (select prof_a_id from t09_profs), 1, 60, 60, 'unavailable'
from t09_fix4;
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
select ap_id, (select tenant_a_id from t09_context), (select cli_canceled_futuro_id from t09_customers), (select prof_a_id from t09_profs), (select servico_20_id from t09_services),
  '2026-09-20 10:00:00-03'::timestamptz, '2026-09-20 10:30:00-03'::timestamptz, 'canceled', 'pending', 'manual'
from t09_fix4;

-- cli_balcao: Comanda fechada sem nenhum Agendamento (atendimento de
-- balcao) -- conta como ultima Visita normalmente, com o profissional do
-- item.
create temporary table t09_fix5 (comanda_id uuid not null, item_id uuid not null) on commit drop;
insert into t09_fix5 (comanda_id, item_id) values (gen_random_uuid(), gen_random_uuid());
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t09_context), (select cli_balcao_id from t09_customers), 'fechada', 40, 0, 0,
  '2026-08-10 10:00:00-03'::timestamptz
from t09_fix5;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select item_id, comanda_id, (select tenant_a_id from t09_context), 'servico', (select servico_15_id from t09_services), (select prof_b_id from t09_profs), 1, 40, 40, 'unavailable'
from t09_fix5;

-- cli_mesmo_dia: Agendamento completed E Comanda fechada no MESMO dia
-- (2026-08-05) -- deve virar uma Visita so.
create temporary table t09_fix6 (comanda_id uuid not null, item_id uuid not null, ap_id uuid not null) on commit drop;
insert into t09_fix6 (comanda_id, item_id, ap_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
select ap_id, (select tenant_a_id from t09_context), (select cli_mesmo_dia_id from t09_customers), (select prof_a_id from t09_profs), (select servico_20_id from t09_services),
  '2026-08-05 09:00:00-03'::timestamptz, '2026-08-05 09:30:00-03'::timestamptz, 'completed', 'pending', 'manual'
from t09_fix6;
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t09_context), (select cli_mesmo_dia_id from t09_customers), 'fechada', 60, 0, 0,
  '2026-08-05 15:00:00-03'::timestamptz
from t09_fix6;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select item_id, comanda_id, (select tenant_a_id from t09_context), 'servico', (select servico_10_id from t09_services), (select prof_a_id from t09_profs), 1, 50, 50, 'unavailable'
from t09_fix6;

-- cli_servico_e_produto_mesmo_dia: Agendamento completed com servico real
-- (servico_10, prazo 10) e, no MESMO dia, Comanda fechada que so vendeu
-- PRODUTO (sem item de servico) -- regressao da revisao do ticket 09: a
-- existencia isolada da Comanda (sem servico) nao pode mascarar o servico
-- real do Agendamento, o prazo/servico devem vir do Agendamento (10 dias),
-- nunca cair no padrao de 20 por engano. Cobre tambem, de quebra, a segunda
-- correcao da revisao: o gatilho fn_auto_create_comanda_for_appointment
-- (migracao 024) cria, junto com este mesmo Agendamento completed, uma
-- Comanda fechada auto-gerada SEM closed_at -- se report_customer_visits nao
-- excluir Comanda sem closed_at, essa linha fantasma (business_day nulo)
-- venceria a ultima Visita e o cliente sumiria do relatorio inteiro.
create temporary table t09_fix7 (comanda_id uuid not null, item_id uuid not null, ap_id uuid not null) on commit drop;
insert into t09_fix7 (comanda_id, item_id, ap_id) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
select ap_id, (select tenant_a_id from t09_context), (select cli_servico_e_produto_mesmo_dia_id from t09_customers), (select prof_a_id from t09_profs), (select servico_10_id from t09_services),
  '2026-08-06 09:00:00-03'::timestamptz, '2026-08-06 09:30:00-03'::timestamptz, 'completed', 'pending', 'manual'
from t09_fix7;
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t09_context), (select cli_servico_e_produto_mesmo_dia_id from t09_customers), 'fechada', 30, 0, 0,
  '2026-08-06 15:00:00-03'::timestamptz
from t09_fix7;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_id, comanda_id, (select tenant_a_id from t09_context), 'produto', 1, 30, 30, 'unavailable'
from t09_fix7;

-- ---------------------------------------------------------------------------
-- Asserts das regras de dominio (tenant_a), relogio fixo.
-- ---------------------------------------------------------------------------
select is(
  (
    select (i ->> 'return_period_days')::int
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_a_id from t09_context), null, null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_menor_prazo_id from t09_customers)
  ),
  10,
  'prazo da Visita e o MENOR return_period_days entre os servicos (10, nao 30)'
);

select is(
  (
    select (i ->> 'return_period_days')::int
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_a_id from t09_context), null, null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_sem_servico_id from t09_customers)
  ),
  20,
  'sem servico identificavel na Visita, o prazo padrao e 20 dias'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_a_id from t09_context), null, null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_confirmed_futuro_id from t09_customers)
  ),
  0::bigint,
  'cliente com Agendamento confirmed futuro fica fora da lista de sem retorno, mesmo com Visita antiga'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_a_id from t09_context), null, null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_canceled_futuro_id from t09_customers)
  ),
  1::bigint,
  'cliente com Agendamento canceled futuro CONTINUA na lista de sem retorno (cancelado nao conta)'
);

select is(
  (
    select jsonb_build_object('last_visit_date', i ->> 'last_visit_date', 'last_professional_name', i ->> 'last_professional_name')
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_a_id from t09_context), null, null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_balcao_id from t09_customers)
  ),
  jsonb_build_object('last_visit_date', '2026-08-10', 'last_professional_name', '__t09_prof_b__'),
  'Visita de balcao (Comanda fechada sem Agendamento) conta como ultima Visita, com o profissional do item'
);

select is(
  (
    select count(*)
    from private.report_customer_visits((select tenant_a_id from t09_context), 'America/Sao_Paulo') v
    where v.customer_id = (select cli_mesmo_dia_id from t09_customers)
      and v.business_day = '2026-08-05'::date
  ),
  1::bigint,
  'Agendamento completed e Comanda fechada no MESMO dia contam como uma Visita so (uma linha, nao duas)'
);

-- Regressao: Comanda fechada so com PRODUTO no mesmo dia de um Agendamento
-- completed com servico real nao pode mascarar o servico/prazo do
-- Agendamento (a Comanda sem item de servico nao e fonte valida de servico).
select is(
  (
    select (i ->> 'return_period_days')::int
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_a_id from t09_context), null, null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_servico_e_produto_mesmo_dia_id from t09_customers)
  ),
  10,
  'Comanda fechada so com produto no mesmo dia de um Agendamento completed com servico nao mascara o prazo real (10, nao o padrao 20)'
);

select is(
  (
    select i ->> 'last_service_name'
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_a_id from t09_context), null, null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_servico_e_produto_mesmo_dia_id from t09_customers)
  ),
  '__t09_servico_10__',
  'o servico exibido vem do Agendamento quando a Comanda do mesmo dia so tem item de produto'
);

-- ---------------------------------------------------------------------------
-- Tenant isolado (t09_z) para fronteiras de faixa, paginacao, filtro de
-- profissional e filtro de faixa -- conjunto fechado e conhecido de
-- clientes, sem contaminacao dos cenarios de regra de dominio acima.
-- Relogio fixo: p_today = 2026-09-16, p_now = 2026-09-16 12:00:00-03.
-- Prazo fixo (servico_20, 20 dias) para todos os clientes "sem retorno":
--   days_overdue = dias_desde_ultima_visita - 20.
--   b15 (overdue 15): last_visit = hoje - 35 = 2026-08-12.
--   b16 (overdue 16): last_visit = hoje - 36 = 2026-08-11.
--   b30 (overdue 30): last_visit = hoje - 50 = 2026-07-28.
--   b31 (overdue 31): last_visit = hoje - 51 = 2026-07-27.
--   b60 (overdue 60): last_visit = hoje - 80 = 2026-06-28.
--   b61 (overdue 61): last_visit = hoje - 81 = 2026-06-27.
-- z7: dentro do prazo (last_visit = hoje - 5, overdue = -15, within_return).
-- z8: cliente sem nenhuma Visita (no_visit_ever).
-- b60/b61/z7 usam prof_z_b; os demais usam prof_z_a -- para o filtro de
-- profissional.
-- ---------------------------------------------------------------------------
create temporary table t09z_context (tenant_z_id uuid not null, servico_z_id uuid not null, prof_z_a_id uuid not null, prof_z_b_id uuid not null) on commit drop;
with tz as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t09z_tenant__', '__t09z_tenant__@teste.com', '11999982001', 'America/Sao_Paulo')
  returning id
)
insert into t09z_context (tenant_z_id, servico_z_id, prof_z_a_id, prof_z_b_id)
select tz.id, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from tz;
grant select on t09z_context to authenticated;

insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active, return_period_days)
select servico_z_id, tenant_z_id, '__t09z_servico__', 50, 30, 'Corte', true, 20 from t09z_context;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_z_a_id, tenant_z_id, '__t09z_prof_a__', '11999972001', 30, true from t09z_context;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_z_b_id, tenant_z_id, '__t09z_prof_b__', '11999972002', 30, true from t09z_context;

create temporary table t09z_customers (
  z1_id uuid not null, z2_id uuid not null, z3_id uuid not null, z4_id uuid not null,
  z5_id uuid not null, z6_id uuid not null, z7_id uuid not null, z8_id uuid not null
) on commit drop;
insert into t09z_customers (z1_id, z2_id, z3_id, z4_id, z5_id, z6_id, z7_id, z8_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
grant select on t09z_customers to authenticated;

insert into public.customers (id, tenant_id, name, phone)
select z1_id, tenant_z_id, '__t09z_cli_b15__', '11988881001' from t09z_customers, t09z_context;
insert into public.customers (id, tenant_id, name, phone)
select z2_id, tenant_z_id, '__t09z_cli_b16__', '11988881002' from t09z_customers, t09z_context;
insert into public.customers (id, tenant_id, name, phone)
select z3_id, tenant_z_id, '__t09z_cli_b30__', '11988881003' from t09z_customers, t09z_context;
insert into public.customers (id, tenant_id, name, phone)
select z4_id, tenant_z_id, '__t09z_cli_b31__', '11988881004' from t09z_customers, t09z_context;
insert into public.customers (id, tenant_id, name, phone)
select z5_id, tenant_z_id, '__t09z_cli_b60__', '11988881005' from t09z_customers, t09z_context;
insert into public.customers (id, tenant_id, name, phone)
select z6_id, tenant_z_id, '__t09z_cli_b61__', '11988881006' from t09z_customers, t09z_context;
insert into public.customers (id, tenant_id, name, phone)
select z7_id, tenant_z_id, '__t09z_cli_dentro_prazo__', '11988881007' from t09z_customers, t09z_context;
insert into public.customers (id, tenant_id, name, phone)
select z8_id, tenant_z_id, '__t09z_cli_sem_visita__', '11988881008' from t09z_customers, t09z_context;

-- Comanda fechada de balcao para cada cliente z1..z7, no dia calculado, com
-- o profissional indicado no comentario acima. z8 nao recebe nenhuma linha.
create temporary table t09z_fix (
  customer_id uuid not null, closed_at timestamptz not null, professional_id uuid not null
) on commit drop;
insert into t09z_fix (customer_id, closed_at, professional_id)
select z1_id, '2026-08-12 10:00:00-03'::timestamptz, prof_z_a_id from t09z_customers, t09z_context
union all
select z2_id, '2026-08-11 10:00:00-03'::timestamptz, prof_z_a_id from t09z_customers, t09z_context
union all
select z3_id, '2026-07-28 10:00:00-03'::timestamptz, prof_z_a_id from t09z_customers, t09z_context
union all
select z4_id, '2026-07-27 10:00:00-03'::timestamptz, prof_z_a_id from t09z_customers, t09z_context
union all
select z5_id, '2026-06-28 10:00:00-03'::timestamptz, prof_z_b_id from t09z_customers, t09z_context
union all
select z6_id, '2026-06-27 10:00:00-03'::timestamptz, prof_z_b_id from t09z_customers, t09z_context
union all
select z7_id, '2026-09-11 10:00:00-03'::timestamptz, prof_z_b_id from t09z_customers, t09z_context;

insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select gen_random_uuid(), (select tenant_z_id from t09z_context), f.customer_id, 'fechada', 50, 0, 0, f.closed_at
from t09z_fix f;

insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select gen_random_uuid(), c.id, (select tenant_z_id from t09z_context), 'servico', (select servico_z_id from t09z_context), f.professional_id, 1, 50, 50, 'unavailable'
from t09z_fix f
join public.comandas c on c.customer_id = f.customer_id and c.closed_at = f.closed_at and c.tenant_id = (select tenant_z_id from t09z_context);

-- z8: cliente cadastrado, sem nenhuma Visita.
-- (ja inserido em t09z_customers/public.customers; nenhuma Comanda/Agendamento.)

-- ---------------------------------------------------------------------------
-- Fronteiras 15/16/30/31/60/61 via filtro de faixa (sem filtro de
-- profissional, para nao restringir o conjunto).
-- ---------------------------------------------------------------------------
select is(
  (
    select jsonb_agg((i ->> 'customer_id')::uuid)
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_z_id from t09z_context), 'up_to_15', null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
  ),
  jsonb_build_array((select z1_id from t09z_customers)),
  'faixa up_to_15 contem so o cliente com days_overdue = 15 (fronteira 15)'
);
select is(
  (
    select jsonb_agg((i ->> 'customer_id')::uuid order by i ->> 'customer_id')
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_z_id from t09z_context), 'd16_30', null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
  ),
  (select jsonb_agg(x order by x) from unnest(array[(select z2_id from t09z_customers), (select z3_id from t09z_customers)]) x),
  'faixa d16_30 contem os clientes com days_overdue = 16 e 30 (fronteiras)'
);
select is(
  (
    select jsonb_agg((i ->> 'customer_id')::uuid order by i ->> 'customer_id')
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_z_id from t09z_context), 'd31_60', null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
  ),
  (select jsonb_agg(x order by x) from unnest(array[(select z4_id from t09z_customers), (select z5_id from t09z_customers)]) x),
  'faixa d31_60 contem os clientes com days_overdue = 31 e 60 (fronteiras)'
);
select is(
  (
    select jsonb_agg((i ->> 'customer_id')::uuid)
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_z_id from t09z_context), 'over_60', null, 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
  ),
  jsonb_build_array((select z6_id from t09z_customers)),
  'faixa over_60 contem so o cliente com days_overdue = 61'
);

-- ---------------------------------------------------------------------------
-- Totais e faixas do tenant_z sem filtro nenhum.
-- ---------------------------------------------------------------------------
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, null, 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) -> 'totals'),
  jsonb_build_object('without_return', 6, 'within_return', 1, 'no_visit_ever', 1),
  'totais sem filtro: 6 sem retorno, 1 dentro do prazo, 1 sem nenhuma Visita'
);
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, null, 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) -> 'bands'),
  jsonb_build_object('up_to_15', 1, 'd16_30', 2, 'd31_60', 2, 'over_60', 1),
  'faixas sem filtro: 1/2/2/1'
);
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, null, 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) ->> 'total_count')::int,
  6,
  'total_count sem filtro conta os 6 clientes sem retorno'
);

-- ---------------------------------------------------------------------------
-- Paginacao nao altera totais/faixas/total_count.
-- ---------------------------------------------------------------------------
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, null, 2, 2,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) - 'items'),
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, null, 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) - 'items'),
  'paginacao (limit/offset diferentes) nao altera totals/bands/total_count (tudo, exceto items, e igual)'
);
select is(
  (
    select count(*)
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_z_id from t09z_context), null, null, 2, 2,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    )
  ),
  2::bigint,
  'limit=2 devolve 2 itens da pagina'
);

-- ---------------------------------------------------------------------------
-- p_professional_id filtra lista e totais/faixas, mas nao a paginacao (o
-- limit/offset continuam se aplicando ao conjunto ja filtrado).
-- ---------------------------------------------------------------------------
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, (select prof_z_b_id from t09z_context), 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) -> 'totals'),
  jsonb_build_object('without_return', 2, 'within_return', 1, 'no_visit_ever', 0),
  'p_professional_id filtra totais pela ultima Visita (prof_z_b: z5 e z6 sem retorno, z7 dentro do prazo; no_visit_ever fica 0, ninguem sem Visita pode casar com um profissional)'
);
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, (select prof_z_b_id from t09z_context), 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) -> 'bands'),
  jsonb_build_object('up_to_15', 0, 'd16_30', 0, 'd31_60', 1, 'over_60', 1),
  'p_professional_id filtra as faixas junto (so z5 em d31_60 e z6 em over_60)'
);
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), null, (select prof_z_b_id from t09z_context), 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) ->> 'total_count')::int,
  2,
  'p_professional_id filtra total_count (2, so quem tem esse profissional na ultima Visita)'
);

-- p_overdue_band filtra SO a lista: com prof_z_b e faixa over_60 junto, so
-- z6 aparece na lista, mas totais/faixas continuam iguais ao filtro so por
-- profissional (nao respeitam a faixa).
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), 'over_60', (select prof_z_b_id from t09z_context), 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) -> 'bands'),
  jsonb_build_object('up_to_15', 0, 'd16_30', 0, 'd31_60', 1, 'over_60', 1),
  'p_overdue_band NAO filtra as faixas do topo (continuam 1/1 mesmo pedindo so over_60)'
);
select is(
  (private.get_customers_without_return_core(
    (select tenant_z_id from t09z_context), 'over_60', (select prof_z_b_id from t09z_context), 100, 0,
    '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
  ) ->> 'total_count')::int,
  1,
  'p_overdue_band filtra total_count da lista (so 1, z6)'
);
select is(
  (
    select jsonb_agg((i ->> 'customer_id')::uuid)
    from jsonb_array_elements(
      private.get_customers_without_return_core(
        (select tenant_z_id from t09z_context), 'over_60', (select prof_z_b_id from t09z_context), 100, 0,
        '2026-09-16'::date, '2026-09-16 12:00:00-03'::timestamptz, 'America/Sao_Paulo'
      ) -> 'items'
    ) as i
  ),
  jsonb_build_array((select z6_id from t09z_customers)),
  'p_overdue_band + p_professional_id juntos filtram a lista para so z6'
);

select * from finish(true);
rollback;
