begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

-- Spec 038 (Modulo de Relatorios), ticket 10: Novos x recorrentes (relatorio
-- 9-10, so a parte de visitors/previous_visitors/buckets/
-- single_visit_customers -- registrations e o ticket 11, NAO coberto aqui).
-- Cobre private.get_customer_report_core (relogio SO p_today, sem p_now) e
-- public.get_customer_report, reusando private.report_customer_visits
-- (ticket 09, ja testada em 37_relatorio_clientes_sem_retorno).

create temporary table t10_context (
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
  values ('__t10_tenant_a__', '__t10_tenant_a__@teste.com', '11999983001', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t10_tenant_b__', '__t10_tenant_b__@teste.com', '11999983002', 'America/Sao_Paulo')
  returning id
), tc as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t10_tenant_c__', '__t10_tenant_c__@teste.com', '11999983003', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t10_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t10_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t10_gerente_b__@teste.com') returning id
), au_gerente_nulo as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t10_gerente_nulo__@teste.com') returning id
), au_proprietario as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t10_proprietario__@teste.com') returning id
)
insert into t10_context (
  tenant_a_id, tenant_b_id, tenant_c_id, gerente_a_id, barbeiro_a_id, gerente_b_id, gerente_nulo_id, proprietario_id
)
select ta.id, tb.id, tc.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, au_gerente_nulo.id, au_proprietario.id
from ta, tb, tc, au_gerente_a, au_barbeiro_a, au_gerente_b, au_gerente_nulo, au_proprietario;

update public.users set tenant_id = (select tenant_a_id from t10_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from t10_context);
update public.users set tenant_id = (select tenant_a_id from t10_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from t10_context);
update public.users set tenant_id = (select tenant_b_id from t10_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from t10_context);
update public.users set tenant_id = null, role = 'gerente', is_active = true
where id = (select gerente_nulo_id from t10_context);
update public.users set tenant_id = (select tenant_c_id from t10_context), role = 'proprietario', is_active = true
where id = (select proprietario_id from t10_context);

grant select on t10_context to authenticated;

-- ---------------------------------------------------------------------------
-- Contrato das funcoes: existencia, search_path vazio, privilegios.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'get_customer_report', array['uuid', 'date', 'date', 'text'],
  'public.get_customer_report(uuid, date, date, text) existe'
);
select has_function(
  'private', 'get_customer_report_core', array['uuid', 'date', 'date', 'text', 'date', 'text'],
  'private.get_customer_report_core(...) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_customer_report(uuid,date,date,text)'::regprocedure),
  'a funcao publica fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.get_customer_report_core(uuid,date,date,text,date,text)'::regprocedure),
  'o nucleo privado fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'public.get_customer_report(uuid,date,date,text)', 'EXECUTE'),
  'anon nao executa a funcao publica'
);
select ok(
  has_function_privilege('authenticated', 'public.get_customer_report(uuid,date,date,text)', 'EXECUTE'),
  'authenticated executa a funcao publica'
);
select ok(
  has_function_privilege('service_role', 'public.get_customer_report(uuid,date,date,text)', 'EXECUTE'),
  'service_role executa a funcao publica'
);
select ok(
  not has_function_privilege('anon', 'private.get_customer_report_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'anon nao executa o nucleo privado'
);
select ok(
  not has_function_privilege('authenticated', 'private.get_customer_report_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'authenticated nao executa o nucleo privado diretamente'
);
select ok(
  has_function_privilege('service_role', 'private.get_customer_report_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'service_role executa o nucleo privado'
);

-- ---------------------------------------------------------------------------
-- Acesso: barbeiro recusado, gerente pedindo outro tenant recusado, gerente
-- com tenant nulo recusado, proprietario aceito para qualquer tenant.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from t10_context), true);
set local role authenticated;
select throws_ok(
  $$select public.get_customer_report(null, '2026-09-01'::date, '2026-09-10'::date, 'day')$$,
  '42501',
  'Acesso negado. Apenas gerentes podem acessar os relatórios.',
  'barbeiro recebe erro de acesso'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from t10_context), true);
