begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

-- Spec 035 (Plano de Contas): arquivo pgTAP do modulo.
-- Ticket 05: validacao de CPF e CNPJ alfanumerico em
-- private.is_valid_br_document. Ticket 03: tabela financial_categories,
-- semeadura das catorze categorias padrao e acesso por papel. O ticket 06
-- acrescenta aqui os testes de fornecedores e ajusta o plan().

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

select * from finish(true);
rollback;
