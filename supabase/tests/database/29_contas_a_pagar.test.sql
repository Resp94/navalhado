begin;
create extension if not exists pgtap with schema extensions;
select plan(194);

-- Spec 036 (Contas a Pagar). Ticket 06: tabela public.payables, RPC de criacao
-- avulsa (create_payable) e RPC de leitura paginada (list_payables), migration
-- 20260913180000_livro_de_contas_a_pagar.sql. Ticket 07: tabela
-- public.payable_settlements (Baixa) e RPCs settle_payable,
-- reverse_payable_settlement, get_payable, list_payable_settlements,
-- migration 20260914090000_baixa_fora_do_caixa_e_estorno.sql. Ticket 08:
-- update_payable (edicao limitada pelo estado) e cancel_payable (terminal,
-- sem Baixa ativa), migration 20260914100000_editar_e_cancelar_conta_a_pagar.sql.
-- Ticket 09: filtro de categoria/fornecedor em list_payables,
-- get_payables_totals e get_payables_alert, migration
-- 20260914110000_filtros_totais_e_alerta_de_vencidas.sql. Ticket 11: tabela
-- payable_series, calendario ancorado (private.compute_series_due_date),
-- preview_payable_series, create_recurring_payable_series e get_payable
-- com resumo da Serie, migration
-- 20260914120000_recorrencia_com_calendario_ancorado_e_previa.sql. Ticket 12:
-- create_installment_payable_series (Parcelamento, residuo na ultima
-- parcela), migration
-- 20260914130000_parcelamento_com_residuo_na_ultima_parcela.sql. Ticket 13:
-- update_payable_series e cancel_payable_series ("esta e as seguintes em
-- aberto"), migration 20260914140000_edicao_e_cancelamento_em_serie.sql
-- (e o fix 20260914140001, id ambiguo por causa do returns table).

-- ---------------------------------------------------------------------------
-- Contrato: tabela, funcoes, search_path fixo e privilegios.
-- ---------------------------------------------------------------------------
select has_table('public', 'payables', 'tabela payables existe');

select has_function(
  'public', 'create_payable',
  array['text', 'uuid', 'numeric', 'date', 'uuid', 'date', 'text', 'text', 'uuid'],
  'public.create_payable(...) existe'
);
select has_function(
  'public', 'list_payables',
  array['date', 'date', 'text', 'integer', 'integer', 'uuid'],
  'public.list_payables(...) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.create_payable(text,uuid,numeric,date,uuid,date,text,text,uuid)'::regprocedure),
  'create_payable fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.list_payables(date,date,text,integer,integer,uuid)'::regprocedure),
  'list_payables fixa search_path vazio'
);

select ok(
  not has_table_privilege('anon', 'public.payables', 'SELECT'),
  'anon nao tem privilegio de SELECT em payables'
);
select ok(
  not has_function_privilege('anon', 'public.create_payable(text,uuid,numeric,date,uuid,date,text,text,uuid)', 'EXECUTE'),
  'anon nao executa create_payable'
);
select ok(
  not has_table_privilege('authenticated', 'public.payables', 'INSERT'),
  'authenticated nao tem privilegio de INSERT direto em payables'
);
select ok(
  not has_table_privilege('authenticated', 'public.payables', 'UPDATE'),
  'authenticated nao tem privilegio de UPDATE direto em payables'
);
select ok(
  not has_table_privilege('authenticated', 'public.payables', 'DELETE'),
  'authenticated nao tem privilegio de DELETE direto em payables'
);
select ok(
  has_function_privilege('service_role', 'public.create_payable(text,uuid,numeric,date,uuid,date,text,text,uuid)', 'EXECUTE'),
  'service_role executa create_payable'
);

-- ---------------------------------------------------------------------------
-- Contexto: dois tenants, gestor e profissional em cada. Tenant A com fuso
-- diferente de UTC (America/Sao_Paulo, UTC-3), usado no teste de fronteira do
-- dia de negocio abaixo.
-- ---------------------------------------------------------------------------
create temporary table ticket29_context (
  tenant_a_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  tenant_b_id uuid not null,
  gerente_b_id uuid not null,
  categoria_ativa_id uuid not null,
  categoria_arquivada_id uuid not null,
  categoria_tenant_b_id uuid not null,
  fornecedor_ativo_id uuid not null,
  fornecedor_arquivado_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29_tenant_a__', '__ticket29_tenant_a__@teste.com', '11999999991', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29_tenant_b__', '__ticket29_tenant_b__@teste.com', '11999999992', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket29_gerente_a__auth@teste.com')
  returning id
), au_barbeiro_a as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket29_barbeiro_a__auth@teste.com')
  returning id
), au_gerente_b as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket29_gerente_b__auth@teste.com')
  returning id
), cat_ativa as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket29 Categoria Ativa' from ta
  returning id
), cat_arquivada as (
  insert into public.financial_categories (tenant_id, nature, name, archived_at, archived_by)
  select ta.id, 'expense', 'Ticket29 Categoria Arquivada', now(), au_gerente_a.id from ta, au_gerente_a
  returning id
), cat_tenant_b as (
  insert into public.financial_categories (tenant_id, nature, name)
  select tb.id, 'expense', 'Ticket29 Categoria Tenant B' from tb
  returning id
), forn_ativo as (
  insert into public.suppliers (tenant_id, name)
  select ta.id, 'Ticket29 Fornecedor Ativo' from ta
  returning id
), forn_arquivado as (
  insert into public.suppliers (tenant_id, name, archived_at, archived_by)
  select ta.id, 'Ticket29 Fornecedor Arquivado', now(), au_gerente_a.id from ta, au_gerente_a
  returning id
)
insert into ticket29_context (
  tenant_a_id, gerente_a_id, barbeiro_a_id, tenant_b_id, gerente_b_id,
  categoria_ativa_id, categoria_arquivada_id, categoria_tenant_b_id,
  fornecedor_ativo_id, fornecedor_arquivado_id
)
select
  ta.id, au_gerente_a.id, au_barbeiro_a.id, tb.id, au_gerente_b.id,
  cat_ativa.id, cat_arquivada.id, cat_tenant_b.id,
  forn_ativo.id, forn_arquivado.id
from ta, tb, au_gerente_a, au_barbeiro_a, au_gerente_b,
     cat_ativa, cat_arquivada, cat_tenant_b, forn_ativo, forn_arquivado;

update public.users
set tenant_id = (select tenant_a_id from ticket29_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from ticket29_context);
update public.users
set tenant_id = (select tenant_a_id from ticket29_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from ticket29_context);
update public.users
set tenant_id = (select tenant_b_id from ticket29_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from ticket29_context);

grant select on ticket29_context to authenticated;

-- ---------------------------------------------------------------------------
-- create_payable: caminho feliz, normalizacao e recusas.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29_context), true);
set local role authenticated;

create temporary table ticket29_created (id uuid, description text, competence_date date) on commit drop;
grant select, insert on ticket29_created to authenticated;

insert into ticket29_created (id, description, competence_date)
select id, description, competence_date
from public.create_payable(
  '  Aluguel   de   Setembro  ', (select categoria_ativa_id from ticket29_context), 1200.005, '2026-09-30',
  (select fornecedor_ativo_id from ticket29_context)
);

select is(
  (select description from ticket29_created),
  'Aluguel de Setembro',
  'create_payable normaliza pontas e espacos internos da descricao'
);
select is(
  (select amount from public.payables where id = (select id from ticket29_created)),
  1200.01,
  'create_payable arredonda o valor a duas casas'
);
select is(
  (select competence_date from ticket29_created),
  '2026-09-30'::date,
  'create_payable usa o vencimento como competencia quando nao informada'
);
select is(
  (select status from public.payables where id = (select id from ticket29_created)),
  'open',
  'conta avulsa nasce em aberto'
);

select throws_ok(
  format(
    $$select public.create_payable('Categoria arquivada', '%s'::uuid, 100, '2026-09-30')$$,
    (select categoria_arquivada_id from ticket29_context)
  ),
  '22023',
  'Categoria de despesa informada não existe ou está arquivada.',
  'create_payable recusa categoria arquivada'
);
select throws_ok(
  format(
    $$select public.create_payable('Fornecedor arquivado', '%s'::uuid, 100, '2026-09-30', '%s'::uuid)$$,
    (select categoria_ativa_id from ticket29_context),
    (select fornecedor_arquivado_id from ticket29_context)
  ),
  '22023',
  'Fornecedor informado não existe ou está arquivado.',
  'create_payable recusa fornecedor arquivado'
);
select throws_ok(
  format(
    $$select public.create_payable('Categoria de outro tenant', '%s'::uuid, 100, '2026-09-30')$$,
    (select categoria_tenant_b_id from ticket29_context)
  ),
  '22023',
  'Categoria de despesa informada não existe ou está arquivada.',
  'create_payable recusa categoria de outro tenant (nao encontrada, sem vazar existencia)'
);
select throws_ok(
  format(
    $$select public.create_payable('Valor invalido', '%s'::uuid, 0, '2026-09-30')$$,
    (select categoria_ativa_id from ticket29_context)
  ),
  '22023',
  'O valor deve ser maior que zero.',
  'create_payable recusa valor zero'
);
select throws_ok(
  format(
    $$select public.create_payable('Sem vencimento', '%s'::uuid, 100, null)$$,
    (select categoria_ativa_id from ticket29_context)
  ),
  '22023',
  'Vencimento é obrigatório.',
  'create_payable recusa vencimento ausente'
);

reset role;

