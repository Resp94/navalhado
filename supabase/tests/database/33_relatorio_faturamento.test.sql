begin;
create extension if not exists pgtap with schema extensions;
select plan(53);

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

-- ---------------------------------------------------------------------------
-- Ticket 02: Recebido por forma de pagamento. Recebido conta pela data do
-- PAGAMENTO (paid_at), nao pelo fechamento; mesmo predicado de
-- get_daily_financial_summary (Comanda fechada, sem subtrair
-- comanda_payment_reversals). Via nucleo (hoje fixo), tenant_a.
-- ---------------------------------------------------------------------------

-- (a)+(g): total do periodo, por forma, com as 5 formas sempre presentes
-- (inclusive as sem pagamento, com zero) e participacao correta.
create temporary table ticket02_metodos_context (
  comanda_id uuid not null
) on commit drop;
insert into ticket02_metodos_context (comanda_id) values (gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 100, 0, 0, '2026-07-01 10:00:00-03'::timestamptz
from ticket02_metodos_context;

insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select gen_random_uuid(), comanda_id, (select tenant_a_id from ticket01_context), 'pix', 50.00, '2026-07-01 10:05:00-03'::timestamptz
from ticket02_metodos_context;
insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select gen_random_uuid(), comanda_id, (select tenant_a_id from ticket01_context), 'cash', 30.00, '2026-07-01 10:06:00-03'::timestamptz
from ticket02_metodos_context;
insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select gen_random_uuid(), comanda_id, (select tenant_a_id from ticket01_context), 'credit_card', 20.00, '2026-07-01 10:07:00-03'::timestamptz
from ticket02_metodos_context;

select is(
  (
    select private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-07-01'::date, '2026-07-01'::date, 'day', '2026-07-01'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'received_total'
  ),
  '100.00',
  'recebido total do periodo soma os pagamentos das 3 formas usadas'
);

select is(
  (
    select private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-07-01'::date, '2026-07-01'::date, 'day', '2026-07-01'::date, 'America/Sao_Paulo'
    ) -> 'received_by_method'
  ),
  jsonb_build_array(
    jsonb_build_object('method', 'pix', 'label', 'PIX', 'amount', 50.00, 'payments_count', 1, 'share', 0.5000),
    jsonb_build_object('method', 'credit_card', 'label', 'Crédito', 'amount', 20.00, 'payments_count', 1, 'share', 0.2000),
    jsonb_build_object('method', 'debit_card', 'label', 'Débito', 'amount', 0.00, 'payments_count', 0, 'share', 0.0000),
    jsonb_build_object('method', 'cash', 'label', 'Dinheiro', 'amount', 30.00, 'payments_count', 1, 'share', 0.3000),
    jsonb_build_object('method', 'other', 'label', 'Outros', 'amount', 0.00, 'payments_count', 0, 'share', 0.0000)
  ),
  'recebido_by_method traz as 5 formas sempre, com valor/quantidade/participacao corretos e forma sem pagamento com zero'
);

-- (b): pagamento as 23h30 locais cai no dia local, nao no dia UTC seguinte.
create temporary table ticket02_tz_context (
  comanda_id uuid not null,
  local_day date not null
) on commit drop;
insert into ticket02_tz_context (comanda_id, local_day) values (gen_random_uuid(), '2026-07-05'::date);

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 40, 0, 0, ((local_day + time '20:00:00') at time zone 'America/Sao_Paulo')
from ticket02_tz_context;
insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select gen_random_uuid(), comanda_id, (select tenant_a_id from ticket01_context), 'pix', 40.00, ((local_day + time '23:30:00') at time zone 'America/Sao_Paulo')
from ticket02_tz_context;

select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context),
      (select local_day from ticket02_tz_context), (select local_day from ticket02_tz_context),
      'day', (select local_day from ticket02_tz_context), 'America/Sao_Paulo'
    ) -> 'totals' ->> 'received_total')::numeric
  ),
  40.00,
  'pagamento as 23h30 locais conta no dia de negocio local, nao no dia UTC seguinte'
);

