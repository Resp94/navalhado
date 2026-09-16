begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- Spec 038 (Modulo de Relatorios), ticket 05: Ranking de profissionais e
-- Ranking de servicos (pagina Equipe e Servicos). Cobre o contrato de
-- leitura (public.get_team_services_report), o nucleo com relogio injetado
-- (private.get_team_services_report_core), reusando private.report_recognized_items
-- (ja coberta pelo 33_relatorio_faturamento).

create temporary table t05_context (
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
  values ('__t05_tenant_a__', '__t05_tenant_a__@teste.com', '11999970001', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t05_tenant_b__', '__t05_tenant_b__@teste.com', '11999970002', 'America/Sao_Paulo')
  returning id
), tc as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__t05_tenant_c__', '__t05_tenant_c__@teste.com', '11999970003', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t05_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t05_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t05_gerente_b__@teste.com') returning id
), au_gerente_nulo as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t05_gerente_nulo__@teste.com') returning id
), au_proprietario as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__t05_proprietario__@teste.com') returning id
)
insert into t05_context (
  tenant_a_id, tenant_b_id, tenant_c_id, gerente_a_id, barbeiro_a_id, gerente_b_id, gerente_nulo_id, proprietario_id
)
select ta.id, tb.id, tc.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, au_gerente_nulo.id, au_proprietario.id
from ta, tb, tc, au_gerente_a, au_barbeiro_a, au_gerente_b, au_gerente_nulo, au_proprietario;

update public.users set tenant_id = (select tenant_a_id from t05_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from t05_context);
update public.users set tenant_id = (select tenant_a_id from t05_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from t05_context);
update public.users set tenant_id = (select tenant_b_id from t05_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from t05_context);
update public.users set tenant_id = null, role = 'gerente', is_active = true
where id = (select gerente_nulo_id from t05_context);
update public.users set tenant_id = (select tenant_c_id from t05_context), role = 'proprietario', is_active = true
where id = (select proprietario_id from t05_context);

grant select on t05_context to authenticated;

-- ---------------------------------------------------------------------------
-- Contrato das funcoes: existencia, search_path vazio, privilegios.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'get_team_services_report', array['uuid', 'date', 'date', 'uuid'],
  'public.get_team_services_report(uuid, date, date, uuid) existe'
);
select has_function(
  'private', 'get_team_services_report_core', array['uuid', 'date', 'date', 'uuid', 'date', 'text'],
  'private.get_team_services_report_core(uuid, date, date, uuid, date, text) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_team_services_report(uuid,date,date,uuid)'::regprocedure),
  'a funcao publica fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.get_team_services_report_core(uuid,date,date,uuid,date,text)'::regprocedure),
  'o nucleo privado fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'public.get_team_services_report(uuid,date,date,uuid)', 'EXECUTE'),
  'anon nao executa a funcao publica'
);
select ok(
  has_function_privilege('authenticated', 'public.get_team_services_report(uuid,date,date,uuid)', 'EXECUTE'),
  'authenticated executa a funcao publica'
);
select ok(
  has_function_privilege('service_role', 'public.get_team_services_report(uuid,date,date,uuid)', 'EXECUTE'),
  'service_role executa a funcao publica'
);

select ok(
  not has_function_privilege('anon', 'private.get_team_services_report_core(uuid,date,date,uuid,date,text)', 'EXECUTE'),
  'anon nao executa o nucleo privado'
);
select ok(
  not has_function_privilege('authenticated', 'private.get_team_services_report_core(uuid,date,date,uuid,date,text)', 'EXECUTE'),
  'authenticated nao executa o nucleo privado diretamente'
);
select ok(
  has_function_privilege('service_role', 'private.get_team_services_report_core(uuid,date,date,uuid,date,text)', 'EXECUTE'),
  'service_role executa o nucleo privado'
);

-- ---------------------------------------------------------------------------
-- Acesso: barbeiro recusado, gerente pedindo outro tenant recusado, gerente
-- com tenant nulo recusado, proprietario aceito para qualquer tenant.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from t05_context), true);
set local role authenticated;
select throws_ok(
  $$select public.get_team_services_report(null, current_date, current_date, null)$$,
  '42501',
  'Acesso negado. Apenas gerentes podem acessar os relatórios.',
  'barbeiro recebe erro de acesso'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from t05_context), true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.get_team_services_report('%s'::uuid, current_date, current_date, null)$$,
    (select tenant_b_id from t05_context)
  ),
  '42501',
  'Acesso negado para a unidade solicitada.',
  'gerente pedindo outro tenant e recusado'
);
reset role;