-- ---------------------------------------------------------------------------
-- payables_status_paid_amount_check: recusa gravacao incoerente entre status
-- e valor baixado mesmo em escrita direta como superusuario (nao passa pela
-- RPC de Baixa, que so chega no ticket 07/036).
-- ---------------------------------------------------------------------------
select throws_ok(
  format(
    $$insert into public.payables (tenant_id, description, category_id, amount, paid_amount, status, due_date, competence_date)
      values ('%s'::uuid, 'Status incoerente 1', '%s'::uuid, 100, 100, 'open', '2026-09-30', '2026-09-30')$$,
    (select tenant_a_id from ticket29_context),
    (select categoria_ativa_id from ticket29_context)
  ),
  '23514',
  null,
  'restricao recusa status open com valor baixado igual ao valor total'
);
select throws_ok(
  format(
    $$insert into public.payables (tenant_id, description, category_id, amount, paid_amount, status, due_date, competence_date)
      values ('%s'::uuid, 'Status incoerente 2', '%s'::uuid, 100, 0, 'paid', '2026-09-30', '2026-09-30')$$,
    (select tenant_a_id from ticket29_context),
    (select categoria_ativa_id from ticket29_context)
  ),
  '23514',
  null,
  'restricao recusa status paid sem valor baixado igual ao valor total'
);
select throws_ok(
  format(
    $$insert into public.payables (tenant_id, description, category_id, amount, paid_amount, status, due_date, competence_date)
      values ('%s'::uuid, 'Status incoerente 3', '%s'::uuid, 100, 100, 'partially_paid', '2026-09-30', '2026-09-30')$$,
    (select tenant_a_id from ticket29_context),
    (select categoria_ativa_id from ticket29_context)
  ),
  '23514',
  null,
  'restricao recusa partially_paid com valor baixado igual ao valor total (deveria ser 0<paid<amount)'
);
select throws_ok(
  format(
    $$insert into public.payables (tenant_id, description, category_id, amount, paid_amount, status, due_date, competence_date, cancelled_at, cancelled_by, cancellation_reason)
      values ('%s'::uuid, 'Status incoerente 4', '%s'::uuid, 100, 0, 'cancelled', '2026-09-30', '2026-09-30', null, null, null)$$,
    (select tenant_a_id from ticket29_context),
    (select categoria_ativa_id from ticket29_context)
  ),
  '23514',
  null,
  'restricao recusa status cancelled sem rastro de cancelamento'
);

-- ---------------------------------------------------------------------------
-- list_payables: situacao derivada e faixa de destaque na fronteira do dia de
-- negocio do tenant A (fuso America/Sao_Paulo, diferente de UTC). O dia de
-- negocio esperado e calculado com a MESMA formula da funcao, para o teste
-- nao depender de congelar o relogio.
-- ---------------------------------------------------------------------------
create temporary table ticket29_situacao (
  due_date date,
  situation text,
  highlight text
) on commit drop;
grant select, insert on ticket29_situacao to authenticated;

do $$
declare
  v_today date;
begin
  select (now() at time zone 'America/Sao_Paulo')::date into v_today;

  insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
  select (select tenant_a_id from ticket29_context), 'Ticket29 Vencida Ontem',
         (select categoria_ativa_id from ticket29_context), 100, v_today - 1, v_today - 1;
  insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
  select (select tenant_a_id from ticket29_context), 'Ticket29 Vence Hoje',
         (select categoria_ativa_id from ticket29_context), 100, v_today, v_today;
  insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
  select (select tenant_a_id from ticket29_context), 'Ticket29 Vence em Sete Dias',
         (select categoria_ativa_id from ticket29_context), 100, v_today + 7, v_today + 7;
  insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
  select (select tenant_a_id from ticket29_context), 'Ticket29 Vence em Oito Dias',
         (select categoria_ativa_id from ticket29_context), 100, v_today + 8, v_today + 8;
end;
$$;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29_context), true);
set local role authenticated;

insert into ticket29_situacao (due_date, situation, highlight)
select due_date, situation, highlight
from public.list_payables(null, null, 'not_cancelled', 1, 100)
where description = 'Ticket29 Vencida Ontem';
select is(
  (select situation from ticket29_situacao where due_date = (select due_date from ticket29_situacao limit 1)),
  'overdue',
  'conta com vencimento ontem (dia de negocio do tenant) tem situacao overdue'
);

insert into ticket29_situacao (due_date, situation, highlight)
select due_date, situation, highlight
from public.list_payables(null, null, 'not_cancelled', 1, 100)
where description = 'Ticket29 Vence Hoje';
select is(
  (select highlight from ticket29_situacao order by due_date desc limit 1),
  'due_today',
  'conta com vencimento hoje (dia de negocio do tenant) tem faixa de destaque due_today'
);

insert into ticket29_situacao (due_date, situation, highlight)
select due_date, situation, highlight
from public.list_payables(null, null, 'not_cancelled', 1, 100)
where description = 'Ticket29 Vence em Sete Dias';
select is(
  (select highlight from ticket29_situacao order by due_date desc limit 1),
  'due_soon',
  'conta com vencimento em sete dias tem faixa de destaque due_soon (borda superior)'
);

insert into ticket29_situacao (due_date, situation, highlight)
select due_date, situation, highlight
from public.list_payables(null, null, 'not_cancelled', 1, 100)
where description = 'Ticket29 Vence em Oito Dias';
select is(
  (select highlight from ticket29_situacao order by due_date desc limit 1),
  null,
  'conta com vencimento em oito dias nao tem faixa de destaque (fora da janela de sete dias)'
);

reset role;

-- ---------------------------------------------------------------------------
-- Paginacao estavel: cinco contas com vencimentos distintos, pagina de dois
-- em dois, ordenadas por vencimento e id, mesmo total_count em toda pagina.
-- ---------------------------------------------------------------------------
create temporary table ticket29_paginacao_context (tenant_id uuid not null) on commit drop;
insert into ticket29_paginacao_context (tenant_id)
values (gen_random_uuid());

create temporary table ticket29_pagina (page integer, id uuid, due_date date, total_count bigint) on commit drop;
grant select, insert on ticket29_pagina to authenticated;

with novo_tenant as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29_tenant_paginacao__', '__ticket29_tenant_paginacao__@teste.com', '11999999993', 'America/Sao_Paulo')
  returning id
)
update ticket29_paginacao_context set tenant_id = novo_tenant.id from novo_tenant;

update public.users
set tenant_id = (select tenant_id from ticket29_paginacao_context)
where id = (select gerente_a_id from ticket29_context);

insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
select (select tenant_id from ticket29_paginacao_context), 'Ticket29 Pag ' || n::text,
       (select id from public.financial_categories where tenant_id = (select tenant_id from ticket29_paginacao_context) limit 1),
       100, ('2027-01-0' || n::text)::date, ('2027-01-0' || n::text)::date
from generate_series(1, 5) as n;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29_context), true);
set local role authenticated;

insert into ticket29_pagina (page, id, due_date, total_count)
select 1, id, due_date, total_count from public.list_payables('2027-01-01', '2027-01-05', 'not_cancelled', 1, 2);
insert into ticket29_pagina (page, id, due_date, total_count)
select 2, id, due_date, total_count from public.list_payables('2027-01-01', '2027-01-05', 'not_cancelled', 2, 2);
insert into ticket29_pagina (page, id, due_date, total_count)
select 3, id, due_date, total_count from public.list_payables('2027-01-01', '2027-01-05', 'not_cancelled', 3, 2);

reset role;

update public.users
set tenant_id = (select tenant_a_id from ticket29_context)
where id = (select gerente_a_id from ticket29_context);

select is(
  (select count(*)::integer from ticket29_pagina where page = 1),
  2,
  'primeira pagina devolve duas contas (tamanho de pagina 2)'
);
select is(
  (select count(*)::integer from ticket29_pagina where page = 3),
  1,
  'terceira pagina devolve a ultima conta restante (5 contas, pagina de 2)'
);
select is(
  (select count(distinct total_count)::integer from ticket29_pagina),
  1,
  'total_count e o mesmo em todas as paginas'
);
select is(
  (select total_count::integer from ticket29_pagina limit 1),
  5,
  'total_count reflete o total de contas do filtro, nao o tamanho da pagina'
);
select is(
  (select array_agg(due_date order by page, due_date) from ticket29_pagina),
  (select array_agg(due_date order by due_date) from ticket29_pagina),
  'as contas vem ordenadas por vencimento crescente ao longo das paginas (paginacao estavel)'
);
select is(
  (select count(distinct id)::integer from ticket29_pagina),
  5,
  'as tres paginas juntas cobrem as cinco contas sem repeticao'
);

