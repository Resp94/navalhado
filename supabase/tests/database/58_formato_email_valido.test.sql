begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- Spec 047, ticket 01: formato rigido de e-mail no cadastro de Cliente.
--
-- public.email_valido(text) e a funcao unica de formato, reaproveitada
-- pelos tickets seguintes da spec (Fornecedor, tenants, users). Este
-- arquivo cobre a funcao em si e o primeiro CHECK, em customers.email.
-- A tabela de casos abaixo e IDENTICA a de
-- src/lib/__tests__/email.test.ts -- alterar um exige alterar o outro.

-- ---------------------------------------------------------------------------
-- Contrato da funcao
-- ---------------------------------------------------------------------------
select has_function(
  'public', 'email_valido', array['text'],
  'public.email_valido(text) existe'
);

select is(
  (select provolatile from pg_proc where oid = 'public.email_valido(text)'::regprocedure),
  'i'::"char",
  'a funcao e immutable (apta a restricao de verificacao)'
);

select ok(
  (select proconfig @> array['search_path=""'] from pg_proc
   where oid = 'public.email_valido(text)'::regprocedure),
  'a funcao fixa search_path vazio'
);

-- ---------------------------------------------------------------------------
-- Vetores de formato. Conjunto identico ao de src/lib/__tests__/email.test.ts.
-- ---------------------------------------------------------------------------
select is(public.email_valido(v.email), v.valido, v.caso)
from (values
  ('joao@gmail.com', true, 'e-mail simples'),
  ('JOAO@GMAIL.COM', true, 'maiusculas'),
  ('joao.silva@empresa.com.br', true, 'ponto na parte local, TLD composto'),
  ('joao.silva+agenda@empresa.com.br', true, 'tag com +'),
  ('joao_silva@empresa.com', true, 'underscore na parte local'),
  ('joao-mail@sub.dominio.com.br', true, 'hifen no meio do rotulo do dominio'),
  ('j@ab.co', true, 'TLD curto de 2 letras'),
  ('joao123@dominio123.com', true, 'digitos na parte local e no dominio'),
  ('jon@email.com', true, 'dominio real usado como exemplo na conversa'),
  ('a.b.c@dominio.com', true, 'multiplos pontos na parte local'),
  ('jon@x', false, 'dominio sem ponto'),
  ('jon@x.c', false, 'TLD com 1 letra'),
  ('jon..a@x.com', false, 'ponto duplicado na parte local'),
  ('.jon@x.com', false, 'ponto no inicio da parte local'),
  ('jon.@x.com', false, 'ponto no fim da parte local'),
  ('jon@-x.com', false, 'hifen no inicio do rotulo do dominio'),
  ('jon@x-.com', false, 'hifen no fim do rotulo do dominio'),
  ('jon @x.com', false, 'espaco'),
  ('jon@@x.com', false, 'arroba duplicado'),
  ('jon@x..com', false, 'ponto duplicado no dominio'),
  ('jonx.com', false, 'sem arroba'),
  ('', false, 'vazio')
) as v(email, valido, caso);

-- ---------------------------------------------------------------------------
-- CHECK em customers.email. O telefone precisa ser informado: sem ele,
-- customers_telefone_normalizado_valid_chk (Cliente Provisorio) recusaria o
-- INSERT antes mesmo de chegar na checagem de e-mail.
-- ---------------------------------------------------------------------------
insert into public.tenants (name, email, phone) values
  ('__t58_tenant__', '__t58_tenant__@teste.com', '11999999558');

select lives_ok(
  format(
    $$insert into public.customers (tenant_id, name, phone, email) values ('%s'::uuid, 'Cliente valido', '11999990001', 'cliente@gmail.com')$$,
    (select id from public.tenants where name = '__t58_tenant__')
  ),
  'customers aceita e-mail valido'
);

select lives_ok(
  format(
    $$insert into public.customers (tenant_id, name, phone, email) values ('%s'::uuid, 'Cliente sem e-mail', '11999990002', null)$$,
    (select id from public.tenants where name = '__t58_tenant__')
  ),
  'customers aceita e-mail nulo'
);

select throws_ok(
  format(
    $$insert into public.customers (tenant_id, name, phone, email) values ('%s'::uuid, 'Cliente invalido', '11999990003', 'jon@x.c')$$,
    (select id from public.tenants where name = '__t58_tenant__')
  ),
  '23514',
  null,
  'customers recusa INSERT com e-mail mal formado'
);

select throws_ok(
  format(
    $$update public.customers set email = 'jon..a@x.com' where tenant_id = '%s'::uuid and name = 'Cliente valido'$$,
    (select id from public.tenants where name = '__t58_tenant__')
  ),
  '23514',
  null,
  'customers recusa UPDATE com e-mail mal formado'
);

select * from finish();
rollback;