select set_config('request.jwt.claim.sub', (select gerente_nulo_id::text from t05_context), true);
set local role authenticated;
select throws_ok(
  format(
    $$select public.get_team_services_report('%s'::uuid, current_date, current_date, null)$$,
    (select tenant_a_id from t05_context)
  ),
  '42501',
  'Acesso negado. Gerente sem unidade vinculada.',
  'gerente com tenant nulo e recusado, mesmo pedindo um tenant valido'
);
reset role;

select set_config('request.jwt.claim.sub', (select proprietario_id::text from t05_context), true);
set local role authenticated;
select ok(
  (select public.get_team_services_report((select tenant_a_id from t05_context), '2026-08-01'::date, '2026-08-01'::date, null)) ? 'totals',
  'proprietario acessa o relatorio de qualquer unidade'
);
reset role;

-- ---------------------------------------------------------------------------
-- Validacao de periodo (sem granularidade: nao ha p_granularity aqui).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select private.get_team_services_report_core('00000000-0000-0000-0000-000000000001'::uuid, null, '2026-06-16'::date, null, '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'As datas de início e fim do período são obrigatórias.', 'datas nulas sao recusadas'
);
select throws_ok(
  $$select private.get_team_services_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-05'::date, null, '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser anterior à data inicial.', 'fim antes do inicio e recusado'
);
select throws_ok(
  $$select private.get_team_services_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2026-06-10'::date, '2026-06-20'::date, null, '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data final não pode ser posterior a hoje.', 'fim depois de hoje e recusado'
);
select throws_ok(
  $$select private.get_team_services_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2024-06-01'::date, '2024-06-05'::date, null, '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'A data inicial não pode ser mais de 730 dias antes de hoje.', 'inicio antes de hoje menos 730 dias e recusado'
);
select throws_ok(
  $$select private.get_team_services_report_core('00000000-0000-0000-0000-000000000001'::uuid, '2025-06-01'::date, '2026-06-05'::date, null, '2026-06-15'::date, 'America/Sao_Paulo')$$,
  '22023', 'O período não pode ter mais de 366 dias.', 'periodo acima de 366 dias e recusado'
);

-- ---------------------------------------------------------------------------
-- Cenario principal: dois profissionais, um servico partilhado (Comanda
-- dividida), um profissional so-produto, um profissional arquivado/inativo,
-- um servico arquivado, e a armadilha do produto cartesiano (2 servicos + 2
-- produtos do mesmo profissional). Tudo no mesmo tenant/periodo para exercer
-- reconciliacao e p_professional_id juntos.
-- ---------------------------------------------------------------------------
create temporary table t05_fix (
  prof_um_id uuid not null,
  prof_dois_id uuid not null,
  prof_so_produto_id uuid not null,
  prof_arquivado_id uuid not null,
  servico_a_id uuid not null,
  servico_b_id uuid not null,
  servico_arquivado_id uuid not null,
  produto_a_id uuid not null,
  produto_b_id uuid not null,
  comanda_split_id uuid not null,
  comanda_prof_um_extra_id uuid not null,
  comanda_so_produto_id uuid not null,
  comanda_arquivado_id uuid not null,
  comanda_cartesiano_id uuid not null
) on commit drop;
insert into t05_fix (
  prof_um_id, prof_dois_id, prof_so_produto_id, prof_arquivado_id,
  servico_a_id, servico_b_id, servico_arquivado_id, produto_a_id, produto_b_id,
  comanda_split_id, comanda_prof_um_extra_id, comanda_so_produto_id, comanda_arquivado_id, comanda_cartesiano_id
) values (
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
);
grant select on t05_fix to authenticated;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_um_id, (select tenant_a_id from t05_context), '__t05_prof_um__', '11999960001', 30, true from t05_fix;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_dois_id, (select tenant_a_id from t05_context), '__t05_prof_dois__', '11999960002', 30, true from t05_fix;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_so_produto_id, (select tenant_a_id from t05_context), '__t05_prof_so_produto__', '11999960003', 30, true from t05_fix;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_arquivado_id, (select tenant_a_id from t05_context), '__t05_prof_arquivado__', '11999960004', 30, true from t05_fix;

insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active)
select servico_a_id, (select tenant_a_id from t05_context), '__t05_servico_a__', 100, 30, 'Corte', true from t05_fix;
insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active)
select servico_b_id, (select tenant_a_id from t05_context), '__t05_servico_b__', 80, 30, 'Barba', true from t05_fix;
insert into public.services (id, tenant_id, name, price, duration_minutes, category, is_active)
select servico_arquivado_id, (select tenant_a_id from t05_context), '__t05_servico_arquivado__', 60, 20, 'Corte', true from t05_fix;

insert into public.products (id, tenant_id, name, price, cost_price, stock_quantity, is_active)
select produto_a_id, (select tenant_a_id from t05_context), '__t05_produto_a__', 40, 20, 100, true from t05_fix;
insert into public.products (id, tenant_id, name, price, cost_price, stock_quantity, is_active)
select produto_b_id, (select tenant_a_id from t05_context), '__t05_produto_b__', 25, 10, 100, true from t05_fix;

-- Comanda dividida: prof_um (servico_a, 100) e prof_dois (servico_b, 80).
-- Cada um conta 1 atendimento nesta Comanda, sem contaminacao cruzada.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_split_id, (select tenant_a_id from t05_context), 'fechada', 180, 0, 0, '2026-08-20 12:00:00-03'::timestamptz
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, service_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_split_id, (select tenant_a_id from t05_context), prof_um_id, servico_a_id, 'servico', 1, 100, 100,
  'confirmed', 1, 100, 100, 0, 100, 30, 30, 'professional_service'
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, service_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_split_id, (select tenant_a_id from t05_context), prof_dois_id, servico_b_id, 'servico', 1, 80, 80,
  'confirmed', 1, 80, 80, 0, 80, 30, 24, 'professional_service'
from t05_fix;

-- prof_um tem outra Comanda sozinho (servico_a de novo, 100) -- 2 atendimentos
-- no total, services_quantity 2.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_prof_um_extra_id, (select tenant_a_id from t05_context), 'fechada', 100, 0, 0, '2026-08-21 12:00:00-03'::timestamptz
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, service_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_prof_um_extra_id, (select tenant_a_id from t05_context), prof_um_id, servico_a_id, 'servico', 1, 100, 100,
  'confirmed', 1, 100, 100, 0, 100, 30, 30, 'professional_service'
from t05_fix;

-- prof_so_produto: venda so de produto (produto_a, 40) -- NAO e atendimento.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_so_produto_id, (select tenant_a_id from t05_context), 'fechada', 40, 0, 0, '2026-08-22 12:00:00-03'::timestamptz
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, product_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_unit_cost, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_so_produto_id, (select tenant_a_id from t05_context), prof_so_produto_id, produto_a_id, 'produto', 1, 40, 40,
  'confirmed', 1, 40, 40, 0, 40, 20, 10, 4, 'professional_service'
from t05_fix;

-- prof_arquivado: servico_arquivado (60) enquanto ainda ativo/nao-arquivado
-- (trigger exige isso), depois inativado e arquivado.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_arquivado_id, (select tenant_a_id from t05_context), 'fechada', 60, 0, 0, '2026-08-23 12:00:00-03'::timestamptz
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, service_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_arquivado_id, (select tenant_a_id from t05_context), prof_arquivado_id, servico_arquivado_id, 'servico', 1, 60, 60,
  'confirmed', 1, 60, 60, 0, 60, 30, 18, 'professional_service'
from t05_fix;
update public.professionals set is_active = false, deleted_at = now()
where id = (select prof_arquivado_id from t05_fix);
update public.services set deleted_at = now()
where id = (select servico_arquivado_id from t05_fix);

-- Armadilha do produto cartesiano: prof_dois ganha MAIS um servico (servico_b
-- de novo, 80) e DOIS produtos (produto_a 40, produto_b 25) na MESMA Comanda.
-- Sem a separacao em CTEs, juntar 1 servico x 2 produtos multiplicaria.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_cartesiano_id, (select tenant_a_id from t05_context), 'fechada', 145, 0, 0, '2026-08-24 12:00:00-03'::timestamptz
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, service_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_cartesiano_id, (select tenant_a_id from t05_context), prof_dois_id, servico_b_id, 'servico', 1, 80, 80,
  'confirmed', 1, 80, 80, 0, 80, 30, 24, 'professional_service'
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, product_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_unit_cost, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_cartesiano_id, (select tenant_a_id from t05_context), prof_dois_id, produto_a_id, 'produto', 1, 40, 40,
  'confirmed', 1, 40, 40, 0, 40, 20, 10, 4, 'professional_service'