-- (c): comanda reaberta (pagamento estornado, linha viva apagada e copiada
-- para o arquivo de estornos) some do recebido, sem subtrair o arquivo.
create temporary table ticket02_reabertura_context (
  comanda_id uuid not null,
  pagamento_id uuid not null
) on commit drop;
insert into ticket02_reabertura_context (comanda_id, pagamento_id) values (gen_random_uuid(), gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 60, 0, 0, '2026-07-06 11:00:00-03'::timestamptz
from ticket02_reabertura_context;
insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select pagamento_id, comanda_id, (select tenant_a_id from ticket01_context), 'cash', 60.00, '2026-07-06 11:05:00-03'::timestamptz
from ticket02_reabertura_context;

select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-07-06'::date, '2026-07-06'::date, 'day', '2026-07-06'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'received_total')::numeric
  ),
  60.00,
  'antes da reabertura, o pagamento conta no recebido'
);

-- Simula a reabertura: apaga a linha viva de comanda_pagamentos e copia para
-- comanda_payment_reversals (o mesmo rastro que reopen_comanda deixa).
with moved as (
  delete from public.comanda_pagamentos cp
  using ticket02_reabertura_context rc
  where cp.id = rc.pagamento_id
  returning cp.*
)
insert into public.comanda_payment_reversals (
  id, tenant_id, comanda_id, original_payment_id, cash_session_id, payment_method, amount, paid_at, reversed_by, reason, reversed_at
)
select gen_random_uuid(), moved.tenant_id, moved.comanda_id, moved.id, moved.cash_session_id, moved.payment_method, moved.amount, moved.paid_at,
  (select gerente_a_id from ticket01_context), 'teste ticket02: comanda reaberta', now()
from moved;

select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-07-06'::date, '2026-07-06'::date, 'day', '2026-07-06'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'received_total')::numeric
  ),
  0.00,
  'depois da reabertura (linha viva apagada e copiada para o arquivo de estornos), o pagamento some do recebido, sem subtrair o arquivo'
);

-- (d): teste cruzado, o recebido de um dia e igual ao received_total de
-- get_daily_financial_summary no mesmo dia.
create temporary table ticket02_cruzado_context (comanda_id uuid not null) on commit drop;
insert into ticket02_cruzado_context (comanda_id) values (gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 80, 0, 0, '2026-07-08 09:00:00-03'::timestamptz
from ticket02_cruzado_context;
insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select gen_random_uuid(), comanda_id, (select tenant_a_id from ticket01_context), 'cash', 80.00, '2026-07-08 09:05:00-03'::timestamptz
from ticket02_cruzado_context;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket01_context), true);
set local role authenticated;
select is(
  (
    select (elem ->> 'received_total')::numeric
    from json_array_elements(
      public.get_daily_financial_summary(
        '2026-07-08'::date, '2026-07-08'::date, 'America/Sao_Paulo', (select tenant_a_id from ticket01_context)
      )
    ) as elem
    where (elem ->> 'date')::date = '2026-07-08'::date
  ),
  80.00,
  'get_daily_financial_summary confirma o recebido do dia de referencia'
);
reset role;

select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-07-08'::date, '2026-07-08'::date, 'day', '2026-07-08'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'received_total')::numeric
  ),
  80.00,
  'o recebido do relatorio de faturamento e igual ao received_total de get_daily_financial_summary para o mesmo dia'
);

