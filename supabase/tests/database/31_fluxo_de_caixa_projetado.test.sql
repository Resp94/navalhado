begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Spec 037 (Fluxo de Caixa Projetado), ticket 01: Realizado de Comandas
-- ponta a ponta. Cobre o contrato de leitura (public.get_projected_cash_flow),
-- o nucleo com relogio injetado (private.get_projected_cash_flow_core), o
-- indice novo e o teste cruzado com get_daily_financial_summary.
--
-- Casos que dependem de "hoje" (agrupamento, pendente, reabertura, teste
-- cruzado) chamam o nucleo privado diretamente, com "hoje" fixo. Casos de
-- acesso e de ligacao com o fuso chamam a funcao publica (relogio real).

create temporary table ticket31_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  tenant_c_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  gerente_b_id uuid not null,
  proprietario_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket31_tenant_a__', '__ticket31_tenant_a__@teste.com', '11999990001', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket31_tenant_b__', '__ticket31_tenant_b__@teste.com', '11999990002', 'America/Sao_Paulo')
  returning id
), tc as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket31_tenant_c__', '__ticket31_tenant_c__@teste.com', '11999990003', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket31_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket31_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket31_gerente_b__@teste.com') returning id
), au_proprietario as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket31_proprietario__@teste.com') returning id
)
insert into ticket31_context (
  tenant_a_id, tenant_b_id, tenant_c_id, gerente_a_id, barbeiro_a_id, gerente_b_id, proprietario_id
)
select ta.id, tb.id, tc.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, au_proprietario.id
from ta, tb, tc, au_gerente_a, au_barbeiro_a, au_gerente_b, au_proprietario;

update public.users set tenant_id = (select tenant_a_id from ticket31_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from ticket31_context);
update public.users set tenant_id = (select tenant_a_id from ticket31_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from ticket31_context);
update public.users set tenant_id = (select tenant_b_id from ticket31_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from ticket31_context);
update public.users set tenant_id = (select tenant_c_id from ticket31_context), role = 'proprietario', is_active = true
where id = (select proprietario_id from ticket31_context);

grant select on ticket31_context to authenticated;

-- ---------------------------------------------------------------------------
-- Contrato das funcoes: existencia, search_path vazio, privilegios e indice.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'get_projected_cash_flow', array['uuid', 'date', 'date', 'text'],
  'public.get_projected_cash_flow(uuid, date, date, text) existe'
);
select has_function(
  'private', 'get_projected_cash_flow_core', array['uuid', 'date', 'date', 'text', 'date', 'text'],
  'private.get_projected_cash_flow_core(uuid, date, date, text, date, text) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_projected_cash_flow(uuid,date,date,text)'::regprocedure),
  'a funcao publica fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.get_projected_cash_flow_core(uuid,date,date,text,date,text)'::regprocedure),
  'o nucleo privado fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'public.get_projected_cash_flow(uuid,date,date,text)', 'EXECUTE'),
  'anon nao executa a funcao publica'
);
select ok(
  has_function_privilege('authenticated', 'public.get_projected_cash_flow(uuid,date,date,text)', 'EXECUTE'),
  'authenticated executa a funcao publica'
);
select ok(
  has_function_privilege('service_role', 'public.get_projected_cash_flow(uuid,date,date,text)', 'EXECUTE'),
  'service_role executa a funcao publica'
);