set local role authenticated;
select throws_ok(
  format($$select public.get_customer_report('%s'::uuid, '2026-09-01'::date, '2026-09-10'::date, 'day')$$, (select tenant_b_id from t10_context)),
  '42501',
  'Acesso negado para a unidade solicitada.',
  'gerente pedindo outro tenant e recusado'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_nulo_id::text from t10_context), true);
set local role authenticated;
select throws_ok(
  format($$select public.get_customer_report('%s'::uuid, '2026-09-01'::date, '2026-09-10'::date, 'day')$$, (select tenant_a_id from t10_context)),
  '42501',
  'Acesso negado. Gerente sem unidade vinculada.',
  'gerente com tenant nulo e recusado, mesmo pedindo um tenant valido'
);
reset role;

select set_config('request.jwt.claim.sub', (select proprietario_id::text from t10_context), true);
set local role authenticated;
select ok(
  (select public.get_customer_report((select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day')) ? 'visitors',
  'proprietario acessa o relatorio de qualquer unidade'
);
reset role;

-- ---------------------------------------------------------------------------
-- Validacao de periodo/granularidade (mesmos limites e mensagens do ticket
-- 01), via nucleo com relogio fixo p_today = 2026-09-16.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select private.get_customer_report_core('00000000-0000-0000-0000-000000000001'::uuid, null, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo')$$,
  '22023', 'As datas de início e fim do período são obrigatórias.', 'p_start_date nulo e recusado'
);
select throws_ok(
  $$select private.get_customer_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-09-10'::date, '2026-09-01'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser anterior à data inicial.', 'data final antes da inicial e recusada'
);
select throws_ok(
  $$select private.get_customer_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-09-01'::date, '2026-09-17'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser posterior a hoje.', 'data final depois de hoje e recusada'
);
select throws_ok(
  $$select private.get_customer_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2024-01-01'::date, '2024-01-02'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data inicial não pode ser mais de 730 dias antes de hoje.', 'data inicial mais de 730 dias antes de hoje e recusada'
);
select throws_ok(
  $$select private.get_customer_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2025-01-01'::date, '2026-09-16'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo')$$,
  '22023', 'O período não pode ter mais de 366 dias.', 'periodo com mais de 366 dias e recusado'
);
select throws_ok(
  $$select private.get_customer_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-09-01'::date, '2026-09-10'::date, 'ano', '2026-09-16'::date, 'America/Sao_Paulo')$$,
  '22023', 'Granularidade desconhecida. Use dia, semana ou mês.', 'granularidade invalida e recusada'
);
select throws_ok(
  $$select private.get_customer_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-01-01'::date, '2026-09-16'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo')$$,
  '22023', 'A granularidade diária só é permitida em períodos de até 92 dias.', 'granularidade diaria em periodo longo e recusada'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from t10_context), true);
set local role authenticated;
select throws_ok(
  format($$select public.get_customer_report('%s'::uuid, null, '2026-09-10'::date, 'day')$$, (select tenant_a_id from t10_context)),
  '22023', 'As datas de início e fim do período são obrigatórias.', 'a funcao publica tambem valida o periodo'
);
reset role;

