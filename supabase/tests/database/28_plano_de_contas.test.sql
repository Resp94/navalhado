begin;
create extension if not exists pgtap with schema extensions;
select plan(116);

-- Spec 035 (Plano de Contas): arquivo pgTAP do modulo.
-- Ticket 05: validacao de CPF e CNPJ alfanumerico em
-- private.is_valid_br_document. Ticket 03: tabela financial_categories,
-- semeadura das catorze categorias padrao e acesso por papel. Ticket 04: RPCs
-- de escrita de Categoria de Despesa (criar, renomear, arquivar, reativar).
-- Ticket 06: tabela suppliers e RPCs de Fornecedor (criar, atualizar,
-- arquivar, reativar), reusando o algoritmo de documento do ticket 05 e a
-- categoria padrao do ticket 04.

-- ---------------------------------------------------------------------------
-- Contrato da funcao
-- ---------------------------------------------------------------------------
select has_function(
  'private', 'is_valid_br_document', array['text'],
  'private.is_valid_br_document(text) existe'
);

select is(
  (select provolatile from pg_proc where oid = 'private.is_valid_br_document(text)'::regprocedure),
  'i'::"char",
  'a funcao e immutable (apta a restricao de verificacao)'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.is_valid_br_document(text)'::regprocedure),
  'a funcao fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'private.is_valid_br_document(text)', 'EXECUTE'),
  'anon nao executa a funcao'
);

select ok(
  not has_function_privilege('authenticated', 'private.is_valid_br_document(text)', 'EXECUTE'),
  'authenticated nao executa a funcao diretamente'
);

select ok(
  has_function_privilege('service_role', 'private.is_valid_br_document(text)', 'EXECUTE'),
  'service_role executa a funcao'
);

-- ---------------------------------------------------------------------------
-- Vetores de documento. Conjunto IDENTICO ao de
-- src/modules/plano-contas/__tests__/documento.test.ts, que testa a funcao
-- pura documentoValido. Alterar um exige alterar o outro.
-- Os vetores sao documentos ja normalizados (a forma gravada no banco).
-- ---------------------------------------------------------------------------
select is(private.is_valid_br_document(v.documento), v.valido, v.caso)
from (values
  ('52998224725', true, 'CPF valido'),
  ('11222333000181', true, 'CNPJ numerico valido'),
  ('12ABC34501DE35', true, 'CNPJ alfanumerico valido (exemplo da Receita Federal)'),
  ('52998224724', false, 'CPF com digito verificador errado'),
  ('11222333000182', false, 'CNPJ numerico com digito verificador errado'),
  ('12ABC34501DE36', false, 'CNPJ alfanumerico com digito verificador errado'),
  ('12ABC34501DE3A', false, 'CNPJ com letra na posicao de digito verificador'),
  ('11111111111', false, 'CPF com sequencia repetida'),
  ('00000000000000', false, 'CNPJ com sequencia repetida'),
  ('', false, 'comprimento zero'),
  ('5299822472', false, 'comprimento 10'),
  ('529982247250', false, 'comprimento 12'),
  ('112223330001810', false, 'comprimento 15'),
  ('52998224A25', false, 'letra em CPF'),
  ('12abc34501de35', false, 'minuscula nao e forma normalizada'),
  ('529.982.247-25', false, 'mascara nao e forma normalizada')
) as v(documento, valido, caso);

select is(
  private.is_valid_br_document(null),
  false,
  'documento nulo nao e valido (a coluna opcional trata nulo na propria restricao)'
);

-- ---------------------------------------------------------------------------
-- Uso em restricao de verificacao, em escrita direta como superusuario.
-- Tabela temporaria descartada no rollback: nenhuma tabela do schema e criada.
-- ---------------------------------------------------------------------------
create temporary table ticket28_documento_check (
  document text check (document is null or private.is_valid_br_document(document))
) on commit drop;

select lives_ok(
  $$insert into ticket28_documento_check (document)
    values ('12ABC34501DE35'), ('52998224725'), (null)$$,
  'restricao aceita documento valido e nulo'
);

select throws_ok(
  $$insert into ticket28_documento_check (document) values ('11222333000182')$$,
  '23514',
  null,
  'restricao recusa documento invalido mesmo em escrita direta como superusuario'
);