select ok(
  not has_function_privilege('anon', 'private.get_projected_cash_flow_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'anon nao executa o nucleo privado'
);
select ok(
  not has_function_privilege('authenticated', 'private.get_projected_cash_flow_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'authenticated nao executa o nucleo privado diretamente'
);
select ok(
  has_function_privilege('service_role', 'private.get_projected_cash_flow_core(uuid,date,date,text,date,text)', 'EXECUTE'),
  'service_role executa o nucleo privado'
);

select has_index(
  'public', 'comanda_pagamentos', 'comanda_pagamentos_tenant_paid_at_idx',
  'indice por unidade e momento do pagamento existe'
);

-- ---------------------------------------------------------------------------
-- Acesso: barbeiro recusado, gerente pedindo outro tenant recusado,
-- proprietario aceito para qualquer tenant. Via funcao publica.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket31_context), true);
set local role authenticated;
select throws_ok(
  $$select public.get_projected_cash_flow(null, current_date, current_date, 'day')$$,
  '42501',
  'Acesso negado. Apenas gerentes podem acessar o fluxo de caixa projetado.',
  'barbeiro recebe erro de acesso'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket31_context), true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.get_projected_cash_flow('%s'::uuid, current_date, current_date, 'day')$$,
    (select tenant_b_id from ticket31_context)
  ),
  '42501',
  'Acesso negado para a unidade solicitada.',
  'gerente pedindo outro tenant e recusado'
);
reset role;

select set_config('request.jwt.claim.sub', (select proprietario_id::text from ticket31_context), true);
set local role authenticated;
select ok(
  (select public.get_projected_cash_flow((select tenant_a_id from ticket31_context), current_date, current_date, 'day')) ? 'buckets',
  'proprietario acessa o fluxo de qualquer unidade, tratamento identico as demais RPCs financeiras'
);
reset role;

-- ---------------------------------------------------------------------------
-- Fuso: pagamento as 23h30 locais (America/Sao_Paulo) cai no dia local, e
-- nao no dia UTC seguinte. Via funcao publica (relogio real).
-- ---------------------------------------------------------------------------
create temporary table ticket31_tz_context (comanda_id uuid not null, local_day date not null) on commit drop;
insert into ticket31_tz_context (comanda_id, local_day) values (gen_random_uuid(), current_date - 3);
grant select on ticket31_tz_context to authenticated;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, (select tenant_a_id from ticket31_context), 'fechada', 75, 0, 0
from ticket31_tz_context;

insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount, paid_at)
select comanda_id, (select tenant_a_id from ticket31_context), 'pix', 75, 0,
  ((local_day + time '23:30:00') at time zone 'America/Sao_Paulo')
from ticket31_tz_context;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket31_context), true);
set local role authenticated;
select is(
  (
    select (bucket ->> 'inflow_realized')::numeric
    from jsonb_array_elements(
      public.get_projected_cash_flow(
        (select tenant_a_id from ticket31_context),
        (select local_day from ticket31_tz_context),
        (select local_day from ticket31_tz_context),
        'day'
      ) -> 'buckets'
    ) as bucket
  ),
  75.00,
  'pagamento as 23h30 locais cai no dia local, nao no dia UTC'
);
reset role;

-- ---------------------------------------------------------------------------
-- Entradas realizadas e reabertura de Comanda. Via nucleo (hoje fixo).
-- ---------------------------------------------------------------------------
create temporary table ticket31_reab_context (comanda_id uuid not null) on commit drop;
insert into ticket31_reab_context (comanda_id) values (gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, (select tenant_a_id from ticket31_context), 'fechada', 100, 0, 0
from ticket31_reab_context;

insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount, paid_at)
select comanda_id, (select tenant_a_id from ticket31_context), 'cash', 100, 0, '2026-06-01 10:00:00-03'
from ticket31_reab_context;

