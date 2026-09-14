begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- Spec 036 (Contas a Pagar), ticket 06: tabela public.payables, RPC de criacao
-- avulsa (create_payable) e RPC de leitura paginada (list_payables), migration
-- 20260913180000_livro_de_contas_a_pagar.sql.

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

select * from finish(true);
rollback;