-- ---------------------------------------------------------------------------
-- Papel e tenant: profissional nao le nem escreve; gestor de outro tenant nao
-- le nem escreve as Contas a Pagar do tenant A.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket29_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.payables where tenant_id = (select tenant_a_id from ticket29_context)),
  0,
  'profissional nao le nenhuma conta a pagar pela RLS'
);
select throws_ok(
  format(
    $$select public.create_payable('Conta do barbeiro', '%s'::uuid, 100, '2026-09-30')$$,
    (select categoria_ativa_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para gerenciar Contas a Pagar.',
  'profissional e recusado ao tentar criar conta a pagar'
);
select throws_ok(
  $$select public.list_payables()$$,
  '42501',
  'Acesso negado para consultar Contas a Pagar.',
  'profissional e recusado ao tentar listar contas a pagar'
);
select throws_ok(
  format(
    $$insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
      values ('%s'::uuid, 'Insercao direta do barbeiro', '%s'::uuid, 100, '2026-09-30', '2026-09-30')$$,
    (select tenant_a_id from ticket29_context),
    (select categoria_ativa_id from ticket29_context)
  ),
  '42501',
  null,
  'profissional nao insere diretamente em payables'
);

reset role;

select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket29_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.payables where tenant_id = (select tenant_a_id from ticket29_context)),
  0,
  'gestor de outro tenant nao le contas a pagar do tenant A'
);
select throws_ok(
  format(
    $$select public.create_payable('Conta de outro tenant', '%s'::uuid, 100, '2026-09-30', null, null, null, null, '%s'::uuid)$$,
    (select categoria_ativa_id from ticket29_context),
    (select tenant_a_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao cria conta a pagar informando o tenant A explicitamente'
);
select throws_ok(
  format(
    $$select public.list_payables(null, null, 'not_cancelled', 1, 20, '%s'::uuid)$$,
    (select tenant_a_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao lista contas a pagar informando o tenant A explicitamente'
);
select throws_ok(
  format(
    $$insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
      values ('%s'::uuid, 'Insercao direta de outro tenant', '%s'::uuid, 100, '2026-09-30', '2026-09-30')$$,
    (select tenant_a_id from ticket29_context),
    (select categoria_ativa_id from ticket29_context)
  ),
  '42501',
  null,
  'gestor de outro tenant nao insere diretamente em payables do tenant A'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ticket 07/036: Baixa fora do caixa e Estorno de Baixa. Reaproveita
-- ticket29_context (tenant_a_id, gerente_a_id, barbeiro_a_id, tenant_b_id,
-- gerente_b_id, categoria_ativa_id, fornecedor_ativo_id).
-- ---------------------------------------------------------------------------
select has_table('public', 'payable_settlements', 'tabela payable_settlements existe');

select has_function(
  'public', 'settle_payable',
  array['uuid', 'numeric', 'date', 'text', 'numeric', 'numeric', 'text', 'uuid', 'uuid'],
  'public.settle_payable(...) existe'
);
select has_function(
  'public', 'reverse_payable_settlement', array['uuid', 'text', 'uuid'],
  'public.reverse_payable_settlement(uuid, text, uuid) existe'
);
select has_function('public', 'get_payable', array['uuid', 'uuid'], 'public.get_payable(uuid, uuid) existe');
select has_function(
  'public', 'list_payable_settlements', array['uuid', 'uuid'],
  'public.list_payable_settlements(uuid, uuid) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.settle_payable(uuid,numeric,date,text,numeric,numeric,text,uuid,uuid)'::regprocedure),
  'settle_payable fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.reverse_payable_settlement(uuid,text,uuid)'::regprocedure),
  'reverse_payable_settlement fixa search_path vazio'
);

select ok(
  not has_table_privilege('anon', 'public.payable_settlements', 'SELECT'),
  'anon nao tem privilegio de SELECT em payable_settlements'
);
select ok(
  not has_table_privilege('authenticated', 'public.payable_settlements', 'INSERT'),
  'authenticated nao tem privilegio de INSERT direto em payable_settlements'
);
select ok(
  not has_table_privilege('authenticated', 'public.payable_settlements', 'UPDATE'),
  'authenticated nao tem privilegio de UPDATE direto em payable_settlements'
);
select ok(
  has_function_privilege('service_role', 'public.settle_payable(uuid,numeric,date,text,numeric,numeric,text,uuid,uuid)', 'EXECUTE'),
  'service_role executa settle_payable'
);

-- Restricao de consistencia da tabela: source/cash_session_id/cash_movement_id.
select throws_ok(
  format(
    $$insert into public.payable_settlements (tenant_id, payable_id, principal, payment_date, payment_method, source)
      values ('%s'::uuid, gen_random_uuid(), 100, '2026-09-14', 'pix', 'gaveta')$$,
    (select tenant_a_id from ticket29_context)
  ),
  '23514',
  null,
  'restricao recusa origem gaveta sem sessao de caixa nem movimento de caixa vinculados'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29_context), true);
set local role authenticated;

-- Conta dedicada a Baixa parcial e total.
create temporary table ticket29g_conta_parcial (id uuid) on commit drop;
insert into ticket29g_conta_parcial (id)
select id from public.create_payable(
  'Ticket29g Baixa Parcial', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);

create temporary table ticket29g_baixa_parcial (id uuid, paid_amount numeric) on commit drop;
grant select, insert on ticket29g_baixa_parcial to authenticated;
insert into ticket29g_baixa_parcial (id, paid_amount)
select id, paid_amount from public.settle_payable(
  (select id from ticket29g_conta_parcial), 40, '2026-09-14', 'pix'
);

select is(
  (select status from public.payables where id = (select id from ticket29g_conta_parcial)),
  'partially_paid',
  'Baixa parcial deixa a conta como parcialmente paga'
);
select is(
  (select paid_amount from public.payables where id = (select id from ticket29g_conta_parcial)),
  40::numeric,
  'Baixa parcial soma o principal ao valor baixado da conta'
);
select is(
  (select paid_amount from ticket29g_baixa_parcial),
  40::numeric,
  'Baixa sem juros nem desconto tem valor pago igual ao principal'
);

select public.settle_payable((select id from ticket29g_conta_parcial), 60, '2026-09-14', 'pix');

select is(
  (select status from public.payables where id = (select id from ticket29g_conta_parcial)),
  'paid',
  'segunda Baixa completando o saldo deixa a conta como paga'
);
select is(
  (select paid_amount from public.payables where id = (select id from ticket29g_conta_parcial)),
  100::numeric,
  'as duas Baixas juntas somam o valor total da conta'
);

-- Juros e desconto: principal 100, juros 10, desconto 5 -> pago 105.
create temporary table ticket29g_conta_juros (id uuid) on commit drop;
insert into ticket29g_conta_juros (id)
select id from public.create_payable(
  'Ticket29g Juros e Desconto', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);

create temporary table ticket29g_baixa_juros (paid_amount numeric) on commit drop;
grant select, insert on ticket29g_baixa_juros to authenticated;
insert into ticket29g_baixa_juros (paid_amount)
select paid_amount from public.settle_payable(
  (select id from ticket29g_conta_juros), 100, '2026-09-14', 'boleto', 10, 5
);

select is(
  (select paid_amount from ticket29g_baixa_juros),
  105::numeric,
  'valor pago e gerado como principal + juros - desconto'
);
select is(
  (select status from public.payables where id = (select id from ticket29g_conta_juros)),
  'paid',
  'juros nao afetam o saldo da conta: principal igual ao valor ja deixa a conta paga'
);

-- Valor pago zero aceito fora do caixa (desconto cobre o principal).
create temporary table ticket29g_conta_zero (id uuid) on commit drop;
insert into ticket29g_conta_zero (id)
select id from public.create_payable(
  'Ticket29g Valor Pago Zero', (select categoria_ativa_id from ticket29_context), 50, '2026-09-30'
);

select lives_ok(
  format(
    $$select public.settle_payable('%s'::uuid, 50, '2026-09-14', 'pix', 0, 50)$$,
    (select id from ticket29g_conta_zero)
  ),
  'valor pago zero e aceito fora do caixa (desconto cobre o principal)'
);
select is(
  (select status from public.payables where id = (select id from ticket29g_conta_zero)),
  'paid',
  'a conta com valor pago zero fica paga (o principal abateu o saldo mesmo sem dinheiro sair)'
);

-- Data futura recusada.
create temporary table ticket29g_conta_futuro (id uuid) on commit drop;
insert into ticket29g_conta_futuro (id)
select id from public.create_payable(
  'Ticket29g Data Futura', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
select throws_ok(
  format(
    $$select public.settle_payable('%s'::uuid, 50, (current_date + 5), 'pix')$$,
    (select id from ticket29g_conta_futuro)
  ),
  '22023',
  'A data do pagamento não pode estar no futuro.',
  'Baixa com data de pagamento no futuro e recusada'
);

-- Origem gaveta recusada explicitamente ate o ticket 15/036.
select throws_ok(
  format(
    $$select public.settle_payable('%s'::uuid, 50, '2026-09-14', 'cash', 0, 0, 'gaveta')$$,
    (select id from ticket29g_conta_futuro)
  ),
  '22023',
  'Baixa pela gaveta ainda não está disponível.',
  'Baixa com origem gaveta e recusada ate o ticket 15/036'
);

-- Principal excedendo o saldo restante e recusado.
select throws_ok(
  format(
    $$select public.settle_payable('%s'::uuid, 1000, '2026-09-14', 'pix')$$,
    (select id from ticket29g_conta_futuro)
  ),
  '22023',
  'O principal não pode exceder o saldo restante da conta.',
  'Baixa com principal maior que o saldo restante e recusada'
);

-- Duas Baixas na mesma conta: a segunda enxerga o saldo ja atualizado pela
-- primeira e e recusada ao tentar ultrapassar o valor total (serializacao
-- pela trava da Conta a Pagar; verdadeira concorrencia exigiria duas conexoes,
-- fora do alcance de um teste pgTAP de conexao unica).
create temporary table ticket29g_conta_concorrente (id uuid) on commit drop;
insert into ticket29g_conta_concorrente (id)
select id from public.create_payable(
  'Ticket29g Duas Baixas', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
select public.settle_payable((select id from ticket29g_conta_concorrente), 60, '2026-09-14', 'pix');
select throws_ok(
  format(
    $$select public.settle_payable('%s'::uuid, 50, '2026-09-14', 'pix')$$,
    (select id from ticket29g_conta_concorrente)
  ),
  '22023',
  'O principal não pode exceder o saldo restante da conta.',
  'segunda Baixa enxerga o saldo ja reduzido pela primeira e nao ultrapassa o valor da conta'
);

-- Estorno: devolve o principal ao saldo e recalcula o estado.
create temporary table ticket29g_conta_estorno (id uuid) on commit drop;
insert into ticket29g_conta_estorno (id)
select id from public.create_payable(
  'Ticket29g Estorno', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
create temporary table ticket29g_baixa_estorno (id uuid) on commit drop;
grant select, insert on ticket29g_baixa_estorno to authenticated;
insert into ticket29g_baixa_estorno (id)
select id from public.settle_payable((select id from ticket29g_conta_estorno), 40, '2026-09-14', 'pix');

select throws_ok(
  $$select public.reverse_payable_settlement(gen_random_uuid(), 'oi')$$,
  '22023',
  'Informe um motivo com pelo menos cinco caracteres.',
  'estorno recusa motivo com menos de cinco caracteres'
);

select ok(
  (select reversed_at from public.reverse_payable_settlement(
    (select id from ticket29g_baixa_estorno), 'Baixa lancada por engano'
  )) is not null,
  'estornar preenche reversed_at na Baixa'
);
select is(
  (select status from public.payables where id = (select id from ticket29g_conta_estorno)),
  'open',
  'estornar a unica Baixa devolve a conta para aberto'
);
select is(
  (select paid_amount from public.payables where id = (select id from ticket29g_conta_estorno)),
  0::numeric,
  'estornar a Baixa devolve o principal ao saldo (valor baixado volta a zero)'
);
select throws_ok(
  format(
    $$select public.reverse_payable_settlement('%s'::uuid, 'tentando de novo')$$,
    (select id from ticket29g_baixa_estorno)
  ),
  'P0001',
  'Esta Baixa já foi estornada.',
  'estornar uma Baixa ja estornada e recusado'
);

-- Estorno parcial: conta com duas Baixas, estorna so a primeira e o estado
-- recalcula para parcialmente paga (nao para aberto).
create temporary table ticket29g_conta_estorno_parcial (id uuid) on commit drop;
insert into ticket29g_conta_estorno_parcial (id)
select id from public.create_payable(
  'Ticket29g Estorno Parcial', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
create temporary table ticket29g_baixas_estorno_parcial (ordem integer, id uuid) on commit drop;
grant select, insert on ticket29g_baixas_estorno_parcial to authenticated;
insert into ticket29g_baixas_estorno_parcial (ordem, id)
select 1, id from public.settle_payable((select id from ticket29g_conta_estorno_parcial), 30, '2026-09-14', 'pix');
insert into ticket29g_baixas_estorno_parcial (ordem, id)
select 2, id from public.settle_payable((select id from ticket29g_conta_estorno_parcial), 30, '2026-09-14', 'pix');

select public.reverse_payable_settlement(
  (select id from ticket29g_baixas_estorno_parcial where ordem = 1), 'estorno da primeira Baixa'
);
select is(
  (select status from public.payables where id = (select id from ticket29g_conta_estorno_parcial)),
  'partially_paid',
  'estornar uma de duas Baixas ativas recalcula para parcialmente paga, nao para aberto'
);
select is(
  (select paid_amount from public.payables where id = (select id from ticket29g_conta_estorno_parcial)),
  30::numeric,
  'estornar uma Baixa deixa so o principal da Baixa restante no valor baixado'
);

-- get_payable e list_payable_settlements: leitura de detalhe com autor.
select is(
  (select created_by_name from public.get_payable((select id from ticket29g_conta_estorno_parcial))),
  (select name from public.users where id = (select gerente_a_id from ticket29_context)),
  'get_payable devolve o nome de quem criou a conta'
);
select is(
  (select count(*)::integer from public.list_payable_settlements((select id from ticket29g_conta_estorno_parcial))),
  2,
  'list_payable_settlements lista todas as Baixas da conta, estornadas e ativas'
);
select is(
  (select created_by_name from public.list_payable_settlements((select id from ticket29g_conta_estorno_parcial)) limit 1),
  (select name from public.users where id = (select gerente_a_id from ticket29_context)),
  'list_payable_settlements devolve o nome de quem lancou a Baixa'
);

reset role;

-- Profissional nao le Baixas nem executa Baixa ou estorno.
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket29_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.payable_settlements where tenant_id = (select tenant_a_id from ticket29_context)),
  0,
  'profissional nao le nenhuma Baixa pela RLS'
);
select throws_ok(
  format(
    $$select public.settle_payable('%s'::uuid, 10, '2026-09-14', 'pix')$$,
    (select id from ticket29g_conta_estorno_parcial)
  ),
  '42501',
  'Acesso negado para dar Baixa em Contas a Pagar.',
  'profissional e recusado ao tentar dar Baixa'
);
select throws_ok(
  format(
    $$select public.reverse_payable_settlement('%s'::uuid, 'motivo valido')$$,
    (select id from ticket29g_baixas_estorno_parcial where ordem = 2)
  ),
  '42501',
  'Acesso negado para estornar Baixa.',
  'profissional e recusado ao tentar estornar Baixa'
);

reset role;

-- Gestor de outro tenant nao le nem escreve Baixas do tenant A.
select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket29_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.payable_settlements where tenant_id = (select tenant_a_id from ticket29_context)),
  0,
  'gestor de outro tenant nao le Baixas do tenant A'
);
select throws_ok(
  format(
    $$select public.settle_payable('%s'::uuid, 10, '2026-09-14', 'pix', 0, 0, 'fora_do_caixa', null, '%s'::uuid)$$,
    (select id from ticket29g_conta_estorno_parcial),
    (select tenant_a_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao da Baixa informando o tenant A explicitamente'
);
select throws_ok(
  format(
    $$select public.reverse_payable_settlement('%s'::uuid, 'motivo valido', '%s'::uuid)$$,
    (select id from ticket29g_baixas_estorno_parcial where ordem = 2),
    (select tenant_a_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao estorna Baixa informando o tenant A explicitamente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ticket 08/036: editar e cancelar Conta a Pagar. Reaproveita ticket29_context.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'update_payable',
  array['uuid', 'text', 'uuid', 'numeric', 'date', 'uuid', 'date', 'text', 'text', 'uuid'],
  'public.update_payable(...) existe'
);
select has_function(
  'public', 'cancel_payable', array['uuid', 'text', 'uuid'],
  'public.cancel_payable(uuid, text, uuid) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.update_payable(uuid,text,uuid,numeric,date,uuid,date,text,text,uuid)'::regprocedure),
  'update_payable fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.cancel_payable(uuid,text,uuid)'::regprocedure),
  'cancel_payable fixa search_path vazio'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29_context), true);
set local role authenticated;

-- Edicao aberta: tudo editavel.
create temporary table ticket29h_categoria_2 (id uuid) on commit drop;
insert into ticket29h_categoria_2 (id) values ((
  select id from public.create_expense_category('Ticket29h Categoria Dois', (select tenant_a_id from ticket29_context))
));

create temporary table ticket29h_conta_aberta (id uuid) on commit drop;
insert into ticket29h_conta_aberta (id)
select id from public.create_payable(
  'Ticket29h Aberta', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);

select ok(
  (select amount from public.update_payable(
    (select id from ticket29h_conta_aberta), 'Ticket29h Aberta Editada',
    (select id from ticket29h_categoria_2), 200, '2026-10-15'
  )) = 200,
  'conta aberta aceita mudar o valor'
);
select is(
  (select description from public.payables where id = (select id from ticket29h_conta_aberta)),
  'Ticket29h Aberta Editada',
  'edicao normaliza e grava a nova descricao'
);
select is(
  (select category_id from public.payables where id = (select id from ticket29h_conta_aberta)),
  (select id from ticket29h_categoria_2),
  'conta aberta aceita mudar a categoria (nova categoria ativa)'
);
select ok(
  (select updated_by from public.payables where id = (select id from ticket29h_conta_aberta))
    = (select gerente_a_id from ticket29_context),
  'edicao grava o autor da ultima alteracao'
);

-- Categoria arquivada aceita quando ja estava na conta (nao mudou), recusada
-- quando e uma NOVA categoria arquivada.
create temporary table ticket29h_categoria_arquivavel (id uuid) on commit drop;
insert into ticket29h_categoria_arquivavel (id) values ((
  select id from public.create_expense_category('Ticket29h Arquivavel', (select tenant_a_id from ticket29_context))
));
create temporary table ticket29h_conta_categoria_arquivavel (id uuid) on commit drop;
insert into ticket29h_conta_categoria_arquivavel (id)
select id from public.create_payable(
  'Ticket29h Categoria Vai Arquivar', (select id from ticket29h_categoria_arquivavel), 100, '2026-09-30'
);
select public.archive_expense_category(
  (select id from ticket29h_categoria_arquivavel), (select tenant_a_id from ticket29_context)
);
select lives_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Ticket29h Descricao Nova', '%s'::uuid, 100, '2026-09-30')$$,
    (select id from ticket29h_conta_categoria_arquivavel),
    (select id from ticket29h_categoria_arquivavel)
  ),
  'manter a categoria arquivada que ja estava na conta e permitido'
);
select throws_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Ticket29h Nova Categoria Arquivada', '%s'::uuid, 100, '2026-09-30')$$,
    (select id from ticket29h_conta_categoria_arquivavel),
    (select categoria_arquivada_id from ticket29_context)
  ),
  '22023',
  'Categoria de despesa informada não existe ou está arquivada.',
  'trocar para uma NOVA categoria arquivada e recusado'
);