select is(
  (
    select (bucket ->> 'inflow_realized')::numeric
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-06-01'::date, '2026-06-01'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  100.00,
  'pagamento de comanda fechada conta como entrada realizada'
);

-- Reabertura: apaga o pagamento vivo e arquiva em comanda_payment_reversals
-- (mesmo comportamento do gatilho real de reabertura).
delete from public.comanda_pagamentos where comanda_id = (select comanda_id from ticket31_reab_context);
insert into public.comanda_payment_reversals (
  tenant_id, comanda_id, original_payment_id, payment_method, amount, change_amount, paid_at, reversed_by, reason
)
select (select tenant_a_id from ticket31_context), comanda_id, gen_random_uuid(), 'cash', 100, 0,
  '2026-06-01 10:00:00-03', (select gerente_a_id from ticket31_context), 'Teste ticket31 reabertura'
from ticket31_reab_context;

select is(
  (
    select (bucket ->> 'inflow_realized')::numeric
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-06-01'::date, '2026-06-01'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  0.00,
  'comanda reaberta deixa de contar como entrada, sem subtrair o arquivo de estornos'
);

-- ---------------------------------------------------------------------------
-- Teste cruzado: a entrada do dia no fluxo == received_total do resumo
-- financeiro diario no mesmo dia. Resumo diario via funcao publica
-- (gerente autenticado); fluxo via nucleo (hoje fixo, sem restricao de
-- distancia de "hoje" que a funcao publica impoe).
-- ---------------------------------------------------------------------------
create temporary table ticket31_cross_context (comanda_id uuid not null) on commit drop;
insert into ticket31_cross_context (comanda_id) values (gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, (select tenant_a_id from ticket31_context), 'fechada', 100.65, 0, 0
from ticket31_cross_context;

insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount, paid_at)
select comanda_id, (select tenant_a_id from ticket31_context), v.method, v.amount, 0, '2026-06-02 12:00:00-03'::timestamptz
from ticket31_cross_context, (values ('pix', 50.00), ('cash', 30.55), ('credit_card', 20.10)) as v(method, amount);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket31_context), true);
set local role authenticated;
select is(
  (
    select (elem ->> 'received_total')::numeric
    from jsonb_array_elements(
      (public.get_daily_financial_summary('2026-06-02'::date, '2026-06-02'::date, 'America/Sao_Paulo', (select tenant_a_id from ticket31_context), null))::jsonb
    ) as elem
  ),
  100.65,
  'get_daily_financial_summary confirma o recebido do dia de referencia'
);
reset role;