-- ---------------------------------------------------------------------------
-- Regras de dominio (tenant_a), relogio fixo p_today = 2026-09-16, periodo
-- 2026-09-01 a 2026-09-10 (granularidade dia), periodo anterior calculado =
-- 2026-08-22 a 2026-08-31.
--
-- cli_a: primeira Visita da vida EXATAMENTE no primeiro dia do periodo
--   (2026-09-01) -- fronteira Novo. Segunda Visita em 2026-09-05 (ainda
--   Novo, mas com 2 Visitas ate hoje -- nao e Cliente de Uma Visita).
-- cli_b: primeira Visita da vida um dia ANTES do inicio do periodo
--   (2026-08-31) -- fronteira Recorrente -- com outra Visita dentro do
--   periodo (2026-09-03).
-- cli_c: Novo do periodo (unica Visita da vida, 2026-09-02), sem nenhuma
--   Visita depois -- permanece Cliente de Uma Visita.
-- cli_d: Novo do periodo (primeira Visita 2026-09-04), com Visita POSTERIOR
--   ao periodo (2026-09-14, depois do fim do periodo 09-10, antes de hoje
--   09-16) -- deixa de ser Cliente de Uma Visita.
-- cli_e: Recorrente (primeira Visita da vida 2026-08-01, bem antes do
--   periodo), com DUAS Visitas dentro do periodo (2026-09-06 e 2026-09-08)
--   -- deve contar no bucket da PRIMEIRA (09-06), nao da ultima (09-08).
-- cli_f: Comanda fechada SEM customer_id em 2026-09-05 -- atendimento sem
--   cliente identificado, nao e Visita, nao entra em unique_customers.
-- ---------------------------------------------------------------------------
create temporary table t10_customers (
  cli_a_id uuid not null, cli_b_id uuid not null, cli_c_id uuid not null,
  cli_d_id uuid not null, cli_e_id uuid not null
) on commit drop;
insert into t10_customers (cli_a_id, cli_b_id, cli_c_id, cli_d_id, cli_e_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
grant select on t10_customers to authenticated;

insert into public.customers (id, tenant_id, name, phone)
select cli_a_id, (select tenant_a_id from t10_context), '__t10_cli_a__', '11988882001' from t10_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_b_id, (select tenant_a_id from t10_context), '__t10_cli_b__', '11988882002' from t10_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_c_id, (select tenant_a_id from t10_context), '__t10_cli_c__', '11988882003' from t10_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_d_id, (select tenant_a_id from t10_context), '__t10_cli_d__', '11988882004' from t10_customers;
insert into public.customers (id, tenant_id, name, phone)
select cli_e_id, (select tenant_a_id from t10_context), '__t10_cli_e__', '11988882005' from t10_customers;

create temporary table t10_prof (prof_id uuid not null) on commit drop;
insert into t10_prof (prof_id) values (gen_random_uuid());
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_id, (select tenant_a_id from t10_context), '__t10_prof__', '11999973001', 30, true from t10_prof;

create temporary table t10_services (servico_id uuid not null) on commit drop;
insert into t10_services (servico_id) values (gen_random_uuid());
insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active, return_period_days)
select servico_id, (select tenant_a_id from t10_context), '__t10_servico__', 50, 30, 'Corte', true, 20 from t10_services;

-- Visitas via Comanda fechada com customer_id (Visita nao exige item de
-- servico -- so customer_id + closed_at); cli_c ganha item de servico com
-- profissional para conferir que professional_name chega na lista.
create temporary table t10_visits (
  customer_id uuid not null, closed_at timestamptz not null, with_item boolean not null default false
) on commit drop;
insert into t10_visits (customer_id, closed_at, with_item)
select cli_a_id, '2026-09-01 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_a_id, '2026-09-05 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_b_id, '2026-08-31 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_b_id, '2026-09-03 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_c_id, '2026-09-02 10:00:00-03'::timestamptz, true from t10_customers
union all
select cli_d_id, '2026-09-04 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_d_id, '2026-09-14 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_e_id, '2026-08-01 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_e_id, '2026-09-06 10:00:00-03'::timestamptz, false from t10_customers
union all
select cli_e_id, '2026-09-08 10:00:00-03'::timestamptz, false from t10_customers;

create temporary table t10_visit_comandas (
  customer_id uuid not null, closed_at timestamptz not null, with_item boolean not null, comanda_id uuid not null
) on commit drop;
insert into t10_visit_comandas (customer_id, closed_at, with_item, comanda_id)
select customer_id, closed_at, with_item, gen_random_uuid() from t10_visits;

insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from t10_context), customer_id, 'fechada', 50, 0, 0, closed_at
from t10_visit_comandas;

insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price, snapshot_status)
select gen_random_uuid(), comanda_id, (select tenant_a_id from t10_context), 'servico', (select servico_id from t10_services), (select prof_id from t10_prof), 1, 50, 50, 'unavailable'
from t10_visit_comandas
where with_item;

-- cli_f: Comanda fechada SEM customer_id, dentro do periodo.
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
values (gen_random_uuid(), (select tenant_a_id from t10_context), null, 'fechada', 50, 0, 0, '2026-09-05 11:00:00-03'::timestamptz);