-- Edicao parcialmente paga: valor travado, resto editavel.
create temporary table ticket29h_conta_parcial (id uuid) on commit drop;
insert into ticket29h_conta_parcial (id)
select id from public.create_payable(
  'Ticket29h Parcial', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
select public.settle_payable((select id from ticket29h_conta_parcial), 40, '2026-09-14', 'pix');
select throws_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Ticket29h Parcial', '%s'::uuid, 999, '2026-09-30')$$,
    (select id from ticket29h_conta_parcial),
    (select categoria_ativa_id from ticket29_context)
  ),
  'P0001',
  'O valor não pode ser alterado numa conta parcialmente paga ou paga.',
  'conta parcialmente paga recusa mudar o valor'
);
select lives_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Ticket29h Parcial Vencimento Novo', '%s'::uuid, 100, '2026-11-01')$$,
    (select id from ticket29h_conta_parcial),
    (select categoria_ativa_id from ticket29_context)
  ),
  'conta parcialmente paga aceita mudar o vencimento'
);

-- Edicao paga: valor e vencimento travados, resto editavel.
create temporary table ticket29h_conta_paga (id uuid) on commit drop;
insert into ticket29h_conta_paga (id)
select id from public.create_payable(
  'Ticket29h Paga', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
select public.settle_payable((select id from ticket29h_conta_paga), 100, '2026-09-14', 'pix');
select throws_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Ticket29h Paga', '%s'::uuid, 100, '2026-12-01')$$,
    (select id from ticket29h_conta_paga),
    (select categoria_ativa_id from ticket29_context)
  ),
  'P0001',
  'O vencimento não pode ser alterado numa conta paga.',
  'conta paga recusa mudar o vencimento'
);
select lives_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Ticket29h Paga Descricao Nova', '%s'::uuid, 100, '2026-09-30', null, '2026-08-15')$$,
    (select id from ticket29h_conta_paga),
    (select categoria_ativa_id from ticket29_context)
  ),
  'conta paga aceita mudar descricao e competencia'
);