select is(
  (
    select (bucket ->> 'inflow_realized')::numeric
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-06-02'::date, '2026-06-02'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  100.65,
  'a entrada do dia no fluxo de caixa e igual ao received_total do resumo financeiro diario'
);

select is(
  (
    select bucket -> 'detail' -> 'inflow_by_method'
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-06-02'::date, '2026-06-02'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_object('dinheiro', 30.55, 'pix', 50.00, 'cartao', 20.10, 'outros', 0.00),
  'detalhamento de entradas por forma de pagamento bate com os pagamentos lancados'
);

-- ---------------------------------------------------------------------------
-- Agrupamento: semanas comecam na segunda-feira, meses sao civis, e o
-- primeiro e o ultimo agrupamento sao recortados aos limites do periodo,
-- classificados como passado, atual ou futuro. Via nucleo (hoje fixo).
-- ---------------------------------------------------------------------------
select is(
  (
    select jsonb_agg(
      jsonb_build_object('start_date', bucket ->> 'start_date', 'end_date', bucket ->> 'end_date', 'kind', bucket ->> 'kind')
      order by bucket ->> 'start_date'
    )
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-06-03'::date, '2026-06-16'::date, 'week', '2026-06-10'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_array(
    jsonb_build_object('start_date', '2026-06-03', 'end_date', '2026-06-07', 'kind', 'past'),
    jsonb_build_object('start_date', '2026-06-08', 'end_date', '2026-06-14', 'kind', 'current'),
    jsonb_build_object('start_date', '2026-06-15', 'end_date', '2026-06-16', 'kind', 'future')
  ),
  'semanas comecam na segunda-feira, sao recortadas ao periodo e classificadas como passado/atual/futuro'
);

select is(
  (
    select jsonb_agg(
      jsonb_build_object('start_date', bucket ->> 'start_date', 'end_date', bucket ->> 'end_date', 'kind', bucket ->> 'kind')
      order by bucket ->> 'start_date'
    )
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-05-15'::date, '2026-07-10'::date, 'month', '2026-06-01'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_array(
    jsonb_build_object('start_date', '2026-05-15', 'end_date', '2026-05-31', 'kind', 'past'),
    jsonb_build_object('start_date', '2026-06-01', 'end_date', '2026-06-30', 'kind', 'current'),
    jsonb_build_object('start_date', '2026-07-01', 'end_date', '2026-07-10', 'kind', 'future')
  ),
  'meses sao civis, sao recortados ao periodo e classificados como passado/atual/futuro'
);

-- ---------------------------------------------------------------------------
-- pending_flow: nesta fatia, so o realizado com data posterior a hoje
-- dentro do proprio agrupamento. Via nucleo (hoje fixo).
-- ---------------------------------------------------------------------------
create temporary table ticket31_pending_context (comanda_id uuid not null) on commit drop;
insert into ticket31_pending_context (comanda_id) values (gen_random_uuid());

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, (select tenant_a_id from ticket31_context), 'fechada', 140, 0, 0
from ticket31_pending_context;

insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount, paid_at)
select comanda_id, (select tenant_a_id from ticket31_context), 'pix', 100, 0, '2026-06-09 10:00:00-03'::timestamptz
from ticket31_pending_context
union all
select comanda_id, (select tenant_a_id from ticket31_context), 'pix', 40, 0, '2026-06-12 10:00:00-03'::timestamptz
from ticket31_pending_context;

select is(
  (
    select jsonb_build_object('inflow_realized', bucket ->> 'inflow_realized', 'pending_flow', bucket ->> 'pending_flow')
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-06-08'::date, '2026-06-14'::date, 'week', '2026-06-10'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_object('inflow_realized', '140.00', 'pending_flow', '40.00'),
  'pending_flow soma so o realizado com data posterior a hoje dentro do agrupamento'
);

-- ---------------------------------------------------------------------------
-- Validacao: cada limite de periodo e granularidade, com errcode 22023.
-- Via nucleo (hoje fixo em 2026-06-15).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, null, '2026-06-16'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'As datas de início e fim do período são obrigatórias.', 'datas nulas sao recusadas'
);
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-05'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser anterior à data inicial.', 'fim antes do inicio e recusado'
);
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-16'::date, '2026-06-20'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data inicial não pode ser posterior a hoje.', 'inicio depois de hoje e recusado'
);
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, '2025-06-10'::date, '2025-06-20'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data inicial não pode ser mais de 365 dias antes de hoje.', 'inicio antes de hoje menos 365 dias e recusado'
);
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2027-06-20'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser mais de 365 dias depois de hoje.', 'fim depois de hoje mais 365 dias e recusado'
);
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, '2025-07-01'::date, '2026-07-05'::date, 'month', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'O período não pode ter mais de 366 dias.', 'periodo acima de 366 dias e recusado'
);
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-12'::date, 'year', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'Granularidade desconhecida. Use dia, semana ou mês.', 'granularidade desconhecida e recusada'
);
select throws_ok(
  $$select private.get_projected_cash_flow_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-01-01'::date, '2026-06-15'::date, 'day', '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A granularidade diária só é permitida em períodos de até 92 dias.', 'granularidade diaria acima de 92 dias e recusada'
);

-- ---------------------------------------------------------------------------
-- Ticket 02 da spec 037: Quitacoes de Comissao e vales como saida realizada.
-- Contexto proprio (tenant_a_id de ticket31_context, mes de julho/2026 para
-- nao colidir com as datas de junho ja usadas acima). "Hoje" fixo em
-- 2026-07-10, via nucleo.
-- ---------------------------------------------------------------------------
create temporary table ticket32_context (prof_ana_id uuid not null, prof_bruno_id uuid not null) on commit drop;
with pa as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select tenant_a_id, 'Ana Ticket32', '11977770032', 35, true from ticket31_context
  returning id
), pb as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select tenant_a_id, 'Bruno Ticket32', '11977770033', 35, true from ticket31_context
  returning id
)
insert into ticket32_context (prof_ana_id, prof_bruno_id) select pa.id, pb.id from pa, pb;

-- Quitacao de Ana em 07-05 (passado): amount=200, ja liquido do abate de um
-- vale de 40 (advance_amount so registra o abate, nunca e somado na leitura).
insert into public.commission_payouts (tenant_id, professional_id, amount, payment_method, paid_at, advance_amount)
select tenant_a_id, prof_ana_id, 200, 'pix', '2026-07-05 10:00:00-03'::timestamptz, 40
from ticket31_context, ticket32_context;