-- ---------------------------------------------------------------------------
-- Asserts.
-- ---------------------------------------------------------------------------
select is(
  (private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'period'),
  jsonb_build_object('start', '2026-09-01', 'end', '2026-09-10'),
  'period reflete as datas pedidas'
);
select is(
  (private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'previous_period'),
  jsonb_build_object('start', '2026-08-22', 'end', '2026-08-31'),
  'previous_period e o mesmo numero de dias imediatamente antes do inicio'
);

select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'visitors' ->> 'unique_customers')::int),
  5,
  'unique_customers conta os 5 clientes com Visita no periodo (a-e), sem contar cli_f'
);
select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'visitors' ->> 'new_customers')::int),
  3,
  'new_customers = 3 (cli_a, cli_c, cli_d: primeira Visita da vida cai no periodo)'
);
select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'visitors' ->> 'returning_customers')::int),
  2,
  'returning_customers = 2 (cli_b, cli_e: ja tinham Visita antes do inicio do periodo)'
);
select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'visitors' ->> 'new_single_visit')::int),
  1,
  'new_single_visit = 1 (so cli_c: Novo com uma unica Visita ate hoje; cli_a tem 2 Visitas, cli_d tem Visita posterior)'
);
select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'visitors' ->> 'unidentified_attendances')::int),
  1,
  'unidentified_attendances = 1 (Comanda fechada sem customer_id do cli_f)'
);

select ok(
  not ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'previous_visitors') ? 'new_single_visit'),
  'previous_visitors nao tem new_single_visit (depende de "ate hoje", incompativel com periodo anterior fixo)'
);
select is(
  (private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'previous_visitors'),
  jsonb_build_object('unique_customers', 1, 'new_customers', 1, 'returning_customers', 0, 'unidentified_attendances', 0),
  'previous_visitors conta cli_b como Novo no periodo anterior (a primeira Visita da vida dele, 2026-08-31, cai no periodo anterior 2026-08-22 a 2026-08-31)'
);

-- Cliente de Uma Visita: so cli_c permanece na lista.
select is(
  (
    select jsonb_agg((i ->> 'customer_id')::uuid)
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'single_visit_customers'
    ) as i
  ),
  jsonb_build_array((select cli_c_id from t10_customers)),
  'single_visit_customers contem so cli_c (cli_a tem 2 Visitas; cli_d tem Visita posterior ao periodo, antes de hoje)'
);
select is(
  (
    select i ->> 'professional_name'
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'single_visit_customers'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_c_id from t10_customers)
  ),
  '__t10_prof__',
  'a linha de cli_c traz o profissional do item de servico da Visita'
);
select is(
  (
    select (i ->> 'visit_date')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'single_visit_customers'
    ) as i
    where (i ->> 'customer_id')::uuid = (select cli_c_id from t10_customers)
  ),
  '2026-09-02',
  'visit_date de cli_c e a data da unica Visita dele'
);

-- Buckets (granularidade dia): 10 dias no periodo.
select is(
  (
    select count(*) from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    )
  ),
  10::bigint,
  'buckets tem um agrupamento por dia (10 dias no periodo)'
);
select is(
  (
    select jsonb_build_object('new_customers', i ->> 'new_customers', 'returning_customers', i ->> 'returning_customers')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as i
    where (i ->> 'start_date') = '2026-09-01'
  ),
  jsonb_build_object('new_customers', '1', 'returning_customers', '0'),
  'bucket 2026-09-01: 1 novo (cli_a, primeira Visita da vida), 0 recorrente'
);
select is(
  (
    select (i ->> 'new_customers')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as i
    where (i ->> 'start_date') = '2026-09-02'
  ),
  '1',
  'bucket 2026-09-02: 1 novo (cli_c)'
);
select is(
  (
    select (i ->> 'returning_customers')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as i
    where (i ->> 'start_date') = '2026-09-03'
  ),
  '1',
  'bucket 2026-09-03: 1 recorrente (cli_b, primeira Visita dele dentro do periodo)'
);
select is(
  (
    select (i ->> 'new_customers')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as i
    where (i ->> 'start_date') = '2026-09-04'
  ),
  '1',
  'bucket 2026-09-04: 1 novo (cli_d)'
);
select is(
  (
    select (i ->> 'returning_customers')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as i
    where (i ->> 'start_date') = '2026-09-06'
  ),
  '1',
  'bucket 2026-09-06: 1 recorrente (cli_e, PRIMEIRA Visita dele dentro do periodo)'
);
select is(
  (
    select (i ->> 'returning_customers')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as i
    where (i ->> 'start_date') = '2026-09-08'
  ),
  '0',
  'bucket 2026-09-08: 0 (a SEGUNDA Visita de cli_e dentro do periodo nao conta de novo)'
);