-- Edicao cancelada: nada editavel.
create temporary table ticket29h_conta_cancelada (id uuid) on commit drop;
insert into ticket29h_conta_cancelada (id)
select id from public.create_payable(
  'Ticket29h Cancelada', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
select public.cancel_payable((select id from ticket29h_conta_cancelada), 'motivo do cancelamento');
select throws_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Nova Descricao', '%s'::uuid, 100, '2026-09-30')$$,
    (select id from ticket29h_conta_cancelada),
    (select categoria_ativa_id from ticket29_context)
  ),
  'P0001',
  'Conta cancelada não pode ser editada.',
  'conta cancelada recusa qualquer edicao'
);

-- Cancelamento: motivo curto, com Baixa ativa, sucesso, e dupla operacao.
create temporary table ticket29h_conta_cancelar (id uuid) on commit drop;
insert into ticket29h_conta_cancelar (id)
select id from public.create_payable(
  'Ticket29h A Cancelar', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
select throws_ok(
  format(
    $$select public.cancel_payable('%s'::uuid, 'oi')$$,
    (select id from ticket29h_conta_cancelar)
  ),
  '22023',
  'Informe um motivo com pelo menos cinco caracteres.',
  'cancelamento recusa motivo com menos de cinco caracteres'
);

create temporary table ticket29h_conta_cancelar_com_baixa (id uuid) on commit drop;
insert into ticket29h_conta_cancelar_com_baixa (id)
select id from public.create_payable(
  'Ticket29h Com Baixa', (select categoria_ativa_id from ticket29_context), 100, '2026-09-30'
);
select public.settle_payable((select id from ticket29h_conta_cancelar_com_baixa), 40, '2026-09-14', 'pix');
select throws_ok(
  format(
    $$select public.cancel_payable('%s'::uuid, 'motivo valido')$$,
    (select id from ticket29h_conta_cancelar_com_baixa)
  ),
  'P0001',
  'Não é possível cancelar uma conta com Baixa ativa.',
  'cancelamento com Baixa ativa e recusado'
);

select ok(
  (select cancelled_at from public.cancel_payable(
    (select id from ticket29h_conta_cancelar), 'lancada em duplicidade'
  )) is not null,
  'cancelamento preenche cancelled_at'
);
select is(
  (select status from public.payables where id = (select id from ticket29h_conta_cancelar)),
  'cancelled',
  'cancelamento muda o estado para cancelled'
);
select throws_ok(
  format(
    $$select public.cancel_payable('%s'::uuid, 'tentando de novo')$$,
    (select id from ticket29h_conta_cancelar)
  ),
  'P0001',
  'Esta conta já está cancelada.',
  'cancelar conta ja cancelada e recusado'
);

-- Conta cancelada some do filtro padrao ("todas exceto canceladas") mas
-- continua acessivel pelo detalhe, com nome de categoria preservado mesmo
-- que a categoria (arquivavel) tenha sido arquivada depois.
select ok(
  not exists (
    select 1 from public.list_payables(null, null, 'not_cancelled', 1, 100)
    where id = (select id from ticket29h_conta_cancelar)
  ),
  'conta cancelada nao aparece no filtro padrao (todas exceto canceladas)'
);
select ok(
  exists (
    select 1 from public.list_payables(null, null, 'cancelled', 1, 100)
    where id = (select id from ticket29h_conta_cancelar)
  ),
  'conta cancelada aparece ao filtrar explicitamente por canceladas'
);
select is(
  (select category_name from public.get_payable((select id from ticket29h_conta_categoria_arquivavel))),
  'Ticket29h Arquivavel',
  'get_payable exibe o nome da categoria mesmo depois de arquivada'
);

reset role;

-- Profissional e gestor de outro tenant nao editam nem cancelam.
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket29_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Tentativa', '%s'::uuid, 100, '2026-09-30')$$,
    (select id from ticket29h_conta_aberta),
    (select categoria_ativa_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para editar Contas a Pagar.',
  'profissional e recusado ao tentar editar conta a pagar'
);
select throws_ok(
  format(
    $$select public.cancel_payable('%s'::uuid, 'motivo valido')$$,
    (select id from ticket29h_conta_aberta)
  ),
  '42501',
  'Acesso negado para cancelar Contas a Pagar.',
  'profissional e recusado ao tentar cancelar conta a pagar'
);

reset role;

select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket29_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select public.update_payable('%s'::uuid, 'Tentativa', '%s'::uuid, 100, '2026-09-30', null, null, null, null, '%s'::uuid)$$,
    (select id from ticket29h_conta_aberta),
    (select categoria_ativa_id from ticket29_context),
    (select tenant_a_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao edita conta informando o tenant A explicitamente'
);
select throws_ok(
  format(
    $$select public.cancel_payable('%s'::uuid, 'motivo valido', '%s'::uuid)$$,
    (select id from ticket29h_conta_aberta),
    (select tenant_a_id from ticket29_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao cancela conta informando o tenant A explicitamente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ticket 09/036: filtros completos, totais do filtro e alerta de vencidas.
-- Contexto proprio (tenant_a_id, tenant_b_id, gerente_a_id, barbeiro_a_id,
-- gerente_b_id, categoria_1_id, categoria_2_id), para nao depender do estado
-- mutado de ticket29_context pelas secoes anteriores.
-- ---------------------------------------------------------------------------
create temporary table ticket29i_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  gerente_b_id uuid not null,
  categoria_1_id uuid not null,
  categoria_2_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29i_tenant_a__', '__ticket29i_tenant_a__@teste.com', '11999998901', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29i_tenant_b__', '__ticket29i_tenant_b__@teste.com', '11999998902', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29i_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29i_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29i_gerente_b__@teste.com') returning id
), cat1 as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket29i Categoria Um' from ta returning id
), cat2 as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket29i Categoria Dois' from ta returning id
)
insert into ticket29i_context (tenant_a_id, tenant_b_id, gerente_a_id, barbeiro_a_id, gerente_b_id, categoria_1_id, categoria_2_id)
select ta.id, tb.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, cat1.id, cat2.id
from ta, tb, au_gerente_a, au_barbeiro_a, au_gerente_b, cat1, cat2;

update public.users set tenant_id = (select tenant_a_id from ticket29i_context), role = 'gerente', is_active = true where id = (select gerente_a_id from ticket29i_context);
update public.users set tenant_id = (select tenant_a_id from ticket29i_context), role = 'barbeiro', is_active = true where id = (select barbeiro_a_id from ticket29i_context);
update public.users set tenant_id = (select tenant_b_id from ticket29i_context), role = 'gerente', is_active = true where id = (select gerente_b_id from ticket29i_context);
grant select on ticket29i_context to authenticated;

select has_function(
  'public', 'get_payables_totals', array['date', 'date', 'uuid', 'uuid', 'uuid'],
  'public.get_payables_totals(...) existe'
);
select has_function(
  'public', 'get_payables_alert', array['uuid'],
  'public.get_payables_alert(uuid) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_payables_totals(date,date,uuid,uuid,uuid)'::regprocedure),
  'get_payables_totals fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.get_payables_alert(uuid)'::regprocedure),
  'get_payables_alert fixa search_path vazio'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29i_context), true);
set local role authenticated;

create temporary table ticket29i_contas (nome text, id uuid) on commit drop;
grant select, insert on ticket29i_contas to authenticated;

insert into ticket29i_contas (nome, id)
select 'aberta_cat1', id from public.create_payable('Ticket29i Aberta Cat1', (select categoria_1_id from ticket29i_context), 100, '2026-12-15');
insert into ticket29i_contas (nome, id)
select 'aberta_cat2', id from public.create_payable('Ticket29i Aberta Cat2', (select categoria_2_id from ticket29i_context), 200, '2026-12-20');
insert into ticket29i_contas (nome, id)
select 'cancelada', id from public.create_payable('Ticket29i Cancelada', (select categoria_1_id from ticket29i_context), 150, '2026-12-18');
select public.cancel_payable((select id from ticket29i_contas where nome = 'cancelada'), 'motivo do cancelamento');

-- Filtro de categoria em list_payables (ticket 09/036).
select is(
  (select count(*)::integer from public.list_payables(
    '2026-12-01', '2026-12-31', 'not_cancelled', 1, 100, null, (select categoria_1_id from ticket29i_context)
  )),
  1,
  'list_payables filtra por categoria'
);

