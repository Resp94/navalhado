begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

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

select * from finish(true);
rollback;