-- ---------------------------------------------------------------------------
-- Ticket 03: tabela financial_categories e semeadura das catorze Categorias
-- de Despesa padrao. Arte previa de acesso por papel:
-- 26_conta_do_profissional_gorjeta.test.sql.
-- ---------------------------------------------------------------------------
select has_table('public', 'financial_categories', 'tabela financial_categories existe');

select has_function(
  'private', 'seed_default_expense_categories', array['uuid'],
  'private.seed_default_expense_categories(uuid) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'private.seed_default_expense_categories(uuid)'::regprocedure),
  'a funcao de semeadura fixa search_path vazio'
);

create temporary table ticket28c_context (
  tenant_a_id uuid not null,
  gerente_a_id uuid not null,
  barbeiro_a_id uuid not null,
  tenant_b_id uuid not null,
  gerente_b_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone)
  values ('__ticket28c_tenant_a__', '__ticket28c_tenant_a__@teste.com', '11999999991')
  returning id
), tb as (
  insert into public.tenants (name, email, phone)
  values ('__ticket28c_tenant_b__', '__ticket28c_tenant_b__@teste.com', '11999999992')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket28c_gerente_a__auth@teste.com')
  returning id
), au_barbeiro_a as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket28c_barbeiro_a__auth@teste.com')
  returning id
), au_gerente_b as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket28c_gerente_b__auth@teste.com')
  returning id
)
insert into ticket28c_context (tenant_a_id, gerente_a_id, barbeiro_a_id, tenant_b_id, gerente_b_id)
select ta.id, au_gerente_a.id, au_barbeiro_a.id, tb.id, au_gerente_b.id
from ta, tb, au_gerente_a, au_barbeiro_a, au_gerente_b;

update public.users
set tenant_id = (select tenant_a_id from ticket28c_context), role = 'gerente', is_active = true
where id = (select gerente_a_id from ticket28c_context);
update public.users
set tenant_id = (select tenant_a_id from ticket28c_context), role = 'barbeiro', is_active = true
where id = (select barbeiro_a_id from ticket28c_context);
update public.users
set tenant_id = (select tenant_b_id from ticket28c_context), role = 'gerente', is_active = true
where id = (select gerente_b_id from ticket28c_context);

grant select on ticket28c_context to authenticated;

select is(
  (select count(*)::integer from public.financial_categories where tenant_id = (select tenant_a_id from ticket28c_context)),
  14,
  'tenant inserido nasce com as catorze categorias padrao'
);

select is(
  (select count(distinct seed_key)::integer from public.financial_categories
   where tenant_id = (select tenant_a_id from ticket28c_context) and seed_key is not null),
  14,
  'as catorze categorias tem chave estavel distinta'
);

select is(
  (select count(*)::integer from public.financial_categories
   where tenant_id = (select tenant_a_id from ticket28c_context) and nature <> 'expense'),
  0,
  'todas as categorias padrao tem natureza expense'
);

select is(
  (select count(*)::integer from public.financial_categories
   where tenant_id = (select tenant_a_id from ticket28c_context) and created_by is not null),
  0,
  'categorias semeadas tem autor nulo'
);

select lives_ok(
  $$select private.seed_default_expense_categories((select tenant_a_id from ticket28c_context))$$,
  'roda a semeadura de novo sobre o mesmo tenant'
);
select is(
  (select count(*)::integer from public.financial_categories where tenant_id = (select tenant_a_id from ticket28c_context)),
  14,
  'rodar a semeadura de novo nao duplica categorias'
);

update public.financial_categories
set name = 'Luz'
where tenant_id = (select tenant_a_id from ticket28c_context) and seed_key = 'energia';

select lives_ok(
  $$select private.seed_default_expense_categories((select tenant_a_id from ticket28c_context))$$,
  'roda a semeadura apos renomear uma categoria padrao'
);
select is(
  (select count(*)::integer from public.financial_categories where tenant_id = (select tenant_a_id from ticket28c_context)),
  14,
  'renomear uma categoria padrao e semear de novo nao duplica'
);
select is(
  (select name from public.financial_categories
   where tenant_id = (select tenant_a_id from ticket28c_context) and seed_key = 'energia'),
  'Luz',
  'a categoria renomeada continua com o nome novo apos nova semeadura'
);
select ok(
  not exists (
    select 1 from public.financial_categories
    where tenant_id = (select tenant_a_id from ticket28c_context) and lower(name) = lower('Energia')
  ),
  'a semeadura nao recria a categoria com o nome antigo'
);