-- Totais em aberto: soma as nao canceladas do periodo, ignorando a cancelada.
select is(
  (select open_balance from public.get_payables_totals('2026-12-01', '2026-12-31')),
  300::numeric,
  'totais em aberto somam as contas nao canceladas do periodo (100+200), ignorando a cancelada'
);

-- Pago no periodo: pela data de pagamento da Baixa, nao pelo vencimento da conta.
select public.settle_payable((select id from ticket29i_contas where nome = 'aberta_cat1'), 40, '2026-09-14', 'pix');
select is(
  (select paid_in_period from public.get_payables_totals('2026-12-01', '2026-12-31')),
  0::numeric,
  'Baixa com data de pagamento fora do periodo nao conta no pago no periodo'
);
select is(
  (select paid_in_period from public.get_payables_totals('2026-09-01', '2026-09-30')),
  40::numeric,
  'pago no periodo soma o valor pago das Baixas ativas pela data de pagamento (nao pelo vencimento da conta)'
);

-- Totais ignoram o filtro de estado (nao existe parametro de estado nesta
-- RPC): o saldo restante da conta parcialmente paga continua somado ao aberto.
select is(
  (select open_balance from public.get_payables_totals('2026-12-01', '2026-12-31')),
  260::numeric,
  'totais em aberto refletem o saldo restante apos a Baixa parcial (100-40=60, mais 200)'
);

select is(
  (select open_balance from public.get_payables_totals(
    '2026-12-01', '2026-12-31', (select categoria_2_id from ticket29i_context)
  )),
  200::numeric,
  'totais obedecem ao filtro de categoria'
);

reset role;

-- Alerta: sem filtro de periodo (a RPC nem tem esse parametro). Uma conta
-- vencida ontem e uma vencendo hoje, no dia de negocio do tenant.
do $$
declare
  v_today date;
begin
  select (now() at time zone 'America/Sao_Paulo')::date into v_today;
  insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
  select (select tenant_a_id from ticket29i_context), 'Ticket29i Vencida Alerta',
         (select categoria_1_id from ticket29i_context), 100, v_today - 1, v_today - 1;
  insert into public.payables (tenant_id, description, category_id, amount, due_date, competence_date)
  select (select tenant_a_id from ticket29i_context), 'Ticket29i Vence Hoje Alerta',
         (select categoria_1_id from ticket29i_context), 50, v_today, v_today;
end;
$$;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29i_context), true);
set local role authenticated;

select is(
  (select overdue_count from public.get_payables_alert()),
  1,
  'alerta conta uma conta vencida'
);
select is(
  (select overdue_balance from public.get_payables_alert()),
  100::numeric,
  'alerta soma o saldo das vencidas'
);
select is(
  (select due_today_count from public.get_payables_alert()),
  1,
  'alerta conta uma conta vencendo hoje'
);
select is(
  (select due_today_balance from public.get_payables_alert()),
  50::numeric,
  'alerta soma o saldo das que vencem hoje'
);

reset role;

-- Profissional e gestor de outro tenant nao leem totais nem alerta.
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket29i_context), true);
set local role authenticated;

select throws_ok(
  $$select public.get_payables_totals()$$,
  '42501',
  'Acesso negado para consultar Contas a Pagar.',
  'profissional e recusado ao consultar totais'
);
select throws_ok(
  $$select public.get_payables_alert()$$,
  '42501',
  'Acesso negado para consultar Contas a Pagar.',
  'profissional e recusado ao consultar alerta'
);

reset role;

select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket29i_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select public.get_payables_totals(null, null, null, null, '%s'::uuid)$$,
    (select tenant_a_id from ticket29i_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao consulta totais informando o tenant A explicitamente'
);
select throws_ok(
  format(
    $$select public.get_payables_alert('%s'::uuid)$$,
    (select tenant_a_id from ticket29i_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao consulta alerta informando o tenant A explicitamente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ticket 11/036: Serie (Recorrencia), calendario ancorado e previa. Contexto
-- proprio (ticket29j_context), para nao depender do estado mutado pelas
-- secoes anteriores.
-- ---------------------------------------------------------------------------
create temporary table ticket29j_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  gerente_b_id uuid not null,
  categoria_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29j_tenant_a__', '__ticket29j_tenant_a__@teste.com', '11999998701', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29j_tenant_b__', '__ticket29j_tenant_b__@teste.com', '11999998702', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29j_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29j_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29j_gerente_b__@teste.com') returning id
), cat as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket29j Categoria' from ta returning id
)
insert into ticket29j_context (tenant_a_id, tenant_b_id, gerente_a_id, barbeiro_a_id, gerente_b_id, categoria_id)
select ta.id, tb.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, cat.id
from ta, tb, au_gerente_a, au_barbeiro_a, au_gerente_b, cat;

update public.users set tenant_id = (select tenant_a_id from ticket29j_context), role = 'gerente', is_active = true where id = (select gerente_a_id from ticket29j_context);
update public.users set tenant_id = (select tenant_a_id from ticket29j_context), role = 'barbeiro', is_active = true where id = (select barbeiro_a_id from ticket29j_context);
update public.users set tenant_id = (select tenant_b_id from ticket29j_context), role = 'gerente', is_active = true where id = (select gerente_b_id from ticket29j_context);
grant select on ticket29j_context to authenticated;

select has_table('public', 'payable_series', 'tabela payable_series existe');
select has_function(
  'public', 'preview_payable_series', array['text', 'text', 'date', 'integer', 'numeric', 'uuid'],
  'public.preview_payable_series(...) existe'
);
select has_function(
  'public', 'create_recurring_payable_series',
  array['text', 'uuid', 'text', 'date', 'integer', 'numeric', 'uuid', 'text', 'text', 'uuid'],
  'public.create_recurring_payable_series(...) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.preview_payable_series(text,text,date,integer,numeric,uuid)'::regprocedure),
  'preview_payable_series fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.create_recurring_payable_series(text,uuid,text,date,integer,numeric,uuid,text,text,uuid)'::regprocedure),
  'create_recurring_payable_series fixa search_path vazio'
);
select ok(
  not has_table_privilege('anon', 'public.payable_series', 'SELECT'),
  'anon nao tem privilegio de SELECT em payable_series'
);
select ok(
  not has_table_privilege('authenticated', 'public.payable_series', 'INSERT'),
  'authenticated nao tem privilegio de INSERT direto em payable_series'
);
select ok(
  has_function_privilege('service_role', 'public.create_recurring_payable_series(text,uuid,text,date,integer,numeric,uuid,text,text,uuid)', 'EXECUTE'),
  'service_role executa create_recurring_payable_series'
);

-- Calendario: ancora 31/jan (ano nao bissexto) passa por fevereiro e volta a 31.
select is(
  private.compute_series_due_date('2026-01-31', 'monthly', 1), '2026-01-31'::date,
  'posicao 1 vence na propria ancora'
);
select is(
  private.compute_series_due_date('2026-01-31', 'monthly', 2), '2026-02-28'::date,
  'ancora 31/jan vence em 28/fev (fevereiro mais curto, ano nao bissexto)'
);
select is(
  private.compute_series_due_date('2026-01-31', 'monthly', 3), '2026-03-31'::date,
  'ancora 31/jan volta a vencer em 31/mar (nunca parte da ocorrencia anterior)'
);

-- Ancora 29/fev (ano bissexto) vence em 28/fev no ano seguinte (nao bissexto).
select is(
  private.compute_series_due_date('2028-02-29', 'yearly', 1), '2028-02-29'::date,
  'ancora bissexta na posicao 1'
);
select is(
  private.compute_series_due_date('2028-02-29', 'yearly', 2), '2029-02-28'::date,
  'ancora 29/fev vence em 28/fev no ano seguinte nao bissexto'
);

-- Quinzenal mantem o dia da semana.
select is(
  (select extract(dow from private.compute_series_due_date('2026-09-14', 'biweekly', 3))),
  (select extract(dow from '2026-09-14'::date)),
  'quinzenal mantem o dia da semana (catorze dias, nao quinze)'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29j_context), true);
set local role authenticated;

-- Previa igual as ocorrencias efetivamente criadas.
create temporary table ticket29j_previa (position integer, due_date date, amount numeric) on commit drop;
grant select, insert on ticket29j_previa to authenticated;
insert into ticket29j_previa (position, due_date, amount)
select series_position, due_date, amount from public.preview_payable_series(
  'recurring', 'monthly', '2026-01-31', 3, 500
);

create temporary table ticket29j_criadas (id uuid, series_position integer, due_date date, amount numeric) on commit drop;
grant select, insert on ticket29j_criadas to authenticated;
insert into ticket29j_criadas (id, series_position, due_date, amount)
select id, series_position, due_date, amount from public.create_recurring_payable_series(
  'Ticket29j Recorrencia', (select categoria_id from ticket29j_context), 'monthly', '2026-01-31', 3, 500
);

select is(
  (select count(*)::integer from ticket29j_criadas), 3,
  'create_recurring_payable_series gera a quantidade pedida de ocorrencias'
);
select is(
  (select array_agg(due_date order by position) from ticket29j_previa),
  (select array_agg(due_date order by series_position) from ticket29j_criadas),
  'a previa devolve as mesmas datas das ocorrencias efetivamente criadas'
);
select is(
  (select array_agg(amount order by position) from ticket29j_previa),
  (select array_agg(amount order by series_position) from ticket29j_criadas),
  'a previa devolve os mesmos valores das ocorrencias efetivamente criadas'
);
select is(
  (select competence_date from public.payables where id = (select id from ticket29j_criadas where series_position = 2)),
  (select due_date from public.payables where id = (select id from ticket29j_criadas where series_position = 2)),
  'cada ocorrencia da Recorrencia recebe o proprio vencimento como competencia'
);
select is(
  (select amount from public.payables where id = (select id from ticket29j_criadas where series_position = 1)),
  500::numeric,
  'todas as ocorrencias da Recorrencia tem o mesmo valor'
);

