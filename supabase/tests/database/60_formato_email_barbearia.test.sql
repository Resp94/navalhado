begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Spec 047, ticket 03: formato rigido no e-mail da barbearia.
--
-- tenants_email_format_check e o trigger handle_new_user (caminho
-- tenant_signup do cadastro de barbearia) passam a usar public.email_valido
-- (ticket 01) no lugar da regex antiga. Nenhum teste pgTAP cobria o caminho
-- tenant_signup do trigger ate agora.

insert into public.tenants (name, email, phone)
values ('__t60_tenant__', '__t60_tenant__@teste.com', '11999999560');

select throws_ok(
  $$update public.tenants set email = 'jon@x.c' where name = '__t60_tenant__'$$,
  '23514',
  null,
  'tenants recusa UPDATE com e-mail mal formado'
);

select throws_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values (
      gen_random_uuid(),
      '__t60_gestor_invalido__auth@teste.com',
      jsonb_build_object(
        'name', 'Gestor Teste',
        'tenant_signup', jsonb_build_object(
          'name', 'Barbearia T60 Invalida',
          'email', 'jon@x.c',
          'phone', '11988887777',
          'plan', 'prata'
        )
      )
    )$$,
  '22023',
  'INVALID_TENANT_EMAIL',
  'cadastro de barbearia com e-mail mal formado e recusado pelo trigger'
);

select is(
  (select count(*)::integer from public.tenants where name = 'Barbearia T60 Invalida'),
  0,
  'nenhum tenant e criado quando o e-mail da barbearia e recusado'
);

create temporary table t60_created (id uuid) on commit drop;
insert into t60_created (id)
select gen_random_uuid();

insert into auth.users (id, email, raw_user_meta_data)
values (
  (select id from t60_created),
  '__t60_gestor_valido__auth@teste.com',
  jsonb_build_object(
    'name', 'Gestor Teste',
    'tenant_signup', jsonb_build_object(
      'name', 'Barbearia T60 Valida',
      'email', 'contato@barbeariat60.com',
      'phone', '11988887777',
      'plan', 'prata'
    )
  )
);

select is(
  (select email from public.tenants where name = 'Barbearia T60 Valida'),
  'contato@barbeariat60.com',
  'cadastro de barbearia com e-mail valido cria o tenant normalmente'
);

select * from finish();
rollback;