-- ---------------------------------------------------------------------------
-- Ticket 11: Origem dos clientes (bloco `registrations`), mesmo tenant_a,
-- mesmo periodo 2026-09-01 a 2026-09-10. Cadastros com created_at explicito
-- (o default e now(), sem relacao com as datas simuladas do teste).
--
-- reg_a: origem balcao, canal "Instagram" (1 grafia), completo, sem Visita.
-- reg_b: origem balcao, canal "instagram " (com espaco, mesmo grupo
--   normalizado), completo, sem Visita.
-- reg_c: origem agenda, canal "instagram" (minusculo, mesmo grupo -- grafia
--   "instagram" minuscula fica com 2 ocorrencias apos trim contra 1 de
--   "Instagram", entao e a grafia mais frequente exibida), completo, com
--   DUAS Visitas (testa que with_visit nao duplica contagem).
-- reg_d: origem online, canal nulo -> "Não informado", completo, sem Visita.
-- reg_e: origem canal_cliente, canal vazio ('') -> tambem "Não informado",
--   PROVISIONAL (cadastro_completo = false), sem Visita.
-- reg_f: origem whatsapp_bot, canal "Google", PROVISIONAL, com Visita.
--
-- Totais esperados: total = 6, provisional = 2 (reg_e, reg_f).
-- by_registration_origin: balcao 2/0, agenda 1/1, online 1/0,
--   canal_cliente 1/0, whatsapp_bot 1/1 (total/with_visit).
-- by_acquisition_channel: "instagram" (grafia mais frequente) 3/1,
--   "Não informado" 2/0, "Google" 1/1.
-- acquisition_channel_filled_share = 4/6 = 0.6667 (reg_a/b/c/f preenchidos).
-- ---------------------------------------------------------------------------
create temporary table t11_customers (
  reg_a_id uuid not null, reg_b_id uuid not null, reg_c_id uuid not null,
  reg_d_id uuid not null, reg_e_id uuid not null, reg_f_id uuid not null
) on commit drop;
insert into t11_customers (reg_a_id, reg_b_id, reg_c_id, reg_d_id, reg_e_id, reg_f_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());
grant select on t11_customers to authenticated;

insert into public.customers (id, tenant_id, name, phone, created_at, registration_origin, acquisition_channel, cadastro_completo)
select reg_a_id, (select tenant_a_id from t10_context), '__t11_reg_a__', '11988883001',
       '2026-09-02 09:00:00-03'::timestamptz, 'balcao', 'Instagram', true
from t11_customers
union all
select reg_b_id, (select tenant_a_id from t10_context), '__t11_reg_b__', '11988883002',
       '2026-09-02 09:10:00-03'::timestamptz, 'balcao', 'instagram ', true
from t11_customers
union all
select reg_c_id, (select tenant_a_id from t10_context), '__t11_reg_c__', '11988883003',
       '2026-09-03 09:00:00-03'::timestamptz, 'agenda', 'instagram', true
from t11_customers
union all
select reg_d_id, (select tenant_a_id from t10_context), '__t11_reg_d__', '11988883004',
       '2026-09-04 09:00:00-03'::timestamptz, 'online', null, true
from t11_customers
union all
select reg_e_id, (select tenant_a_id from t10_context), '__t11_reg_e__', '11988883005',
       '2026-09-05 09:00:00-03'::timestamptz, 'canal_cliente', '', false
from t11_customers
union all
select reg_f_id, (select tenant_a_id from t10_context), '__t11_reg_f__', '11988883006',
       '2026-09-06 09:00:00-03'::timestamptz, 'whatsapp_bot', 'Google', false
from t11_customers;