-- Quantidade fora de 1 a 60 recusada, tanto na previa quanto na criacao.
select throws_ok(
  format(
    $$select public.preview_payable_series('recurring', 'monthly', '2026-01-31', 0, 500, '%s'::uuid)$$,
    (select tenant_a_id from ticket29j_context)
  ),
  '22023',
  'A quantidade deve estar entre 1 e 60.',
  'previa recusa quantidade zero'
);
select throws_ok(
  format(
    $$select public.preview_payable_series('recurring', 'monthly', '2026-01-31', 61, 500, '%s'::uuid)$$,
    (select tenant_a_id from ticket29j_context)
  ),
  '22023',
  'A quantidade deve estar entre 1 e 60.',
  'previa recusa quantidade acima de 60'
);
select throws_ok(
  format(
    $$select public.create_recurring_payable_series('Ticket29j Invalida', '%s'::uuid, 'monthly', '2026-01-31', 61, 500)$$,
    (select categoria_id from ticket29j_context)
  ),
  '22023',
  'A quantidade deve estar entre 1 e 60.',
  'criacao recusa quantidade acima de 60'
);

reset role;

select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket29j_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.payable_series where tenant_id = (select tenant_a_id from ticket29j_context)),
  0,
  'profissional nao le nenhuma Serie pela RLS'
);
select throws_ok(
  $$select public.preview_payable_series('recurring', 'monthly', '2026-01-31', 3, 500)$$,
  '42501',
  'Acesso negado para consultar Contas a Pagar.',
  'profissional e recusado ao consultar a previa'
);
select throws_ok(
  format(
    $$select public.create_recurring_payable_series('Tentativa', '%s'::uuid, 'monthly', '2026-01-31', 3, 500)$$,
    (select categoria_id from ticket29j_context)
  ),
  '42501',
  'Acesso negado para gerenciar Contas a Pagar.',
  'profissional e recusado ao tentar criar Recorrencia'
);

reset role;

select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket29j_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.payable_series where tenant_id = (select tenant_a_id from ticket29j_context)),
  0,
  'gestor de outro tenant nao le Series do tenant A'
);
select throws_ok(
  format(
    $$select public.create_recurring_payable_series('Tentativa', '%s'::uuid, 'monthly', '2026-01-31', 3, 500, null, null, null, '%s'::uuid)$$,
    (select categoria_id from ticket29j_context),
    (select tenant_a_id from ticket29j_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao cria Recorrencia informando o tenant A explicitamente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ticket 12/036: Serie (Parcelamento), residuo na ultima parcela. Contexto
-- proprio (ticket29k_context), para nao depender do estado mutado pelas
-- secoes anteriores.
-- ---------------------------------------------------------------------------
create temporary table ticket29k_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  gerente_b_id uuid not null,
  categoria_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29k_tenant_a__', '__ticket29k_tenant_a__@teste.com', '11999998801', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29k_tenant_b__', '__ticket29k_tenant_b__@teste.com', '11999998802', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29k_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29k_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29k_gerente_b__@teste.com') returning id
), cat as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket29k Categoria' from ta returning id
)
insert into ticket29k_context (tenant_a_id, tenant_b_id, gerente_a_id, barbeiro_a_id, gerente_b_id, categoria_id)
select ta.id, tb.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, cat.id
from ta, tb, au_gerente_a, au_barbeiro_a, au_gerente_b, cat;

update public.users set tenant_id = (select tenant_a_id from ticket29k_context), role = 'gerente', is_active = true where id = (select gerente_a_id from ticket29k_context);
update public.users set tenant_id = (select tenant_a_id from ticket29k_context), role = 'barbeiro', is_active = true where id = (select barbeiro_a_id from ticket29k_context);
update public.users set tenant_id = (select tenant_b_id from ticket29k_context), role = 'gerente', is_active = true where id = (select gerente_b_id from ticket29k_context);
grant select on ticket29k_context to authenticated;

select has_function(
  'public', 'create_installment_payable_series',
  array['text', 'uuid', 'text', 'date', 'integer', 'numeric', 'uuid', 'date', 'text', 'text', 'uuid'],
  'public.create_installment_payable_series(...) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.create_installment_payable_series(text,uuid,text,date,integer,numeric,uuid,date,text,text,uuid)'::regprocedure),
  'create_installment_payable_series fixa search_path vazio'
);
select ok(
  has_function_privilege('service_role', 'public.create_installment_payable_series(text,uuid,text,date,integer,numeric,uuid,date,text,text,uuid)', 'EXECUTE'),
  'service_role executa create_installment_payable_series'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29k_context), true);
set local role authenticated;

-- Parcelamento de 100 em 3: 33,33 / 33,33 / 33,34 (residuo na ultima).
create temporary table ticket29k_previa (position integer, due_date date, amount numeric) on commit drop;
grant select, insert on ticket29k_previa to authenticated;
insert into ticket29k_previa (position, due_date, amount)
select series_position, due_date, amount from public.preview_payable_series(
  'installment', 'monthly', '2026-01-31', 3, 100
);

create temporary table ticket29k_criadas (id uuid, series_position integer, due_date date, amount numeric, competence_date date, description text) on commit drop;
grant select, insert on ticket29k_criadas to authenticated;
insert into ticket29k_criadas (id, series_position, due_date, amount, competence_date, description)
select id, series_position, due_date, amount, competence_date, description from public.create_installment_payable_series(
  'Ticket29k Parcelamento', (select categoria_id from ticket29k_context), 'monthly', '2026-01-31', 3, 100
);

select is(
  (select count(*)::integer from ticket29k_criadas), 3,
  'create_installment_payable_series gera a quantidade pedida de parcelas'
);
select is(
  (select array_agg(amount order by series_position) from ticket29k_criadas),
  array[33.33, 33.33, 33.34]::numeric[],
  'Parcelamento de 100 em 3 parcelas da 33,33 / 33,33 / 33,34 -- residuo na ultima'
);
select is(
  (select sum(amount) from ticket29k_criadas), 100::numeric,
  'a soma das parcelas e exatamente o total, sem perda de centavos'
);
select is(
  (select array_agg(due_date order by position) from ticket29k_previa),
  (select array_agg(due_date order by series_position) from ticket29k_criadas),
  'a previa do Parcelamento devolve as mesmas datas das parcelas efetivamente criadas'
);
select is(
  (select array_agg(amount order by position) from ticket29k_previa),
  (select array_agg(amount order by series_position) from ticket29k_criadas),
  'a previa do Parcelamento devolve os mesmos valores das parcelas efetivamente criadas'
);
select is(
  (select count(distinct competence_date)::integer from ticket29k_criadas), 1,
  'todas as parcelas do Parcelamento compartilham a mesma competencia'
);
select is(
  (select competence_date from ticket29k_criadas where series_position = 1), '2026-01-31'::date,
  'competencia do Parcelamento usa a data ancora quando nao informada explicitamente'
);

-- Competencia explicita, diferente da ancora, replicada em todas as parcelas.
create temporary table ticket29k_criadas_comp (id uuid, series_position integer, competence_date date) on commit drop;
grant select, insert on ticket29k_criadas_comp to authenticated;
insert into ticket29k_criadas_comp (id, series_position, competence_date)
select id, series_position, competence_date from public.create_installment_payable_series(
  'Ticket29k Parcelamento Competencia', (select categoria_id from ticket29k_context), 'monthly', '2026-02-10', 2, 200,
  null, '2026-02-01'
);
select is(
  (select count(distinct competence_date)::integer from ticket29k_criadas_comp), 1,
  'competencia explicita do Parcelamento tambem e a mesma em todas as parcelas'
);
select is(
  (select competence_date from ticket29k_criadas_comp where series_position = 1), '2026-02-01'::date,
  'competencia explicita do Parcelamento e usada, nao a data ancora'
);

-- Descricao gravada sem sufixo "i/N": a numeracao e derivada na leitura.
select is(
  (select count(distinct description)::integer from ticket29k_criadas), 1,
  'a descricao do Parcelamento e identica em todas as parcelas, sem sufixo de numeracao'
);

-- Quantidade fora de 2 a 60 recusada (minimo do Parcelamento e 2, nao 1).
select throws_ok(
  format(
    $$select public.create_installment_payable_series('Ticket29k Invalida', '%s'::uuid, 'monthly', '2026-01-31', 1, 100)$$,
    (select categoria_id from ticket29k_context)
  ),
  '22023',
  'A quantidade deve estar entre 2 e 60.',
  'criacao do Parcelamento recusa quantidade 1 (minimo e 2, nao 1 como na Recorrencia)'
);
select throws_ok(
  format(
    $$select public.create_installment_payable_series('Ticket29k Invalida', '%s'::uuid, 'monthly', '2026-01-31', 61, 100)$$,
    (select categoria_id from ticket29k_context)
  ),
  '22023',
  'A quantidade deve estar entre 2 e 60.',
  'criacao do Parcelamento recusa quantidade acima de 60'
);

reset role;

select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket29k_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select public.create_installment_payable_series('Tentativa', '%s'::uuid, 'monthly', '2026-01-31', 3, 100)$$,
    (select categoria_id from ticket29k_context)
  ),
  '42501',
  'Acesso negado para gerenciar Contas a Pagar.',
  'profissional e recusado ao tentar criar Parcelamento'
);

reset role;