-- Vale de Ana em 07-03 (passado), o mesmo vale abatido acima: settled_amount
-- = amount, mas a leitura conta o vale inteiro quando foi dado, nao o saldo.
insert into public.professional_account_entries (tenant_id, professional_id, entry_type, direction, amount, settled_amount, status, reason, created_at)
select tenant_a_id, prof_ana_id, 'vale', 'debit', 40, 40, 'settled', 'Vale ticket32 (abatido)', '2026-07-03 09:00:00-03'::timestamptz
from ticket31_context, ticket32_context;

-- Quitacao futura de Ana (07-15, depois de "hoje" 07-10): entra no bucket e
-- no fluxo pendente.
insert into public.commission_payouts (tenant_id, professional_id, amount, payment_method, paid_at)
select tenant_a_id, prof_ana_id, 80, 'pix', '2026-07-15 10:00:00-03'::timestamptz
from ticket31_context, ticket32_context;

-- Quitacao de Bruno, legada (sem commission_payout_allocations), em 07-06.
insert into public.commission_payouts (tenant_id, professional_id, amount, payment_method, paid_at)
select tenant_a_id, prof_bruno_id, 150, 'pix', '2026-07-06 10:00:00-03'::timestamptz
from ticket31_context, ticket32_context;

-- Quitacao estornada de Bruno (nao deve contar).
insert into public.commission_payouts (tenant_id, professional_id, amount, payment_method, paid_at, reversed_at)
select tenant_a_id, prof_bruno_id, 999, 'pix', '2026-07-05 11:00:00-03'::timestamptz, now()
from ticket31_context, ticket32_context;

-- Vale estornado de Bruno (nao deve contar).
insert into public.professional_account_entries (tenant_id, professional_id, entry_type, direction, amount, settled_amount, status, reason, created_at, reversed_at)
select tenant_a_id, prof_bruno_id, 'vale', 'debit', 888, 0, 'open', 'Vale estornado ticket32', '2026-07-04 09:00:00-03'::timestamptz, now()
from ticket31_context, ticket32_context;

select has_index(
  'public', 'commission_payouts', 'commission_payouts_tenant_paid_at_idx',
  'indice parcial de quitacoes por unidade e data de pagamento existe'
);

-- Um unico agrupamento mensal cobre julho inteiro. outflow_realized soma
-- 200 (Ana, passado) + 80 (Ana, futuro) + 150 (Bruno, legada) + 40 (vale de
-- Ana), sem os 999/888 estornados e sem somar advance_amount de novo.
-- pending_flow = -80 (so a quitacao futura de Ana, unico realizado com data
-- posterior a "hoje").
select is(
  (
    select jsonb_build_object(
      'outflow_realized', bucket ->> 'outflow_realized',
      'pending_flow', bucket ->> 'pending_flow',
      'payouts_by_professional', bucket -> 'detail' -> 'payouts_by_professional',
      'advances_by_professional', bucket -> 'detail' -> 'advances_by_professional'
    )
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-07-01'::date, '2026-07-31'::date, 'month', '2026-07-10'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_object(
    'outflow_realized', '470.00',
    'pending_flow', '-80.00',
    'payouts_by_professional', jsonb_build_array(
      jsonb_build_object('professional_id', (select prof_ana_id from ticket32_context), 'professional_name', 'Ana Ticket32', 'amount', 280.00),
      jsonb_build_object('professional_id', (select prof_bruno_id from ticket32_context), 'professional_name', 'Bruno Ticket32', 'amount', 150.00)
    ),
    'advances_by_professional', jsonb_build_array(
      jsonb_build_object('professional_id', (select prof_ana_id from ticket32_context), 'professional_name', 'Ana Ticket32', 'amount', 40.00)
    )
  ),
  'saida realizada soma quitacoes (liquidas do abate) e vales, exclui estornos, classifica quitacao futura como pendente, e detalha por profissional'
);