select is(
  (select count(*)::integer from public.financial_categories where tenant_id = (select tenant_b_id from ticket28c_context)),
  14,
  'segundo tenant tambem nasce com as catorze categorias'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket28c_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.financial_categories where tenant_id = (select tenant_a_id from ticket28c_context)),
  14,
  'gestor do tenant A le as categorias do proprio tenant'
);
select is(
  (select count(*)::integer from public.financial_categories where tenant_id = (select tenant_b_id from ticket28c_context)),
  0,
  'gestor do tenant A nao le categorias do tenant B'
);

select throws_ok(
  $$insert into public.financial_categories (tenant_id, nature, name)
    values ((select tenant_a_id from ticket28c_context), 'expense', 'Categoria direta')$$,
  '42501',
  null,
  'gestor autenticado nao pode inserir diretamente em financial_categories'
);
select throws_ok(
  $$update public.financial_categories set name = 'Outra'
    where tenant_id = (select tenant_a_id from ticket28c_context)$$,
  '42501',
  null,
  'gestor autenticado nao pode atualizar financial_categories diretamente'
);
select throws_ok(
  $$delete from public.financial_categories where tenant_id = (select tenant_a_id from ticket28c_context)$$,
  '42501',
  null,
  'gestor autenticado nao pode excluir de financial_categories diretamente'
);

reset role;
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket28c_context), true);
set local role authenticated;

select is(
  (select count(*)::integer from public.financial_categories where tenant_id = (select tenant_a_id from ticket28c_context)),
  0,
  'profissional nao le nenhuma categoria financeira'
);

reset role;

select ok(
  not has_table_privilege('anon', 'public.financial_categories', 'SELECT'),
  'anon nao tem privilegio de SELECT em financial_categories'
);
select ok(
  not has_table_privilege('anon', 'public.financial_categories', 'INSERT'),
  'anon nao tem privilegio de INSERT em financial_categories'
);

select ok(
  not has_function_privilege('anon', 'private.seed_default_expense_categories(uuid)', 'EXECUTE'),
  'anon nao executa a funcao de semeadura'
);
select ok(
  not has_function_privilege('authenticated', 'private.seed_default_expense_categories(uuid)', 'EXECUTE'),
  'authenticated nao executa a funcao de semeadura diretamente'
);
select ok(
  has_function_privilege('service_role', 'private.seed_default_expense_categories(uuid)', 'EXECUTE'),
  'service_role executa a funcao de semeadura'
);

-- ---------------------------------------------------------------------------
-- Ticket 04: RPCs de escrita de Categoria de Despesa (criar, renomear,
-- arquivar, reativar). Reusa o contexto (tenant_a_id, gerente_a_id,
-- barbeiro_a_id, tenant_b_id, gerente_b_id) montado acima para o ticket 03.
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'create_expense_category', array['text', 'uuid'],
  'public.create_expense_category(text, uuid) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.create_expense_category(text, uuid)'::regprocedure),
  'create_expense_category fixa search_path vazio'
);
select has_function(
  'public', 'rename_expense_category', array['uuid', 'text', 'uuid'],
  'public.rename_expense_category(uuid, text, uuid) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.rename_expense_category(uuid, text, uuid)'::regprocedure),
  'rename_expense_category fixa search_path vazio'
);
select has_function(
  'public', 'archive_expense_category', array['uuid', 'uuid'],
  'public.archive_expense_category(uuid, uuid) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.archive_expense_category(uuid, uuid)'::regprocedure),
  'archive_expense_category fixa search_path vazio'
);
select has_function(
  'public', 'reactivate_expense_category', array['uuid', 'uuid'],
  'public.reactivate_expense_category(uuid, uuid) existe'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.reactivate_expense_category(uuid, uuid)'::regprocedure),
  'reactivate_expense_category fixa search_path vazio'
);

select ok(
  not has_function_privilege('anon', 'public.create_expense_category(text, uuid)', 'EXECUTE'),
  'anon nao executa create_expense_category'
);
select ok(
  not has_function_privilege('anon', 'public.rename_expense_category(uuid, text, uuid)', 'EXECUTE'),
  'anon nao executa rename_expense_category'
);
select ok(
  not has_function_privilege('anon', 'public.archive_expense_category(uuid, uuid)', 'EXECUTE'),
  'anon nao executa archive_expense_category'
);
select ok(
  not has_function_privilege('anon', 'public.reactivate_expense_category(uuid, uuid)', 'EXECUTE'),
  'anon nao executa reactivate_expense_category'
);

