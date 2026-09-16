begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Spec 038 (Modulo de Relatorios), ticket 01: esqueleto do modulo e
-- Faturamento por periodo, ponta a ponta. Cobre o contrato de leitura
-- (public.get_revenue_report), o nucleo com relogio injetado
-- (private.get_revenue_report_core), a funcao privada compartilhada
-- (private.report_recognized_items), o indice novo e o teste cruzado com
-- get_tenant_financial_metrics.

create temporary table ticket01_context (
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
  values ('__ticket01_tenant_a__', '__ticket01_tenant_a__@teste.com', '11999980001', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket01_tenant_b__', '__ticket01_tenant_b__@teste.com', '11999980002', 'America/Sao_Paulo')
  returning id
), tc as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket01_tenant_c__', '__ticket01_tenant_c__@teste.com', '11999980003', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket01_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket01_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket01_gerente_b__@teste.com') returning id
), au_gerente_nulo as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket01_gerente_nulo__@teste.com') returning id
), au_proprietario as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket01_proprietario__@teste.com') returning id
)
insert into ticket01_context (
  tenant_a_id, tenant_b_id, tenant_c_id, gerente_a_id, barbeiro_a_id, gerente_b_id, gerente_nulo_id, proprietario_id
)
select ta.id, tb.id, tc.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, au_gerente_nulo.id, au_proprietario.id
from ta, tb, tc, au_gerente_a, au_barbeiro_a, au_gerente_b, au_gerente_nulo, au_proprietario;

update public.users set tenant_id = (select tenant_a_id from ticket01_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from ticket01_context);
update public.users set tenant_id = (select tenant_a_id from ticket01_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from ticket01_context);
update public.users set tenant_id = (select tenant_b_id from ticket01_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from ticket01_context);
-- Gerente mal cadastrado, sem unidade vinculada (o mesmo precedente do
-- teste pgTAP 32 de bloqueio de tenant nulo).
update public.users set tenant_id = null, role = 'gerente', is_active = true
where id = (select gerente_nulo_id from ticket01_context);
update public.users set tenant_id = (select tenant_c_id from ticket01_context), role = 'proprietario', is_active = true
where id = (select proprietario_id from ticket01_context);

grant select on ticket01_context to authenticated;

-- ---------------------------------------------------------------------------
-- Contrato das funcoes: existencia, search_path vazio, privilegios e indice.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'get_revenue_report', array['uuid', 'date', 'date', 'text'],
  'public.get_revenue_report(uuid, date, date, text) existe'
);
select has_function(
  'private', 'get_revenue_report_core', array['uuid', 'date', 'date', 'text', 'date', 'text'],
  'private.get_revenue_report_core(uuid, date, date, text, date, text) existe'
);
select has_function(
  'private', 'report_recognized_items', array['uuid', 'date', 'date', 'text'],
  'private.report_recognized_items(uuid, date, date, text) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_revenue_report(uuid,date,date,text)'::regprocedure),
  'a funcao publica fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.get_revenue_report_core(uuid,date,date,text,date,text)'::regprocedure),
  'o nucleo privado fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'public.get_revenue_report(uuid,date,date,text)', 'EXECUTE'),
  'anon nao executa a funcao publica'
);
select ok(
  has_function_privilege('authenticated', 'public.get_revenue_report(uuid,date,date,text)', 'EXECUTE'),
  'authenticated executa a funcao publica'
);
select ok(
  has_function_privilege('service_role', 'public.get_revenue_report(uuid,date,date,text)', 'EXECUTE'),
  'service_role executa a funcao publica'
);