-- Visitas de reg_c (DUAS, dias diferentes -- with_visit nao pode duplicar) e
-- reg_f (uma).
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select gen_random_uuid(), (select tenant_a_id from t10_context), reg_c_id, 'fechada', 50, 0, 0, '2026-09-03 12:00:00-03'::timestamptz
from t11_customers
union all
select gen_random_uuid(), (select tenant_a_id from t10_context), reg_c_id, 'fechada', 50, 0, 0, '2026-09-07 12:00:00-03'::timestamptz
from t11_customers
union all
select gen_random_uuid(), (select tenant_a_id from t10_context), reg_f_id, 'fechada', 50, 0, 0, '2026-09-06 12:00:00-03'::timestamptz
from t11_customers;

select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'registrations' ->> 'total')::int),
  6,
  'registrations.total conta os 6 cadastros do periodo (reg_a a reg_f)'
);
select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'registrations' ->> 'provisional')::int),
  2,
  'registrations.provisional conta reg_e e reg_f (cadastro_completo = false)'
);
select is(
  (
    select jsonb_agg(jsonb_build_object('origin', i ->> 'origin', 'total', (i ->> 'total')::int, 'with_visit', (i ->> 'with_visit')::int) order by i ->> 'origin')
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'registrations' -> 'by_registration_origin'
    ) as i
  ),
  jsonb_build_array(
    jsonb_build_object('origin', 'agenda', 'total', 1, 'with_visit', 1),
    jsonb_build_object('origin', 'balcao', 'total', 2, 'with_visit', 0),
    jsonb_build_object('origin', 'canal_cliente', 'total', 1, 'with_visit', 0),
    jsonb_build_object('origin', 'online', 'total', 1, 'with_visit', 0),
    jsonb_build_object('origin', 'whatsapp_bot', 'total', 1, 'with_visit', 1)
  ),
  'by_registration_origin agrupa cada origem com total e with_visit (exists, sem duplicar)'
);
select is(
  (
    select i ->> 'channel'
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'registrations' -> 'by_acquisition_channel'
    ) as i
    where (i ->> 'total')::int = 3
  ),
  'instagram',
  'grafias diferentes ("Instagram", "instagram ", "instagram") agrupam juntas e exibem a grafia MAIS FREQUENTE ("instagram" minusculo, 2 ocorrencias contra 1 de "Instagram")'
);
select is(
  (
    select (i ->> 'with_visit')::int
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'registrations' -> 'by_acquisition_channel'
    ) as i
    where i ->> 'channel' = 'instagram'
  ),
  1,
  'grupo "instagram" tem with_visit = 1 (so reg_c, mesmo com DUAS Visitas -- exists nao duplica)'
);
select is(
  (
    select jsonb_build_object('total', (i ->> 'total')::int, 'with_visit', (i ->> 'with_visit')::int)
    from jsonb_array_elements(
      private.get_customer_report_core(
        (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
      ) -> 'registrations' -> 'by_acquisition_channel'
    ) as i
    where i ->> 'channel' = 'Não informado'
  ),
  jsonb_build_object('total', 2, 'with_visit', 0),
  'nulo (reg_d) e vazio (reg_e) agrupam juntos em "Não informado" (total 2), sempre presente'
);
select is(
  ((private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-01'::date, '2026-09-10'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'registrations' ->> 'acquisition_channel_filled_share')::numeric),
  0.6667,
  'acquisition_channel_filled_share = 4/6 (reg_a, reg_b, reg_c, reg_f preenchidos), arredondado a 4 casas'
);

-- Periodo sem NENHUM cadastro (2026-09-11 a 2026-09-15, nenhum cliente criado
-- nessa janela): total/provisional zerados, listas vazias (nada a destacar,
-- nem "Não informado"), share null (nunca zero nem divisao por zero).
select is(
  (private.get_customer_report_core(
    (select tenant_a_id from t10_context), '2026-09-11'::date, '2026-09-15'::date, 'day', '2026-09-16'::date, 'America/Sao_Paulo'
  ) -> 'registrations'),
  jsonb_build_object(
    'total', 0,
    'provisional', 0,
    'by_registration_origin', '[]'::jsonb,
    'by_acquisition_channel', '[]'::jsonb,
    'acquisition_channel_filled_share', null
  ),
  'periodo sem cadastro devolve total/provisional zerados, listas vazias e share null (nunca zero)'
);

select * from finish(true);
rollback;