create temporary table ticket28d_created (
  id uuid,
  name text,
  created_by uuid
) on commit drop;

create temporary table ticket28d_conflict_capture (
  step text primary key,
  existing_id uuid,
  existing_name text,
  archived boolean
) on commit drop;

-- Os testes a seguir escrevem nessas tabelas temporarias como authenticated
-- (dentro do bloco de RPC ou do DO capturando a excecao): sem GRANT, a mesma
-- lacuna que ticket28c_context ja precisou fechar acima.
grant select, insert on ticket28d_created to authenticated;
grant select, insert on ticket28d_conflict_capture to authenticated;

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket28c_context), true);
set local role authenticated;

-- Criar normaliza o nome (pontas aparadas, espacos internos colapsados) e
-- registra autoria.
insert into ticket28d_created (id, name, created_by)
select id, name, created_by
from public.create_expense_category('  Estacionamento   Coberto  ', (select tenant_a_id from ticket28c_context));

select is(
  (select name from ticket28d_created),
  'Estacionamento Coberto',
  'criar normaliza pontas e espacos internos repetidos'
);
select is(
  (select created_by from ticket28d_created),
  (select gerente_a_id from ticket28c_context),
  'criar registra o autor'
);

-- Conflito na criacao: mesmo nome (sem diferenciar maiusculas) de categoria
-- ativa. O conflito identifica o registro existente e informa que ele nao
-- esta arquivado.
do $$
declare
  v_detail text;
  v_json jsonb;
begin
  begin
    perform public.create_expense_category('estacionamento coberto', (select tenant_a_id from ticket28c_context));
    raise exception 'ticket28d: esperava conflito de nome na criacao';
  exception when sqlstate '23505' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_json := v_detail::jsonb;
    insert into ticket28d_conflict_capture (step, existing_id, existing_name, archived)
    values ('criar_ativa', (v_json->>'existing_id')::uuid, v_json->>'existing_name', (v_json->>'archived')::boolean);
  end;
end;
$$;

select ok(
  exists (select 1 from ticket28d_conflict_capture where step = 'criar_ativa'),
  'criar com nome existente levanta conflito (SQLSTATE 23505) com detalhe estruturado'
);
select is(
  (select existing_id from ticket28d_conflict_capture where step = 'criar_ativa'),
  (select id from ticket28d_created),
  'o conflito identifica a categoria existente pelo id'
);
select is(
  (select existing_name from ticket28d_conflict_capture where step = 'criar_ativa'),
  'Estacionamento Coberto',
  'o conflito informa o nome da categoria existente'
);
select is(
  (select archived from ticket28d_conflict_capture where step = 'criar_ativa'),
  false,
  'o conflito informa que a categoria existente nao esta arquivada'
);

-- Conflito ao renomear para um nome ja usado por outra categoria (a
-- 'Marketing' semeada).
do $$
declare
  v_detail text;
  v_json jsonb;
begin
  begin
    perform public.rename_expense_category(
      (select id from ticket28d_created), 'marketing',
      (select tenant_a_id from ticket28c_context)
    );
    raise exception 'ticket28d: esperava conflito de nome ao renomear';
  exception when sqlstate '23505' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_json := v_detail::jsonb;
    insert into ticket28d_conflict_capture (step, existing_id, existing_name, archived)
    values ('renomear_ativa', (v_json->>'existing_id')::uuid, v_json->>'existing_name', (v_json->>'archived')::boolean);
  end;
end;
$$;

select is(
  (select existing_name from ticket28d_conflict_capture where step = 'renomear_ativa'),
  'Marketing',
  'renomear para nome existente identifica a categoria (Marketing)'
);
select is(
  (select archived from ticket28d_conflict_capture where step = 'renomear_ativa'),
  false,
  'renomear para nome de categoria ativa informa que ela nao esta arquivada'
);

-- Arquivar: reversivel, registra autor e momento.
select ok(
  (select archived_at from public.archive_expense_category(
    (select id from ticket28d_created), (select tenant_a_id from ticket28c_context)
  )) is not null,
  'arquivar preenche archived_at'
);
select is(
  (select archived_by from public.financial_categories where id = (select id from ticket28d_created)),
  (select gerente_a_id from ticket28c_context),
  'arquivar registra quem arquivou'
);