from t05_fix;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, professional_id, product_id, item_type, quantity, unit_price, total_price,
  snapshot_status, snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_unit_cost, snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule
)
select gen_random_uuid(), comanda_cartesiano_id, (select tenant_a_id from t05_context), prof_dois_id, produto_b_id, 'produto', 1, 25, 25,
  'confirmed', 1, 25, 25, 0, 25, 10, 15, 3.75, 'professional_service'
from t05_fix;

-- Totais esperados no periodo 2026-08-20..2026-08-24 (colunas do insert de
-- comanda_itens de produto sao ...snapshot_unit_cost, snapshot_commission_percentage,
-- snapshot_commission_amount... nessa ordem -- os dois produtos abaixo tem
-- commission_amount 4 e 3.75, nao os valores de commission_percentage 10/15):
-- prof_um: net 200 (100+100), attendances 2, services_quantity 2, products_net 0, commission 30+30=60.
-- prof_dois: servicos 80+80=160, produtos 40+25=65 -> net 225, attendances 2
--   (comanda_split + comanda_cartesiano), services_quantity 2, products_net 65,
--   commission 24(split servico_b)+24(cartesiano servico_b)+4(produto_a)+3.75(produto_b)=55.75.
-- prof_so_produto: net 40, attendances 0, services_quantity 0, products_net 40, commission 4.
-- prof_arquivado: net 60, attendances 1, services_quantity 1, products_net 0, commission 18.
-- totals.net = 200+225+40+60 = 525. totals.services_net = 100+100+80+80+60 = 420.
-- totals.attendances = comandas distintas com item de servico = split, extra, arquivado, cartesiano = 4.

select is(
  (
    select private.get_team_services_report_core(
      (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
    ) -> 'totals'
  ),
  jsonb_build_object('net', 525.00, 'services_net', 420.00, 'attendances', 4),
  'totais do periodo: liquido, liquido de servicos e atendimentos corretos, sem multiplicacao'
);

select is(
  (
    select jsonb_build_object(
      'net', p ->> 'net', 'attendances', p ->> 'attendances', 'services_quantity', p ->> 'services_quantity',
      'products_net', p ->> 'products_net', 'commission', p ->> 'commission', 'is_active', p ->> 'is_active', 'archived', p ->> 'archived'
    )
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_dois_id from t05_fix)
  ),
  jsonb_build_object(
    'net', '225.00', 'attendances', '2', 'services_quantity', '2',
    'products_net', '65.00', 'commission', '55.75', 'is_active', 'true', 'archived', 'false'
  ),
  'armadilha do produto cartesiano: profissional com 2 servicos e 2 produtos no periodo nao tem net/atendimentos/quantidade multiplicados'
);

select is(
  (
    select jsonb_build_object('net', p ->> 'net', 'attendances', p ->> 'attendances')
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_um_id from t05_fix)
  ),
  jsonb_build_object('net', '200.00', 'attendances', '2'),
  'Comanda dividida: prof_um tem seu proprio valor isolado (nao ganha credito do item de prof_dois)'
);

select is(
  (
    select jsonb_build_object('net', p ->> 'net', 'attendances', p ->> 'attendances')
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-20'::date, null, '2026-08-20'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_dois_id from t05_fix)
  ),
  jsonb_build_object('net', '80.00', 'attendances', '1'),
  'na Comanda dividida isolada (so o dia 20), prof_dois conta 1 atendimento e so o proprio item (80), nao o de prof_um'
);

select is(
  (
    select jsonb_build_object(
      'attendances', p ->> 'attendances', 'services_quantity', p ->> 'services_quantity',
      'products_net', p ->> 'products_net', 'commission', p ->> 'commission'
    )
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_so_produto_id from t05_fix)
  ),
  jsonb_build_object('attendances', '0', 'services_quantity', '0', 'products_net', '40.00', 'commission', '4.00'),
  'venda so de produto: atendimentos e quantidade de servicos zero, mas aparece na lista com net e comissao de produto'
);

select is(
  (
    select jsonb_build_object('is_active', p ->> 'is_active', 'archived', p ->> 'archived', 'net', p ->> 'net')
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_arquivado_id from t05_fix)
  ),
  jsonb_build_object('is_active', 'false', 'archived', 'true', 'net', '60.00'),
  'profissional inativo e arquivado com item no periodo aparece marcado'
);