-- (e): armadilha do produto cartesiano. Duas Comandas fechadas em dois dias
-- diferentes do MESMO agrupamento (semana), com um pagamento em cada uma
-- delas nesses mesmos dias: bruto/liquido/Comandas fechadas E recebido nao
-- podem sair multiplicados (produto cartesiano entre a fonte de
-- faturamento e a fonte de recebido, ou entre elas e comandas_agg).
-- item_1/item_2 sao servico (150/250, ja existiam); item_1_produto/
-- item_2_produto sao produto (20/40, novos) para exercitar services_net e
-- products_net separados no mesmo cenario, sem dobrar nenhum dos dois.
-- tip_amount tambem passa a ser diferente de zero nas duas Comandas (15/25)
-- para exercitar tips sem dobrar. Os pagamentos ja usavam formas diferentes
-- em cada dia (pix/cash), o que tambem serve para exercitar o
-- received_by_method por agrupamento (bucket), nao so o total do periodo.
create temporary table ticket02_cartesiano_context (
  comanda_1_id uuid not null,
  comanda_2_id uuid not null,
  item_1_id uuid not null,
  item_2_id uuid not null,
  item_1_produto_id uuid not null,
  item_2_produto_id uuid not null
) on commit drop;
insert into ticket02_cartesiano_context (comanda_1_id, comanda_2_id, item_1_id, item_2_id, item_1_produto_id, item_2_produto_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_1_id, (select tenant_a_id from ticket01_context), 'fechada', 185, 0, 15, '2026-07-13 12:00:00-03'::timestamptz
from ticket02_cartesiano_context;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_2_id, (select tenant_a_id from ticket01_context), 'fechada', 315, 0, 25, '2026-07-14 12:00:00-03'::timestamptz
from ticket02_cartesiano_context;

insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_1_id, comanda_1_id, (select tenant_a_id from ticket01_context), 'servico', 1, 150, 150, 'unavailable'
from ticket02_cartesiano_context;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_2_id, comanda_2_id, (select tenant_a_id from ticket01_context), 'servico', 1, 250, 250, 'unavailable'
from ticket02_cartesiano_context;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_1_produto_id, comanda_1_id, (select tenant_a_id from ticket01_context), 'produto', 1, 20, 20, 'unavailable'
from ticket02_cartesiano_context;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_2_produto_id, comanda_2_id, (select tenant_a_id from ticket01_context), 'produto', 1, 40, 40, 'unavailable'
from ticket02_cartesiano_context;

insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select gen_random_uuid(), comanda_1_id, (select tenant_a_id from ticket01_context), 'pix', 150.00, '2026-07-13 12:05:00-03'::timestamptz
from ticket02_cartesiano_context;
insert into public.comanda_pagamentos (id, comanda_id, tenant_id, payment_method, amount, paid_at)
select gen_random_uuid(), comanda_2_id, (select tenant_a_id from ticket01_context), 'cash', 250.00, '2026-07-14 12:05:00-03'::timestamptz
from ticket02_cartesiano_context;

select is(
  (
    select jsonb_build_object(
      'gross', tot ->> 'gross', 'net', tot ->> 'net', 'closed_comandas', tot ->> 'closed_comandas',
      'services_net', tot ->> 'services_net', 'products_net', tot ->> 'products_net', 'tips', tot ->> 'tips'
    )
    from (
      select private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-07-13'::date, '2026-07-19'::date, 'week', '2026-07-19'::date, 'America/Sao_Paulo'
      ) -> 'totals' as tot
    ) s
  ),
  jsonb_build_object(
    'gross', '460.00', 'net', '460.00', 'closed_comandas', '2',
    'services_net', '400.00', 'products_net', '60.00', 'tips', '40.00'
  ),
  'duas Comandas fechadas em dois dias do mesmo agrupamento nao multiplicam bruto/liquido/Comandas fechadas/services_net/products_net/tips'
);

-- Fix do ticket 03 (assimetria de denominador): o ticket medio dos TOTAIS
-- (periodo com um unico agrupamento de semana, cobrindo os 2 dias de
-- negocio acima, cada um com sua propria Comanda) precisa usar a contagem
-- DIRETA de comanda_id distinto em `recognized` (2 Comandas), nao a soma das
-- contagens ja por-bucket -- as duas formas so coincidiam por um invariante
-- nao garantido (uma comanda pode, em tese, ter itens reconhecidos em mais
-- de um business_day dentro do mesmo agrupamento). liquido (460) / Comandas
-- com item (2) = 230.00.
select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-07-13'::date, '2026-07-19'::date, 'week', '2026-07-19'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'average_ticket')::numeric
  ),
  230.00,
  'ticket medio dos totais, num agrupamento (semana) com 2 dias de negocio e 2 Comandas distintas, e o liquido (460) dividido pela contagem direta de Comandas com item reconhecido (2), nao pela soma das contagens por-bucket'
);

select is(
  (
    select bucket -> 'received_by_method'
    from jsonb_array_elements(
      private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-07-13'::date, '2026-07-19'::date, 'week', '2026-07-19'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_array(
    jsonb_build_object('method', 'pix', 'label', 'PIX', 'amount', 150.00, 'payments_count', 1),
    jsonb_build_object('method', 'credit_card', 'label', 'Crédito', 'amount', 0.00, 'payments_count', 0),
    jsonb_build_object('method', 'debit_card', 'label', 'Débito', 'amount', 0.00, 'payments_count', 0),
    jsonb_build_object('method', 'cash', 'label', 'Dinheiro', 'amount', 250.00, 'payments_count', 1),
    jsonb_build_object('method', 'other', 'label', 'Outros', 'amount', 0.00, 'payments_count', 0)
  ),
  'dois pagamentos com formas diferentes em dois dias do mesmo agrupamento (semana) nao multiplicam o received_by_method por agrupamento'
);

select is(
  (
    select private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-07-13'::date, '2026-07-19'::date, 'week', '2026-07-19'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'received_total'
  ),
  '400.00',
  'dois pagamentos em dois dias do mesmo agrupamento nao multiplicam o recebido'
);

-- (f): participacao nula quando o periodo nao teve recebimento (nunca
-- divisao por zero).
select is(
  (
    select bool_and((elem -> 'share') = 'null'::jsonb)
    from jsonb_array_elements(
      private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-07-20'::date, '2026-07-20'::date, 'day', '2026-07-20'::date, 'America/Sao_Paulo'
      ) -> 'received_by_method'
    ) as elem
  ),
  true,
  'participacao de todas as formas e nula quando o periodo nao teve recebimento, nunca divisao por zero'
);