-- Recusas de operacao invalida sobre a categoria ja arquivada, nunca em
-- silencio.
select throws_ok(
  $$select public.rename_expense_category(
      (select id from ticket28d_created), 'Novo nome',
      (select tenant_a_id from ticket28c_context)
    )$$,
  'P0001',
  'Categoria arquivada não pode ser renomeada. Reative-a antes.',
  'renomear categoria arquivada e recusado'
);
select throws_ok(
  $$select public.archive_expense_category(
      (select id from ticket28d_created), (select tenant_a_id from ticket28c_context)
    )$$,
  'P0001',
  'Esta categoria já está arquivada.',
  'arquivar categoria ja arquivada e recusado'
);

-- Reativar: nunca colide (a unicidade vale tambem contra arquivada).
select is(
  (select archived_at from public.reactivate_expense_category(
    (select id from ticket28d_created), (select tenant_a_id from ticket28c_context)
  )),
  null,
  'reativar limpa archived_at'
);
select throws_ok(
  $$select public.reactivate_expense_category(
      (select id from ticket28d_created), (select tenant_a_id from ticket28c_context)
    )$$,
  'P0001',
  'Esta categoria já está ativa.',
  'reativar categoria ja ativa e recusado'
);

-- Conflito contra categoria ARQUIVADA: arquiva 'Marketing' e tenta criar
-- 'marketing' de novo. A unicidade vale tambem contra arquivada, entao o
-- conflito ocorre do mesmo jeito, e informa que a existente esta arquivada
-- (para a tela oferecer reativar em vez de recriar).
select public.archive_expense_category(
  (select id from public.financial_categories
   where tenant_id = (select tenant_a_id from ticket28c_context) and seed_key = 'marketing'),
  (select tenant_a_id from ticket28c_context)
);

do $$
declare
  v_detail text;
  v_json jsonb;
begin
  begin
    perform public.create_expense_category('marketing', (select tenant_a_id from ticket28c_context));
    raise exception 'ticket28d: esperava conflito contra categoria arquivada';
  exception when sqlstate '23505' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_json := v_detail::jsonb;
    insert into ticket28d_conflict_capture (step, existing_id, existing_name, archived)
    values ('criar_arquivada', (v_json->>'existing_id')::uuid, v_json->>'existing_name', (v_json->>'archived')::boolean);
  end;
end;
$$;

select is(
  (select existing_name from ticket28d_conflict_capture where step = 'criar_arquivada'),
  'Marketing',
  'conflito contra categoria arquivada identifica pelo nome (Marketing)'
);
select is(
  (select archived from ticket28d_conflict_capture where step = 'criar_arquivada'),
  true,
  'conflito contra categoria arquivada informa que ela esta arquivada'
);

reset role;

-- Profissional e recusado pela revalidacao de papel dentro da RPC.
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket28c_context), true);
set local role authenticated;

select throws_ok(
  $$select public.create_expense_category('Categoria do barbeiro', null)$$,
  '42501',
  'Acesso negado para gerenciar o Plano de Contas.',
  'profissional e recusado ao tentar criar categoria de despesa'
);

reset role;

-- Gestor de outro tenant nao alcanca a categoria do tenant A: a RPC resolve
-- o tenant do proprio usuario (parametro ausente) e nao encontra a linha,
-- sem vazar se ela existe em outro tenant.
select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket28c_context), true);
set local role authenticated;

select throws_ok(
  $$select public.rename_expense_category(
      (select id from ticket28d_created), 'Nome de outro tenant', null
    )$$,
  'P0001',
  'Categoria de despesa não encontrada.',
  'gestor de outro tenant nao renomeia categoria do tenant A'
);

reset role;

-- ---------------------------------------------------------------------------
-- Ticket 06: tabela suppliers e RPCs de Fornecedor (criar, atualizar,
-- arquivar, reativar). Reaproveita ticket28c_context (tenant_a_id,
-- gerente_a_id, barbeiro_a_id, tenant_b_id, gerente_b_id). Categorias
-- proprias, dedicadas a este bloco, para nao depender do estado mutado de
-- ticket28d_created pelas secoes anteriores.
-- ---------------------------------------------------------------------------
select has_table('public', 'suppliers', 'tabela suppliers existe');