-- Sangria e suprimento no mesmo periodo (gaveta aberta): nao alteram nenhum
-- numero do contrato, porque o fluxo nunca le cash_movements.
create temporary table ticket32_cash_context (cash_session_id uuid not null) on commit drop;
with cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select tenant_a_id, gerente_a_id, 500, 'open' from ticket31_context
  returning id
)
insert into ticket32_cash_context (cash_session_id) select id from cs;

insert into public.cash_movements (tenant_id, cash_session_id, type, amount, reason, performed_by, created_at)
select tenant_a_id, cash_session_id, 'sangria', 100, 'Sangria ticket32', gerente_a_id, '2026-07-08 10:00:00-03'::timestamptz
from ticket31_context, ticket32_cash_context;

insert into public.cash_movements (tenant_id, cash_session_id, type, amount, reason, performed_by, created_at)
select tenant_a_id, cash_session_id, 'suprimento', 60, 'Suprimento ticket32', gerente_a_id, '2026-07-08 11:00:00-03'::timestamptz
from ticket31_context, ticket32_cash_context;

select is(
  (
    select jsonb_build_object('outflow_realized', bucket ->> 'outflow_realized', 'pending_flow', bucket ->> 'pending_flow')
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_a_id from ticket31_context), '2026-07-01'::date, '2026-07-31'::date, 'month', '2026-07-10'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  jsonb_build_object('outflow_realized', '470.00', 'pending_flow', '-80.00'),
  'sangria e suprimento registrados no periodo nao alteram nenhum numero do contrato'
);

-- ---------------------------------------------------------------------------
-- Ticket 03 da spec 037: Entradas estimadas por dia da semana. Tenant novo
-- com horario de funcionamento proprio: segunda explicitamente fechada,
-- domingo AUSENTE da configuracao (deve ser lido como fechado, mesmo
-- tratamento). 8 tercas seguidas de R$80 nas 8 semanas imediatamente
-- anteriores a "hoje" (2026-06-30), "hoje" fora da janela.
-- ---------------------------------------------------------------------------
create temporary table ticket33_context (tenant_id uuid not null) on commit drop;
with t as (
  insert into public.tenants (name, email, phone, timezone, business_hours)
  values (
    '__ticket33_tenant__', '__ticket33_tenant__@teste.com', '11999991033', 'America/Sao_Paulo',
    '{"segunda":{"active":false},"terca":{"active":true},"quarta":{"active":true},"quinta":{"active":true},"sexta":{"active":true},"sabado":{"active":true}}'::jsonb
  )
  returning id
)
insert into ticket33_context (tenant_id) select id from t;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select gen_random_uuid(), tenant_id, 'fechada', 80, 0, 0
from ticket33_context, generate_series('2026-05-05'::date, '2026-06-23'::date, interval '7 days') d;

insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount, paid_at)
select c.id, ticket33_context.tenant_id, 'pix', 80, 0, (d.d + time '10:00:00') at time zone 'America/Sao_Paulo'
from ticket33_context,
  generate_series('2026-05-05'::date, '2026-06-23'::date, interval '7 days') d,
  lateral (
    select id from public.comandas
    where tenant_id = ticket33_context.tenant_id
    order by created_at
    offset (extract(days from d.d - '2026-05-05'::date)::int / 7)
    limit 1
  ) c;

select is(
  (
    select private.get_projected_cash_flow_core(
      (select tenant_id from ticket33_context), '2026-06-30'::date, '2026-07-12'::date, 'week', '2026-06-30'::date, 'America/Sao_Paulo'
    ) -> 'estimate'
  ),
  jsonb_build_object(
    'status', 'ok',
    'weeks_used', 8,
    'weekday_averages', jsonb_build_object('mon', 0.00, 'tue', 80.00, 'wed', 0.00, 'thu', 0.00, 'fri', 0.00, 'sat', 0.00, 'sun', 0.00)
  ),
  'com 8 semanas de historico, media de terca = 80.00 (8 recebimentos de 80 / 8 semanas), demais dias sem recebimento contam como zero na media, e N nao vem da criacao do tenant (criado agora, mas o primeiro pagamento simulado e de 2026-05-05)'
);

