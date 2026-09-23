begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- Spec 047, ticket 02: formato rigido de e-mail em Fornecedor.
--
-- suppliers_email_check e as RPCs create_supplier/update_supplier passam a
-- usar public.email_valido (ticket 01) no lugar da regex frouxa antiga.
-- Este arquivo cobre so o que mudou: os testes 28 e 29 continuam cobrindo
-- o resto do contrato de Fornecedor (nome, documento, categoria padrao).

create temporary table t59_context (
  tenant_id uuid not null,
  gerente_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__t59_tenant__', '__t59_tenant__@teste.com', '11999999559')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__t59_gerente__auth@teste.com')
  returning id
)
insert into t59_context (tenant_id, gerente_id)
select t.id, au.id from t, au;

update public.users
set tenant_id = (select tenant_id from t59_context), role = 'gerente', is_active = true
where id = (select gerente_id from t59_context);

grant select on t59_context to authenticated;

select set_config('request.jwt.claim.sub', (select gerente_id::text from t59_context), true);
set local role authenticated;

select throws_ok(
  $$select public.create_supplier('Fornecedor TLD curto', null, null, 'contato@x.c')$$,
  '22023',
  'E-mail inválido.',
  'create_supplier recusa TLD de 1 letra (regra mais rigida da spec 047)'
);

select throws_ok(
  $$select public.create_supplier('Fornecedor ponto duplo', null, null, 'contato..a@x.com')$$,
  '22023',
  'E-mail inválido.',
  'create_supplier recusa ponto duplicado na parte local'
);

select lives_ok(
  $$select public.create_supplier('Fornecedor sem email', null, null, null)$$,
  'create_supplier aceita e-mail nulo'
);

create temporary table t59_created (id uuid) on commit drop;
insert into t59_created (id)
select id from public.create_supplier('Fornecedor valido', null, null, 'contato@gmail.com');

select is(
  (select email from public.suppliers where id = (select id from t59_created)),
  'contato@gmail.com',
  'create_supplier aceita e-mail valido'
);

select throws_ok(
  format(
    $$select public.update_supplier('%s'::uuid, 'Fornecedor valido', null, null, 'jon@x.c')$$,
    (select id from t59_created)
  ),
  '22023',
  'E-mail inválido.',
  'update_supplier recusa e-mail com TLD de 1 letra'
);

reset role;

select throws_ok(
  format(
    $$insert into public.suppliers (tenant_id, name, email) values ('%s'::uuid, 'Fornecedor via tabela', 'jon@x.c')$$,
    (select tenant_id from t59_context)
  ),
  '23514',
  null,
  'suppliers recusa INSERT direto com e-mail mal formado (mesma regra do CHECK)'
);

select * from finish();
rollback;