select has_function(
  'public', 'create_supplier', array['text', 'text', 'text', 'text', 'text', 'uuid', 'uuid'],
  'public.create_supplier(...) existe'
);
select has_function(
  'public', 'update_supplier', array['uuid', 'text', 'text', 'text', 'text', 'text', 'uuid', 'uuid'],
  'public.update_supplier(...) existe'
);
select has_function(
  'public', 'archive_supplier', array['uuid', 'uuid'], 'public.archive_supplier(uuid, uuid) existe'
);
select has_function(
  'public', 'reactivate_supplier', array['uuid', 'uuid'], 'public.reactivate_supplier(uuid, uuid) existe'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.create_supplier(text,text,text,text,text,uuid,uuid)'::regprocedure),
  'create_supplier fixa search_path vazio'
);
select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.update_supplier(uuid,text,text,text,text,text,uuid,uuid)'::regprocedure),
  'update_supplier fixa search_path vazio'
);

-- Privilegios: anon sem nada, authenticated sem escrita direta na tabela,
-- service_role com execucao nas quatro RPCs.
select ok(
  not has_table_privilege('anon', 'public.suppliers', 'SELECT'),
  'anon nao tem privilegio de SELECT em suppliers'
);
select ok(
  not has_function_privilege('anon', 'public.create_supplier(text,text,text,text,text,uuid,uuid)', 'EXECUTE'),
  'anon nao executa create_supplier'
);
select ok(
  not has_table_privilege('authenticated', 'public.suppliers', 'INSERT'),
  'authenticated nao tem privilegio de INSERT direto em suppliers'
);
select ok(
  not has_table_privilege('authenticated', 'public.suppliers', 'UPDATE'),
  'authenticated nao tem privilegio de UPDATE direto em suppliers'
);
select ok(
  not has_table_privilege('authenticated', 'public.suppliers', 'DELETE'),
  'authenticated nao tem privilegio de DELETE direto em suppliers'
);
select ok(
  has_function_privilege('service_role', 'public.create_supplier(text,text,text,text,text,uuid,uuid)', 'EXECUTE'),
  'service_role executa create_supplier'
);

-- Restricao de verificacao do documento: recusa documento invalido mesmo em
-- escrita direta como superusuario (nao passa pela RPC).
select throws_ok(
  format(
    $$insert into public.suppliers (tenant_id, name, document) values ('%s'::uuid, 'Fornecedor Doc Invalido', '11111111111')$$,
    (select tenant_a_id from ticket28c_context)
  ),
  '23514',
  null,
  'restricao de verificacao recusa documento invalido em escrita direta como superusuario'
);

-- Categorias dedicadas a este bloco: uma ativa e DUAS ja arquivadas (a
-- segunda serve para provar que trocar para uma categoria arquivada
-- DIFERENTE da ja vinculada continua recusado -- so a MESMA e aceita).
create temporary table ticket28f_context (
  categoria_ativa_id uuid not null,
  categoria_arquivada_id uuid not null,
  categoria_arquivada_2_id uuid not null
) on commit drop;

with ca as (
  insert into public.financial_categories (tenant_id, nature, name)
  values ((select tenant_a_id from ticket28c_context), 'expense', 'Ticket28f Ativa')
  returning id
), cb as (
  insert into public.financial_categories (tenant_id, nature, name, archived_at, archived_by)
  values ((select tenant_a_id from ticket28c_context), 'expense', 'Ticket28f Arquivada', now(), (select gerente_a_id from ticket28c_context))
  returning id
), cc as (
  insert into public.financial_categories (tenant_id, nature, name, archived_at, archived_by)
  values ((select tenant_a_id from ticket28c_context), 'expense', 'Ticket28f Arquivada 2', now(), (select gerente_a_id from ticket28c_context))
  returning id
)
insert into ticket28f_context (categoria_ativa_id, categoria_arquivada_id, categoria_arquivada_2_id)
select ca.id, cb.id, cc.id from ca, cb, cc;

grant select on ticket28f_context to authenticated;

-- Categoria padrao de outro tenant recusada pelo FK composto: a integridade
-- fica no schema, nao so na RPC -- prova com INSERT direto como superusuario.
create temporary table ticket28f_categoria_tenant_b (id uuid not null) on commit drop;
insert into ticket28f_categoria_tenant_b (id)
select id from public.financial_categories
where tenant_id = (select tenant_b_id from ticket28c_context) and seed_key = 'marketing';