select is(
  (
    select bool_or((s ->> 'archived')::boolean)
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'services'
    ) as s
    where (s ->> 'service_id')::uuid = (select servico_arquivado_id from t05_fix)
  ),
  true,
  'servico arquivado executado no periodo continua no ranking, marcado'
);

-- Reconciliacao: soma do liquido por profissional == liquido total.
select is(
  (
    select round(sum((p ->> 'net')::numeric), 2)
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
  ),
  (
    select (private.get_team_services_report_core(
      (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'net')::numeric
  ),
  'soma do liquido de professionals[] e igual ao liquido total (totals.net), por construcao'
);

-- share: participacao de prof_um (200/525).
select is(
  (
    select (p ->> 'share')::numeric
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_um_id from t05_fix)
  ),
  round(200.00 / 525.00, 4),
  'participacao de cada profissional e o liquido dele dividido pelo liquido total'
);

-- average_ticket de prof_um: 200 / 2 atendimentos = 100.
select is(
  (
    select (p ->> 'average_ticket')::numeric
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_um_id from t05_fix)
  ),
  100.00,
  'ticket medio do profissional e o liquido dele dividido pelos proprios atendimentos'
);

-- average_ticket nulo (nao zero) quando atendimentos = 0.
select is(
  (
    select (p -> 'average_ticket') = 'null'::jsonb
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
    where (p ->> 'professional_id')::uuid = (select prof_so_produto_id from t05_fix)
  ),
  true,
  'ticket medio nulo (nunca zero) quando o profissional nao tem atendimentos'
);

-- totals.attendances NAO reconcilia com a soma de professionals[].attendances
-- quando ha Comanda dividida (comanda_split conta 1 vez no total, mas 1 vez
-- para prof_um E 1 vez para prof_dois na lista) -- decisao documentada na
-- migracao, travada aqui para nao virar uma "correcao" futura equivocada.
select is(
  (
    select round(sum((p ->> 'attendances')::numeric), 0)
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    ) as p
  ) > (
    select (private.get_team_services_report_core(
      (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date, null, '2026-08-24'::date, 'America/Sao_Paulo'
    ) -> 'totals' ->> 'attendances')::numeric
  ),
  true,
  'soma de professionals[].attendances (5) ultrapassa totals.attendances (4) por causa da Comanda dividida -- nao e um bug de reconciliacao, e esperado'
);

-- ---------------------------------------------------------------------------
-- p_professional_id filtra SO a lista de servicos, nunca a de profissionais.
-- ---------------------------------------------------------------------------
select is(
  (
    select jsonb_agg(s ->> 'service_id' order by s ->> 'service_id')
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date,
        (select prof_dois_id from t05_fix), '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'services'
    ) as s
  ),
  jsonb_build_array((select servico_b_id::text from t05_fix)),
  'p_professional_id filtra a lista de servicos so aos servicos executados por aquele profissional'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(
      private.get_team_services_report_core(
        (select tenant_a_id from t05_context), '2026-08-20'::date, '2026-08-24'::date,
        (select prof_dois_id from t05_fix), '2026-08-24'::date, 'America/Sao_Paulo'
      ) -> 'professionals'
    )
  ),
  4::bigint,
  'p_professional_id NAO filtra a lista de profissionais (continuam todos os 4)'
);

-- share nulo quando totals.net e totals.services_net sao zero (periodo sem
-- nenhum item reconhecido).
select is(
  (
    select private.get_team_services_report_core(
      (select tenant_a_id from t05_context), '2026-09-01'::date, '2026-09-01'::date, null, '2026-09-01'::date, 'America/Sao_Paulo'
    ) -> 'totals'
  ),
  jsonb_build_object('net', 0.00, 'services_net', 0.00, 'attendances', 0),
  'periodo sem nenhum item reconhecido devolve totais zerados'
);
select is(
  (
    select private.get_team_services_report_core(
      (select tenant_a_id from t05_context), '2026-09-01'::date, '2026-09-01'::date, null, '2026-09-01'::date, 'America/Sao_Paulo'
    ) -> 'professionals'
  ),
  '[]'::jsonb,
  'periodo sem item reconhecido devolve lista de profissionais vazia'
);
select is(
  (
    select private.get_team_services_report_core(
      (select tenant_a_id from t05_context), '2026-09-01'::date, '2026-09-01'::date, null, '2026-09-01'::date, 'America/Sao_Paulo'
    ) -> 'services'
  ),
  '[]'::jsonb,
  'periodo sem item reconhecido devolve lista de servicos vazia'
);

select * from finish(true);
rollback;