-- ---------------------------------------------------------------------------
-- Ticket 03: Evolucao do ticket medio. Ticket medio = liquido reconhecido /
-- Comandas fechadas com ao menos um item reconhecido -- denominador
-- DIFERENTE de closed_comandas (que conta toda Comanda fechada, mesmo sem
-- item reconhecido). Via nucleo (hoje fixo), tenant_a.
-- ---------------------------------------------------------------------------

-- (a): ticket medio nos totais, no periodo anterior e por agrupamento, com
-- 2 Comandas com item reconhecido em dois dias do periodo e 1 Comanda no
-- periodo anterior.
create temporary table ticket03_medio_context (
  comanda_a_id uuid not null,
  comanda_b_id uuid not null,
  comanda_c_id uuid not null,
  item_a_id uuid not null,
  item_b_id uuid not null,
  item_c_id uuid not null
) on commit drop;
insert into ticket03_medio_context (comanda_a_id, comanda_b_id, comanda_c_id, item_a_id, item_b_id, item_c_id)
values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_a_id, (select tenant_a_id from ticket01_context), 'fechada', 110, 10, 0, '2026-08-03 12:00:00-03'::timestamptz
from ticket03_medio_context;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_b_id, (select tenant_a_id from ticket01_context), 'fechada', 200, 0, 0, '2026-08-04 12:00:00-03'::timestamptz
from ticket03_medio_context;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_c_id, (select tenant_a_id from ticket01_context), 'fechada', 50, 0, 0, '2026-08-01 12:00:00-03'::timestamptz
from ticket03_medio_context;

insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_a_id, comanda_a_id, (select tenant_a_id from ticket01_context), 'servico', 1, 110, 110,
  'confirmed', 1, 110, 110, 10, 100, 30, 30, 'professional_service'
from ticket03_medio_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_b_id, comanda_b_id, (select tenant_a_id from ticket01_context), 'servico', 1, 200, 200,
  'confirmed', 1, 200, 200, 0, 200, 30, 60, 'professional_service'
from ticket03_medio_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_c_id, comanda_c_id, (select tenant_a_id from ticket01_context), 'servico', 1, 50, 50,
  'confirmed', 1, 50, 50, 0, 50, 30, 15, 'professional_service'
from ticket03_medio_context;

select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-08-03'::date, '2026-08-04'::date, 'day', '2026-08-04'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'average_ticket')::numeric
  ),
  150.00,
  'ticket medio dos totais e liquido (300) / Comandas com item reconhecido (2)'
);

select is(
  (
    select (private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-08-03'::date, '2026-08-04'::date, 'day', '2026-08-04'::date, 'America/Sao_Paulo'
    ) -> 'previous_totals' ->> 'average_ticket')::numeric
  ),
  50.00,
  'ticket medio do periodo anterior (2026-08-01 a 2026-08-02) e liquido (50) / Comandas com item (1)'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object('start_date', bucket ->> 'start_date', 'average_ticket', (bucket ->> 'average_ticket')::numeric)
      order by bucket ->> 'start_date'
    )
    from jsonb_array_elements(
      private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-08-03'::date, '2026-08-04'::date, 'day', '2026-08-04'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_array(
    jsonb_build_object('start_date', '2026-08-03', 'average_ticket', 100.00),
    jsonb_build_object('start_date', '2026-08-04', 'average_ticket', 200.00)
  ),
  'ticket medio por agrupamento (dia) e o liquido do dia dividido pelas Comandas com item reconhecido daquele dia'
);