select ok(
  not has_function_privilege('anon', 'private.get_revenue_report_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'anon nao executa o nucleo privado'
);
select ok(
  not has_function_privilege('authenticated', 'private.get_revenue_report_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'authenticated nao executa o nucleo privado diretamente'
);
select ok(
  has_function_privilege('service_role', 'private.get_revenue_report_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'service_role executa o nucleo privado'
);

select ok(
  not has_function_privilege('anon', 'private.report_recognized_items(uuid,date,date,text)', 'EXECUTE'),
  'anon nao executa a funcao privada de receita reconhecida'
);
select ok(
  not has_function_privilege('authenticated', 'private.report_recognized_items(uuid,date,date,text)', 'EXECUTE'),
  'authenticated nao executa a funcao privada de receita reconhecida'
);
select ok(
  has_function_privilege('service_role', 'private.report_recognized_items(uuid,date,date,text)', 'EXECUTE'),
  'service_role executa a funcao privada de receita reconhecida'
);

select has_index(
  'public', 'comandas', 'idx_comandas_tenant_closed_at_fechada',
  'indice parcial por unidade e fechamento existe'
);

-- ---------------------------------------------------------------------------
-- Acesso: barbeiro recusado, gerente pedindo outro tenant recusado, gerente
-- com tenant nulo recusado, proprietario aceito para qualquer tenant. Via
-- funcao publica.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket01_context), true);
set local role authenticated;
select throws_ok(
  $$select public.get_revenue_report(null, current_date, current_date, 'day')$$,
  '42501',
  'Acesso negado. Apenas gerentes podem acessar os relatórios.',
  'barbeiro recebe erro de acesso'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket01_context), true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.get_revenue_report('%s'::uuid, current_date, current_date, 'day')$$,
    (select tenant_b_id from ticket01_context)
  ),
  '42501',
  'Acesso negado para a unidade solicitada.',
  'gerente pedindo outro tenant e recusado'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_nulo_id::text from ticket01_context), true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.get_revenue_report('%s'::uuid, current_date, current_date, 'day')$$,
    (select tenant_a_id from ticket01_context)
  ),
  '42501',
  'Acesso negado. Gerente sem unidade vinculada.',
  'gerente com tenant nulo e recusado, mesmo pedindo um tenant valido'
);
reset role;

select set_config('request.jwt.claim.sub', (select proprietario_id::text from ticket01_context), true);
set local role authenticated;
select ok(
  (select public.get_revenue_report((select tenant_a_id from ticket01_context), '2026-08-01'::date, '2026-08-01'::date, 'day')) ? 'totals',
  'proprietario acessa o relatorio de qualquer unidade, tratamento identico as demais RPCs financeiras'
);
reset role;

-- ---------------------------------------------------------------------------
-- Fuso: Comanda fechada as 23h30 locais (America/Sao_Paulo) cai no dia
-- local, e nao no dia UTC seguinte. Via funcao publica (relogio real).
-- ---------------------------------------------------------------------------
create temporary table ticket01_tz_context (comanda_id uuid not null, item_id uuid not null, local_day date not null) on commit drop;
insert into ticket01_tz_context (comanda_id, item_id, local_day) values (gen_random_uuid(), gen_random_uuid(), current_date - 3);
grant select on ticket01_tz_context to authenticated;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 75, 0, 0,
  ((local_day + time '23:30:00') at time zone 'America/Sao_Paulo')
from ticket01_tz_context;

insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status, snapshot_gross_amount, snapshot_net_amount, snapshot_quantity, snapshot_commission_amount)
select item_id, comanda_id, (select tenant_a_id from ticket01_context), 'servico', 1, 75, 75, 'unavailable', null, null, null, null
from ticket01_tz_context;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket01_context), true);
set local role authenticated;
select is(
  (
    select (bucket ->> 'net')::numeric
    from jsonb_array_elements(
      public.get_revenue_report(
        (select tenant_a_id from ticket01_context),
        (select local_day from ticket01_tz_context),
        (select local_day from ticket01_tz_context),
        'day'
      ) -> 'buckets'
    ) as bucket
  ),
  75.00,
  'comanda fechada as 23h30 locais cai no dia local, nao no dia UTC'
);
reset role;

-- ---------------------------------------------------------------------------
-- Reconhecimento: Comanda aberta e cancelada nao contam; item revertido nao
-- conta; item indisponivel conta pelo preco total; gorjeta fica fora do
-- liquido. Via nucleo (hoje fixo).
-- ---------------------------------------------------------------------------
create temporary table ticket01_fix_context (
  comanda_fechada_id uuid not null,
  comanda_aberta_id uuid not null,
  comanda_cancelada_id uuid not null,
  item_confirmado_servico_id uuid not null,
  item_confirmado_produto_id uuid not null,
  item_indisponivel_id uuid not null,
  item_revertido_id uuid not null,
  item_aberta_id uuid not null,
  item_cancelada_id uuid not null
) on commit drop;
insert into ticket01_fix_context (
  comanda_fechada_id, comanda_aberta_id, comanda_cancelada_id,
  item_confirmado_servico_id, item_confirmado_produto_id, item_indisponivel_id, item_revertido_id,
  item_aberta_id, item_cancelada_id
) values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid()
);

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_fechada_id, (select tenant_a_id from ticket01_context), 'fechada', 180, 10, 10, '2026-05-10 12:00:00-03'::timestamptz
from ticket01_fix_context;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_aberta_id, (select tenant_a_id from ticket01_context), 'aberta', 500, 0, 0, null
from ticket01_fix_context;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_cancelada_id, (select tenant_a_id from ticket01_context), 'cancelada', 500, 0, 0, '2026-05-10 13:00:00-03'::timestamptz
from ticket01_fix_context;

