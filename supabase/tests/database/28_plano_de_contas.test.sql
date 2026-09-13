begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Spec 035 (Plano de Contas): arquivo pgTAP do modulo.
-- Ticket 05: validacao de CPF e CNPJ alfanumerico em
-- private.is_valid_br_document. Os tickets seguintes (03, 06) acrescentam aqui
-- os testes de categorias e fornecedores e ajustam o plan().

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

select * from finish(true);
rollback;