select is(
  (
    select jsonb_build_object(
      'inflow_estimated', bucket ->> 'inflow_estimated',
      'pending_flow', bucket ->> 'pending_flow',
      'estimated_days', bucket -> 'detail' ->> 'estimated_days',
      'closed_days', bucket -> 'detail' ->> 'closed_days'
    )
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_id from ticket33_context), '2026-06-30'::date, '2026-07-12'::date, 'week', '2026-06-30'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
    where bucket ->> 'start_date' = '2026-07-06'
  ),
  jsonb_build_object('inflow_estimated', '80.00', 'pending_flow', '80.00', 'estimated_days', '5', 'closed_days', '2'),
  'agrupamento futuro soma a estimativa dos seus dias (so terca contribui), segunda fechada e domingo ausente da configuracao contam como fechado (2 dias), os outros 5 dias ativos entram no detalhamento como estimados, e a estimativa soma ao fluxo pendente'
);

-- ---------------------------------------------------------------------------
-- Historico insuficiente: 2 semanas de historico (N < 4). O estado vira
-- "insufficient_history" e a entrada estimada de um agrupamento futuro com
-- dia ativo fica vazia (null), nao zerada.
-- ---------------------------------------------------------------------------
create temporary table ticket33_insuf_context (tenant_id uuid not null) on commit drop;
with t as (
  insert into public.tenants (name, email, phone, timezone, business_hours)
  values (
    '__ticket33_insuf_tenant__', '__ticket33_insuf_tenant__@teste.com', '11999991034', 'America/Sao_Paulo',
    '{"segunda":{"active":true},"terca":{"active":true},"quarta":{"active":true},"quinta":{"active":true},"sexta":{"active":true},"sabado":{"active":true},"domingo":{"active":true}}'::jsonb
  )
  returning id
)
insert into ticket33_insuf_context (tenant_id) select id from t;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select gen_random_uuid(), tenant_id, 'fechada', 50, 0, 0
from ticket33_insuf_context;

insert into public.comanda_pagamentos (comanda_id, tenant_id, payment_method, amount, change_amount, paid_at)
select c.id, ticket33_insuf_context.tenant_id, 'pix', 50, 0, '2026-07-25 10:00:00-03'::timestamptz
from ticket33_insuf_context, (select id from public.comandas where tenant_id = (select tenant_id from ticket33_insuf_context) limit 1) c;

select is(
  (
    select jsonb_build_object(
      'status', private.get_projected_cash_flow_core(
        (select tenant_id from ticket33_insuf_context), '2026-08-08'::date, '2026-08-09'::date, 'week', '2026-08-08'::date, 'America/Sao_Paulo'
      ) -> 'estimate' ->> 'status',
      'inflow_estimated', (
        select bucket ->> 'inflow_estimated'
        from jsonb_array_elements(
          private.get_projected_cash_flow_core(
            (select tenant_id from ticket33_insuf_context), '2026-08-08'::date, '2026-08-09'::date, 'week', '2026-08-08'::date, 'America/Sao_Paulo'
          ) -> 'buckets'
        ) as bucket
      )
    )
  ),
  jsonb_build_object('status', 'insufficient_history', 'inflow_estimated', null),
  'com menos de 4 semanas de historico, o estado e historico insuficiente e a entrada estimada de um agrupamento futuro com dia ativo (2026-08-09, domingo, ativo) fica vazia (null), nao zerada'
);

select is(
  (
    select (bucket ->> 'inflow_estimated')::numeric
    from jsonb_array_elements(
      private.get_projected_cash_flow_core(
        (select tenant_id from ticket33_insuf_context), '2026-07-06'::date, '2026-07-12'::date, 'week', '2026-08-08'::date, 'America/Sao_Paulo'
      ) -> 'buckets'
    ) as bucket
  ),
  0.00,
  'um periodo inteiramente passado (sem dia futuro no agrupamento) devolve entrada estimada zero, mesmo com historico insuficiente -- nao ha o que estimar, entao zero e o valor correto, diferente do caso de dia futuro sem historico'
);

select * from finish(true);
rollback;