-- item A: servico confirmado (bruto 100, liquido 90).
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_confirmado_servico_id, comanda_fechada_id, (select tenant_a_id from ticket01_context), 'servico', 1, 100, 100,
  'confirmed', 1, 100, 100, 10, 90, 30, 27, 'professional_service'
from ticket01_fix_context;

-- item B: produto confirmado (bruto 50, liquido 50).
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_unit_cost, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_confirmado_produto_id, comanda_fechada_id, (select tenant_a_id from ticket01_context), 'produto', 2, 25, 50,
  'confirmed', 2, 25, 50, 0, 50, 10, 0, 0, 'professional_service'
from ticket01_fix_context;

-- item C: servico indisponivel (conta pelo total_price, 30).
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_indisponivel_id, comanda_fechada_id, (select tenant_a_id from ticket01_context), 'servico', 1, 30, 30, 'unavailable'
from ticket01_fix_context;

-- item D: servico revertido (nao conta, mesmo com total_price alto).
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_revertido_id, comanda_fechada_id, (select tenant_a_id from ticket01_context), 'servico', 1, 999, 999, 'reverted'
from ticket01_fix_context;

-- item na Comanda aberta (nao deve contar em nada).
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status, snapshot_gross_amount, snapshot_net_amount, snapshot_quantity, snapshot_commission_amount)
select item_aberta_id, comanda_aberta_id, (select tenant_a_id from ticket01_context), 'servico', 1, 500, 500, 'unavailable', null, null, null, null
from ticket01_fix_context;

-- item na Comanda cancelada (nao deve contar em nada).
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status, snapshot_gross_amount, snapshot_net_amount, snapshot_quantity, snapshot_commission_amount)
select item_cancelada_id, comanda_cancelada_id, (select tenant_a_id from ticket01_context), 'servico', 1, 500, 500, 'unavailable', null, null, null, null
from ticket01_fix_context;

select is(
  (
    select jsonb_build_object(
      'gross', tot ->> 'gross', 'discounts', tot ->> 'discounts', 'net', tot ->> 'net',
      'services_net', tot ->> 'services_net', 'products_net', tot ->> 'products_net',
      'tips', tot ->> 'tips', 'closed_comandas', tot ->> 'closed_comandas'
    )
    from (
      select private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-05-10'::date, '2026-05-10'::date, 'day', '2026-05-15'::date, 'America/Sao_Paulo'
      ) -> 'totals' as tot
    ) s
  ),
  jsonb_build_object(
    'gross', '180.00', 'discounts', '10.00', 'net', '170.00',
    'services_net', '120.00', 'products_net', '50.00',
    'tips', '10.00', 'closed_comandas', '1'
  ),
  'Comanda aberta e cancelada nao contam; item revertido nao conta; item indisponivel conta pelo total_price; gorjeta fica fora do liquido; bruto/descontos/liquido corretos'
);

-- ---------------------------------------------------------------------------
-- Teste cruzado: para o mesmo intervalo, net == operational_revenue e
-- data_quality.status == historical_data_quality de get_tenant_financial_metrics.
-- Fixture propria, so com itens confirmados, para status determinístico
-- ('confirmed').
-- ---------------------------------------------------------------------------
create temporary table ticket01_cross_context (comanda_id uuid not null, item_id uuid not null) on commit drop;
insert into ticket01_cross_context (comanda_id, item_id) values (gen_random_uuid(), gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 200, 0, 0, '2026-05-20 12:00:00-03'::timestamptz
from ticket01_cross_context;

insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_id, comanda_id, (select tenant_a_id from ticket01_context), 'servico', 1, 200, 200,
  'confirmed', 1, 200, 200, 0, 200, 30, 60, 'professional_service'
from ticket01_cross_context;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket01_context), true);
set local role authenticated;
select is(
  (
    (public.get_tenant_financial_metrics('2026-05-20 00:00:00-03'::timestamptz, '2026-05-20 23:59:59-03'::timestamptz, (select tenant_a_id from ticket01_context))->>'operational_revenue')::numeric
  ),
  200.00,
  'get_tenant_financial_metrics confirma a receita operacional do dia de referencia'
);
reset role;