-- (b): item revertido CONTA para o denominador do ticket medio, mesmo
-- contribuindo zero ao numerador -- decisao registrada no comentario da
-- migracao do ticket 03: report_recognized_items emite uma linha (net=0)
-- para o item revertido, entao a Comanda aparece em `recognized` e conta
-- como "Comanda com item reconhecido".
create temporary table ticket03_revertido_context (comanda_id uuid not null, item_id uuid not null) on commit drop;
insert into ticket03_revertido_context (comanda_id, item_id) values (gen_random_uuid(), gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 999, 0, 0, '2026-08-06 12:00:00-03'::timestamptz
from ticket03_revertido_context;
insert into public.comanda_itens (id, comanda_id, tenant_id, item_type, quantity, unit_price, total_price, snapshot_status)
select item_id, comanda_id, (select tenant_a_id from ticket01_context), 'servico', 1, 999, 999, 'reverted'
from ticket03_revertido_context;

select is(
  (
    select jsonb_build_object('closed_comandas', bucket ->> 'closed_comandas', 'average_ticket', bucket ->> 'average_ticket')
    from jsonb_array_elements(
      private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-08-06'::date, '2026-08-06'::date, 'day', '2026-08-06'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_object('closed_comandas', '1', 'average_ticket', '0.00'),
  'Comanda fechada cujo unico item foi revertido conta para o denominador do ticket medio (ticket medio 0.00, nao nulo)'
);

-- (c): agrupamento com Comanda fechada mas SEM NENHUM item (nenhuma linha
-- em recognized) tem ticket medio NULO, mesmo com closed_comandas = 1 --
-- prova de que os dois denominadores sao diferentes.
create temporary table ticket03_sem_item_context (comanda_id uuid not null) on commit drop;
insert into ticket03_sem_item_context (comanda_id) values (gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, (select tenant_a_id from ticket01_context), 'fechada', 0, 0, 0, '2026-08-07 12:00:00-03'::timestamptz
from ticket03_sem_item_context;

select is(
  (
    select jsonb_build_object(
      'closed_comandas', bucket ->> 'closed_comandas',
      'average_ticket_is_null', (bucket -> 'average_ticket') = 'null'::jsonb
    )
    from jsonb_array_elements(
      private.get_revenue_report_core(
        (select tenant_a_id from ticket01_context), '2026-08-07'::date, '2026-08-07'::date, 'day', '2026-08-07'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_object('closed_comandas', '1', 'average_ticket_is_null', true),
  'Comanda fechada sem nenhum item reconhecido nao entra no denominador do ticket medio: agrupamento com Comanda mas sem item reconhecido devolve ticket medio nulo, nunca zero, mesmo com closed_comandas = 1'
);

-- (d): Comanda com dois profissionais conta uma Comanda para cada um, com o
-- valor de cada item isolado para quem executou; um dos profissionais tem
-- outra Comanda sozinho, somada ao ticket dele.
create temporary table ticket03_profissionais_context (
  prof_um_id uuid not null,
  prof_dois_id uuid not null,
  comanda_f_id uuid not null,
  comanda_g_id uuid not null,
  item_f1_id uuid not null,
  item_f2_id uuid not null,
  item_g_id uuid not null
) on commit drop;
insert into ticket03_profissionais_context (
  prof_um_id, prof_dois_id, comanda_f_id, comanda_g_id, item_f1_id, item_f2_id, item_g_id
) values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);
grant select on ticket03_profissionais_context to authenticated;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_um_id, (select tenant_a_id from ticket01_context), '__ticket03_prof_um__', '11999990001', 30, true
from ticket03_profissionais_context;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_dois_id, (select tenant_a_id from ticket01_context), '__ticket03_prof_dois__', '11999990002', 30, true
from ticket03_profissionais_context;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_f_id, (select tenant_a_id from ticket01_context), 'fechada', 150, 0, 0, '2026-08-09 12:00:00-03'::timestamptz
from ticket03_profissionais_context;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_g_id, (select tenant_a_id from ticket01_context), 'fechada', 80, 0, 0, '2026-08-10 12:00:00-03'::timestamptz
from ticket03_profissionais_context;

insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_f1_id, comanda_f_id, (select tenant_a_id from ticket01_context), prof_um_id, 'servico', 1, 100, 100,
  'confirmed', 1, 100, 100, 0, 100, 30, 30, 'professional_service'
from ticket03_profissionais_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_f2_id, comanda_f_id, (select tenant_a_id from ticket01_context), prof_dois_id, 'servico', 1, 50, 50,
  'confirmed', 1, 50, 50, 0, 50, 30, 15, 'professional_service'
from ticket03_profissionais_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_g_id, comanda_g_id, (select tenant_a_id from ticket01_context), prof_um_id, 'servico', 1, 80, 80,
  'confirmed', 1, 80, 80, 0, 80, 30, 24, 'professional_service'
from ticket03_profissionais_context;

select is(
  (
    select private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-08-09'::date, '2026-08-10'::date, 'day', '2026-08-10'::date, 'America/Sao_Paulo'
    ) -> 'ticket_by_professional'
  ),
  (
    select jsonb_build_array(
      jsonb_build_object(
        'professional_id', prof_um_id, 'name', '__ticket03_prof_um__', 'is_active', true, 'archived', false,
        'net', 180.00, 'comandas', 2, 'average_ticket', 90.00
      ),
      jsonb_build_object(
        'professional_id', prof_dois_id, 'name', '__ticket03_prof_dois__', 'is_active', true, 'archived', false,
        'net', 50.00, 'comandas', 1, 'average_ticket', 50.00
      )
    )
    from ticket03_profissionais_context
  ),
  'Comanda com dois profissionais conta uma Comanda para cada um, com o liquido isolado de cada um; profissional com outra Comanda sozinho soma liquido e Comandas'
);

-- (e): profissional inativo e profissional arquivado com item no periodo
-- continuam em ticket_by_professional, marcados como tal (nao filtrado como
-- em get_tenant_financial_metrics).
create temporary table ticket03_inativos_context (
  prof_inativo_id uuid not null,
  prof_arquivado_id uuid not null,
  comanda_h_id uuid not null,
  comanda_i_id uuid not null,
  item_h_id uuid not null,
  item_i_id uuid not null
) on commit drop;
insert into ticket03_inativos_context (
  prof_inativo_id, prof_arquivado_id, comanda_h_id, comanda_i_id, item_h_id, item_i_id
) values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);
grant select on ticket03_inativos_context to authenticated;

-- Inseridos ATIVOS (o trigger validate_comanda_item_references exige
-- profissional ativo e nao arquivado no momento em que o item e criado --
-- o mesmo motivo pelo qual soft delete existe: o historico e preservado,
-- mas a inativacao/arquivamento so pode acontecer DEPOIS do atendimento).
-- Inativados/arquivados so depois de o item ja existir.
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_inativo_id, (select tenant_a_id from ticket01_context), '__ticket03_prof_inativo__', '11999990003', 30, true
from ticket03_inativos_context;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_arquivado_id, (select tenant_a_id from ticket01_context), '__ticket03_prof_arquivado__', '11999990004', 30, true
from ticket03_inativos_context;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_h_id, (select tenant_a_id from ticket01_context), 'fechada', 60, 0, 0, '2026-08-11 12:00:00-03'::timestamptz
from ticket03_inativos_context;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_i_id, (select tenant_a_id from ticket01_context), 'fechada', 40, 0, 0, '2026-08-12 12:00:00-03'::timestamptz
from ticket03_inativos_context;

insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_h_id, comanda_h_id, (select tenant_a_id from ticket01_context), prof_inativo_id, 'servico', 1, 60, 60,
  'confirmed', 1, 60, 60, 0, 60, 30, 18, 'professional_service'
from ticket03_inativos_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select item_i_id, comanda_i_id, (select tenant_a_id from ticket01_context), prof_arquivado_id, 'servico', 1, 40, 40,
  'confirmed', 1, 40, 40, 0, 40, 30, 12, 'professional_service'
from ticket03_inativos_context;

-- So agora, com os itens ja gravados, o profissional e inativado/arquivado.
update public.professionals set is_active = false
where id = (select prof_inativo_id from ticket03_inativos_context);
update public.professionals set deleted_at = now()
where id = (select prof_arquivado_id from ticket03_inativos_context);

select is(
  (
    select private.get_revenue_report_core(
      (select tenant_a_id from ticket01_context), '2026-08-11'::date, '2026-08-12'::date, 'day', '2026-08-12'::date, 'America/Sao_Paulo'
    ) -> 'ticket_by_professional'
  ),
  (
    select jsonb_build_array(
      jsonb_build_object(
        'professional_id', prof_inativo_id, 'name', '__ticket03_prof_inativo__', 'is_active', false, 'archived', false,
        'net', 60.00, 'comandas', 1, 'average_ticket', 60.00
      ),
      jsonb_build_object(
        'professional_id', prof_arquivado_id, 'name', '__ticket03_prof_arquivado__', 'is_active', true, 'archived', true,
        'net', 40.00, 'comandas', 1, 'average_ticket', 40.00
      )
    )
    from ticket03_inativos_context
  ),
  'profissional inativo e profissional arquivado com item no periodo continuam em ticket_by_professional, marcados como tal'
);

select * from finish(true);
rollback;
