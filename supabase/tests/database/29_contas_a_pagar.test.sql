begin;
create extension if not exists pgtap with schema extensions;
select plan(83);

-- Spec 036 (Contas a Pagar). Ticket 06: tabela public.payables, RPC de criacao
-- avulsa (create_payable) e RPC de leitura paginada (list_payables), migration
-- 20260913180000_livro_de_contas_a_pagar.sql. Ticket 07: tabela
-- public.payable_settlements (Baixa) e RPCs settle_payable,
-- reverse_payable_settlement, get_payable, list_payable_settlements,
-- migration 20260914090000_baixa_fora_do_caixa_e_estorno.sql.

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

select * from finish(true);
rollback;