select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket29k_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select public.create_installment_payable_series('Tentativa', '%s'::uuid, 'monthly', '2026-01-31', 3, 100, null, null, null, null, '%s'::uuid)$$,
    (select categoria_id from ticket29k_context),
    (select tenant_a_id from ticket29k_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao cria Parcelamento informando o tenant A explicitamente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ticket 13/036: edicao e cancelamento em serie ("esta e as seguintes em
-- aberto"). Contexto proprio (ticket29l_context).
-- ---------------------------------------------------------------------------
create temporary table ticket29l_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  gerente_b_id uuid not null,
  categoria_id uuid not null,
  categoria2_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29l_tenant_a__', '__ticket29l_tenant_a__@teste.com', '11999998901', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket29l_tenant_b__', '__ticket29l_tenant_b__@teste.com', '11999998902', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29l_gerente_a__@teste.com') returning id
), au_barbeiro_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29l_barbeiro_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket29l_gerente_b__@teste.com') returning id
), cat as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket29l Categoria' from ta returning id
), cat2 as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket29l Categoria 2' from ta returning id
)
insert into ticket29l_context (tenant_a_id, tenant_b_id, gerente_a_id, barbeiro_a_id, gerente_b_id, categoria_id, categoria2_id)
select ta.id, tb.id, au_gerente_a.id, au_barbeiro_a.id, au_gerente_b.id, cat.id, cat2.id
from ta, tb, au_gerente_a, au_barbeiro_a, au_gerente_b, cat, cat2;

update public.users set tenant_id = (select tenant_a_id from ticket29l_context), role = 'gerente', is_active = true where id = (select gerente_a_id from ticket29l_context);
update public.users set tenant_id = (select tenant_a_id from ticket29l_context), role = 'barbeiro', is_active = true where id = (select barbeiro_a_id from ticket29l_context);
update public.users set tenant_id = (select tenant_b_id from ticket29l_context), role = 'gerente', is_active = true where id = (select gerente_b_id from ticket29l_context);
grant select on ticket29l_context to authenticated;

select has_function(
  'public', 'update_payable_series',
  array['uuid', 'text', 'uuid', 'uuid', 'text', 'numeric', 'uuid'],
  'public.update_payable_series(...) existe'
);
select has_function(
  'public', 'cancel_payable_series',
  array['uuid', 'text', 'uuid'],
  'public.cancel_payable_series(...) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.update_payable_series(uuid,text,uuid,uuid,text,numeric,uuid)'::regprocedure),
  'update_payable_series fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.cancel_payable_series(uuid,text,uuid)'::regprocedure),
  'cancel_payable_series fixa search_path vazio'
);
select ok(
  has_function_privilege('service_role', 'public.update_payable_series(uuid,text,uuid,uuid,text,numeric,uuid)', 'EXECUTE'),
  'service_role executa update_payable_series'
);
select ok(
  has_function_privilege('service_role', 'public.cancel_payable_series(uuid,text,uuid)', 'EXECUTE'),
  'service_role executa cancel_payable_series'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket29l_context), true);
set local role authenticated;

-- Recorrencia de 5 ocorrencias mensais de 500, para exercitar edicao/cancelamento em lote.
create temporary table ticket29l_ocorrencias (id uuid, series_position integer) on commit drop;
grant select, insert on ticket29l_ocorrencias to authenticated;
insert into ticket29l_ocorrencias (id, series_position)
select id, series_position from public.create_recurring_payable_series(
  'Ticket29l Recorrencia', (select categoria_id from ticket29l_context), 'monthly', '2026-01-31', 5, 500
);

-- Da baixa total na ocorrencia 2 (fica paga) e baixa parcial na ocorrencia 3.
select public.settle_payable(
  (select id from ticket29l_ocorrencias where series_position = 2),
  500, '2026-02-01', 'pix'
);
select public.settle_payable(
  (select id from ticket29l_ocorrencias where series_position = 3),
  200, '2026-03-01', 'pix'
);

-- Edicao em lote a partir da ocorrencia 1: atinge 1,4,5 (abertas); ignora 2 (paga) e 3 (parcial).
create temporary table ticket29l_edicao (id uuid, series_position integer, status text, ignored boolean, ignore_reason text) on commit drop;
grant select, insert on ticket29l_edicao to authenticated;
insert into ticket29l_edicao (id, series_position, status, ignored, ignore_reason)
select id, series_position, status, ignored, ignore_reason from public.update_payable_series(
  (select id from ticket29l_ocorrencias where series_position = 1),
  'Aluguel reajustado', (select categoria2_id from ticket29l_context), null, 'reajuste',
  600
);

select is(
  (select count(*)::integer from ticket29l_edicao), 5,
  'update_payable_series devolve uma linha por ocorrencia atingida (posicao >= 1)'
);
select is(
  (select count(*)::integer from ticket29l_edicao where ignored), 2,
  'update_payable_series ignora as duas ocorrencias nao abertas (paga e parcial)'
);
select is(
  (select array_agg(series_position order by series_position) from ticket29l_edicao where ignored),
  array[2, 3],
  'as ocorrencias ignoradas sao exatamente a paga (2) e a parcial (3)'
);
select is(
  (select amount from public.payables where id = (select id from ticket29l_ocorrencias where series_position = 1)),
  600::numeric,
  'ocorrencia aberta atingida recebe o novo valor'
);
select is(
  (select amount from public.payables where id = (select id from ticket29l_ocorrencias where series_position = 2)),
  500::numeric,
  'ocorrencia paga mantem o valor original, mesmo dentro do alcance'
);
select is(
  (select description from public.payables where id = (select id from ticket29l_ocorrencias where series_position = 5)),
  'Aluguel reajustado',
  'ocorrencia aberta atingida recebe a nova descricao'
);
select is(
  (select category_id from public.payables where id = (select id from ticket29l_ocorrencias where series_position = 3)),
  (select categoria_id from ticket29l_context),
  'ocorrencia parcialmente paga mantem a categoria original'
);

-- Valor em lote recusado em Parcelamento.
create temporary table ticket29l_parcelas (id uuid, series_position integer) on commit drop;
grant select, insert on ticket29l_parcelas to authenticated;
insert into ticket29l_parcelas (id, series_position)
select id, series_position from public.create_installment_payable_series(
  'Ticket29l Parcelamento', (select categoria_id from ticket29l_context), 'monthly', '2026-01-31', 3, 300
);
select throws_ok(
  format(
    $$select * from public.update_payable_series('%s'::uuid, 'Nova descricao', '%s'::uuid, null, null, 100)$$,
    (select id from ticket29l_parcelas where series_position = 1),
    (select categoria_id from ticket29l_context)
  ),
  '22023',
  'Valor em lote não é aceito em Parcelamento.',
  'edicao em lote recusa valor num Parcelamento'
);

-- Cancelamento em lote a partir da ocorrencia 4 da Recorrencia (ambas abertas).
create temporary table ticket29l_cancelamento (id uuid, series_position integer, status text, ignored boolean, ignore_reason text) on commit drop;
grant select, insert on ticket29l_cancelamento to authenticated;
insert into ticket29l_cancelamento (id, series_position, status, ignored, ignore_reason)
select id, series_position, status, ignored, ignore_reason from public.cancel_payable_series(
  (select id from ticket29l_ocorrencias where series_position = 4),
  'Contrato encerrado'
);
select is(
  (select count(*)::integer from ticket29l_cancelamento), 2,
  'cancel_payable_series devolve uma linha por ocorrencia atingida (posicao >= 4)'
);
select is(
  (select count(*)::integer from ticket29l_cancelamento where not ignored), 2,
  'ambas as ocorrencias 4 e 5 sao canceladas (estavam abertas)'
);
select is(
  (select cancellation_reason from public.payables where id = (select id from ticket29l_ocorrencias where series_position = 5)),
  'Contrato encerrado',
  'cada ocorrencia cancelada recebe o mesmo motivo'
);
select is(
  (select cancelled_by from public.payables where id = (select id from ticket29l_ocorrencias where series_position = 4)),
  (select gerente_a_id from ticket29l_context),
  'cada ocorrencia cancelada recebe o mesmo autor'
);

-- Cancelamento em lote a partir da ocorrencia 2 (paga): ignora 2 e 3, cancela nada mais (4 e 5 ja canceladas).
create temporary table ticket29l_cancelamento2 (id uuid, series_position integer, status text, ignored boolean, ignore_reason text) on commit drop;
grant select, insert on ticket29l_cancelamento2 to authenticated;
insert into ticket29l_cancelamento2 (id, series_position, status, ignored, ignore_reason)
select id, series_position, status, ignored, ignore_reason from public.cancel_payable_series(
  (select id from ticket29l_ocorrencias where series_position = 2),
  'Segunda tentativa'
);
select is(
  (select count(*)::integer from ticket29l_cancelamento2 where ignored), 4,
  'cancel_payable_series ignora paga, parcial e as ja canceladas'
);

reset role;

select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket29l_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select * from public.update_payable_series('%s'::uuid, 'Tentativa', '%s'::uuid)$$,
    (select id from ticket29l_ocorrencias where series_position = 1),
    (select categoria_id from ticket29l_context)
  ),
  '42501',
  'Acesso negado para editar Contas a Pagar.',
  'profissional e recusado ao tentar editar em serie'
);
select throws_ok(
  format(
    $$select * from public.cancel_payable_series('%s'::uuid, 'Tentativa motivo')$$,
    (select id from ticket29l_ocorrencias where series_position = 1)
  ),
  '42501',
  'Acesso negado para cancelar Contas a Pagar.',
  'profissional e recusado ao tentar cancelar em serie'
);

reset role;

select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket29l_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select * from public.update_payable_series('%s'::uuid, 'Tentativa', '%s'::uuid, null, null, null, '%s'::uuid)$$,
    (select id from ticket29l_ocorrencias where series_position = 1),
    (select categoria_id from ticket29l_context),
    (select tenant_a_id from ticket29l_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao edita em serie informando o tenant A explicitamente'
);

reset role;

select * from finish(true);
rollback;