select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-05-20'::date, '2026-05-20'::date, 'day', '2026-05-20'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'net')::numeric
  ),
  200.00,
  'o liquido do relatorio de faturamento e igual a receita operacional de get_tenant_financial_metrics'
);

select is(
  (
    select private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-05-20'::date, '2026-05-20'::date, 'day', '2026-05-20'::date, 'America/Sao_Paulo'
    ) -> 'data_quality' ->> 'status'
  ),
  'confirmed',
  'a qualidade do dado do relatorio e igual a qualidade historica de get_tenant_financial_metrics para uma comanda inteiramente confirmada'
);

-- ---------------------------------------------------------------------------
-- Agrupamento: semanas comecam na segunda-feira, meses sao civis, primeiro e
-- ultimo agrupamento recortados aos limites do periodo. Via nucleo (hoje
-- fixo), sobre tenant sem movimento (so confere a grade de datas).
-- ---------------------------------------------------------------------------
select is(
  (
    select jsonb_agg(
      jsonb_build_object('start_date', bucket ->> 'start_date', 'end_date', bucket ->> 'end_date')
      order by bucket ->> 'start_date'
    )
    from jsonb_array_elements(
      private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-06-03'::date, '2026-06-16'::date, 'week', '2026-06-16'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_array(
    jsonb_build_object('start_date', '2026-06-03', 'end_date', '2026-06-07'),
    jsonb_build_object('start_date', '2026-06-08', 'end_date', '2026-06-14'),
    jsonb_build_object('start_date', '2026-06-15', 'end_date', '2026-06-16')
  ),
  'semanas comecam na segunda-feira e sao recortadas ao periodo'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object('start_date', bucket ->> 'start_date', 'end_date', bucket ->> 'end_date')
      order by bucket ->> 'start_date'
    )
    from jsonb_array_elements(
      private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-05-15'::date, '2026-07-10'::date, 'month', '2026-07-10'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_array(
    jsonb_build_object('start_date', '2026-05-15', 'end_date', '2026-05-31'),
    jsonb_build_object('start_date', '2026-06-01', 'end_date', '2026-06-30'),
    jsonb_build_object('start_date', '2026-07-01', 'end_date', '2026-07-10')
  ),
  'meses sao civis e sao recortados ao periodo'
);

-- ---------------------------------------------------------------------------
-- Periodo anterior: N dias imediatamente anteriores ao inicio, N igual a
-- extensao do periodo.
-- ---------------------------------------------------------------------------
select is(
  (
    select private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-06-10'::date, '2026-06-19'::date, 'day', '2026-06-19'::date, 'America/Sao_Paulo'
    ) -> 'previous_period'
  ),
  jsonb_build_object('start', '2026-05-31', 'end', '2026-06-09'),
  'periodo anterior tem N dias (10) imediatamente anteriores ao inicio do periodo pedido'
);

-- ---------------------------------------------------------------------------
-- Validacao: cada limite de periodo e granularidade, com errcode 22023. Via
-- nucleo (hoje fixo em 2026-06-15).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select private.get_revenue_report_core('00000000-0000-0000-0000-000000000001'::uuid, null, '2026-06-16'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'As datas de início e fim do período são obrigatórias.', 'datas nulas sao recusadas'
);
select throws_ok(
  $$select private.get_revenue_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-05'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser anterior à data inicial.', 'fim antes do inicio e recusado'
);
select throws_ok(
  $$select private.get_revenue_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-20'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser posterior a hoje.', 'fim depois de hoje e recusado'
);
select throws_ok(
  $$select private.get_revenue_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2024-06-01'::date, '2024-06-05'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data inicial não pode ser mais de 730 dias antes de hoje.', 'inicio antes de hoje menos 730 dias e recusado'
);
select throws_ok(
  $$select private.get_revenue_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2025-06-01'::date, '2026-06-05'::date, 'month', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'O período não pode ter mais de 366 dias.', 'periodo acima de 366 dias e recusado'
);
select throws_ok(
  $$select private.get_revenue_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-12'::date, 'year', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'Granularidade desconhecida. Use dia, semana ou mês.', 'granularidade desconhecida e recusada'
);
select throws_ok(
  $$select private.get_revenue_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-01-01'::date, '2026-06-15'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A granularidade diária só é permitida em períodos de até 92 dias.', 'granularidade diaria acima de 92 dias e recusada'
);

select * from finish(true);
rollback;