select throws_ok(
  format(
    $$insert into public.suppliers (tenant_id, name, default_category_id)
      values ('%s'::uuid, 'Fornecedor FK Composto', '%s'::uuid)$$,
    (select tenant_a_id from ticket28c_context),
    (select id from ticket28f_categoria_tenant_b)
  ),
  '23503',
  null,
  'categoria padrao de outro tenant e recusada pelo FK composto (tenant_id, default_category_id)'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket28c_context), true);
set local role authenticated;

-- Criar com categoria ativa: nome, documento, telefone e e-mail normalizados.
create temporary table ticket28f_created (id uuid) on commit drop;
insert into ticket28f_created (id)
select id from public.create_supplier(
  '  Distribuidora   ABC  ', '123.456.789-09', '(11) 98888-7777', 'Contato@Fornecedor.COM', '  obs  ',
  (select categoria_ativa_id from ticket28f_context), (select tenant_a_id from ticket28c_context)
);

select is(
  (select name from public.suppliers where id = (select id from ticket28f_created)),
  'Distribuidora ABC',
  'criar fornecedor normaliza o nome (pontas aparadas, espacos colapsados)'
);
select is(
  (select document from public.suppliers where id = (select id from ticket28f_created)),
  '12345678909',
  'criar fornecedor normaliza o documento (sem mascara)'
);
select is(
  (select phone from public.suppliers where id = (select id from ticket28f_created)),
  '11988887777',
  'criar fornecedor normaliza o telefone (so digitos)'
);
select is(
  (select email from public.suppliers where id = (select id from ticket28f_created)),
  'contato@fornecedor.com',
  'criar fornecedor normaliza o e-mail (minusculas)'
);
select is(
  (select default_category_id from public.suppliers where id = (select id from ticket28f_created)),
  (select categoria_ativa_id from ticket28f_context),
  'criar fornecedor aceita categoria padrao ativa'
);

-- Categoria padrao arquivada e recusada na criacao.
select throws_ok(
  format(
    $$select public.create_supplier('Fornecedor Categoria Arquivada', null, null, null, null, '%s'::uuid, '%s'::uuid)$$,
    (select categoria_arquivada_id from ticket28f_context),
    (select tenant_a_id from ticket28c_context)
  ),
  '22023',
  'Categoria de despesa padrão informada não existe ou está arquivada.',
  'criar fornecedor com categoria padrao arquivada e recusado'
);

-- Documento unico por tenant, inclusive contra arquivado.
create temporary table ticket28f_conflict_capture (step text, existing_id uuid, existing_name text, archived boolean) on commit drop;

do $$
declare
  v_detail text;
  v_json jsonb;
begin
  begin
    perform public.create_supplier('Outro Nome', '123.456.789-09', null, null, null, null, (select tenant_a_id from ticket28c_context));
    raise exception 'ticket28f: esperava conflito de documento';
  exception when sqlstate '23505' then
    get stacked diagnostics v_detail = pg_exception_detail;
    v_json := v_detail::jsonb;
    insert into ticket28f_conflict_capture (step, existing_id, existing_name, archived)
    values ('documento', (v_json->>'existing_id')::uuid, v_json->>'existing_name', (v_json->>'archived')::boolean);
  end;
end;
$$;

select is(
  (select existing_id from ticket28f_conflict_capture where step = 'documento'),
  (select id from ticket28f_created),
  'conflito de documento identifica o fornecedor existente pelo id'
);
select is(
  (select archived from ticket28f_conflict_capture where step = 'documento'),
  false,
  'conflito de documento informa que o fornecedor existente nao esta arquivado'
);

-- Nome unico sem diferenciar maiusculas.
select throws_ok(
  format(
    $$select public.create_supplier('distribuidora abc', null, null, null, null, null, '%s'::uuid)$$,
    (select tenant_a_id from ticket28c_context)
  ),
  '23505',
  'Já existe um fornecedor com este nome.',
  'nome de fornecedor e unico sem diferenciar maiusculas'
);

-- Atualizar: aceita categoria padrao ja arquivada quando NAO mudou.
reset role;
update public.suppliers
set default_category_id = (select categoria_arquivada_id from ticket28f_context)
where id = (select id from ticket28f_created);
set local role authenticated;

select lives_ok(
  format(
    $$select public.update_supplier('%s'::uuid, 'Distribuidora ABC', '123.456.789-09', null, null, null, '%s'::uuid, '%s'::uuid)$$,
    (select id from ticket28f_created),
    (select categoria_arquivada_id from ticket28f_context),
    (select tenant_a_id from ticket28c_context)
  ),
  'atualizar fornecedor aceita categoria padrao arquivada quando nao mudou'
);

-- Atualizar: recusa trocar para uma NOVA categoria arquivada (diferente da
-- ja vinculada) -- so a mesma escapa da checagem de ativa.
select throws_ok(
  format(
    $$select public.update_supplier('%s'::uuid, 'Distribuidora ABC', '123.456.789-09', null, null, null, '%s'::uuid, '%s'::uuid)$$,
    (select id from ticket28f_created),
    (select categoria_arquivada_2_id from ticket28f_context),
    (select tenant_a_id from ticket28c_context)
  ),
  '22023',
  'Categoria de despesa padrão informada não existe ou está arquivada.',
  'atualizar fornecedor trocando para uma NOVA categoria arquivada e recusado'
);

-- Atualizar removendo a categoria padrao (para null) nunca exige checagem de
-- ativa, e funciona sem erro.
select lives_ok(
  format(
    $$select public.update_supplier('%s'::uuid, 'Distribuidora ABC', '123.456.789-09', null, null, null, null, '%s'::uuid)$$,
    (select id from ticket28f_created),
    (select tenant_a_id from ticket28c_context)
  ),
  'atualizar fornecedor removendo a categoria padrao funciona sem checagem de ativa'
);

-- Arquivar, reativar e recusas de dupla operacao / atualizar arquivado.
select ok(
  (select archived_at from public.archive_supplier(
    (select id from ticket28f_created), (select tenant_a_id from ticket28c_context)
  )) is not null,
  'arquivar fornecedor preenche archived_at'
);
select throws_ok(
  format(
    $$select public.update_supplier('%s'::uuid, 'Novo Nome', null, null, null, null, null, '%s'::uuid)$$,
    (select id from ticket28f_created),
    (select tenant_a_id from ticket28c_context)
  ),
  'P0001',
  'Fornecedor arquivado não pode ser atualizado. Reative-o antes.',
  'atualizar fornecedor arquivado e recusado'
);
select throws_ok(
  format(
    $$select public.archive_supplier('%s'::uuid, '%s'::uuid)$$,
    (select id from ticket28f_created),
    (select tenant_a_id from ticket28c_context)
  ),
  'P0001',
  'Este fornecedor já está arquivado.',
  'arquivar fornecedor ja arquivado e recusado'
);
select is(
  (select archived_at from public.reactivate_supplier(
    (select id from ticket28f_created), (select tenant_a_id from ticket28c_context)
  )),
  null,
  'reativar fornecedor limpa archived_at'
);
select throws_ok(
  format(
    $$select public.reactivate_supplier('%s'::uuid, '%s'::uuid)$$,
    (select id from ticket28f_created),
    (select tenant_a_id from ticket28c_context)
  ),
  'P0001',
  'Este fornecedor já está ativo.',
  'reativar fornecedor ja ativo e recusado'
);

reset role;

-- Profissional nao le nenhum fornecedor.
select set_config('request.jwt.claim.sub', (select barbeiro_a_id::text from ticket28c_context), true);
set local role authenticated;
select is(
  (select count(*)::integer from public.suppliers where tenant_id = (select tenant_a_id from ticket28c_context)),
  0,
  'profissional nao le nenhum fornecedor'
);
select throws_ok(
  $$select public.create_supplier('Fornecedor do barbeiro', null, null, null, null, null, null)$$,
  '42501',
  'Acesso negado para gerenciar o Plano de Contas.',
  'profissional e recusado ao tentar criar fornecedor'
);
reset role;

-- Gestor de outro tenant nao le fornecedores do tenant A, e nao escreve
-- diretamente na tabela.
select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket28c_context), true);
set local role authenticated;
select is(
  (select count(*)::integer from public.suppliers where tenant_id = (select tenant_a_id from ticket28c_context)),
  0,
  'gestor de outro tenant nao le fornecedores do tenant A'
);
select throws_ok(
  format(
    $$insert into public.suppliers (tenant_id, name) values ('%s'::uuid, 'Insercao direta')$$,
    (select tenant_a_id from ticket28c_context)
  ),
  '42501',
  null,
  'gestor autenticado nao insere diretamente em suppliers'
);
reset role;

select * from finish(true);
rollback;
