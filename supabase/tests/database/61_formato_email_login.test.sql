begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Spec 047, ticket 04: formato rigido de e-mail nos logins (gerente e
-- barbeiro).
--
-- users_email_format_check usa a funcao unica public.email_valido
-- (ticket 01). O caminho de barbeiro do trigger handle_new_user (sem
-- tenant_signup) nunca validou o e-mail antes; agora o CHECK barra e-mail
-- mal formado, e o INSERT em auth.users que disparou o trigger tambem
-- desfaz, porque tudo roda na mesma transacao implicita do trigger.

create temporary table t61_context (tenant_id uuid not null, gerente_id uuid not null) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__t61_tenant__', '__t61_tenant__@teste.com', '11999999561')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__t61_gerente__auth@teste.com')
  returning id
)
insert into t61_context (tenant_id, gerente_id)
select t.id, au.id from t, au;

update public.users
set tenant_id = (select tenant_id from t61_context), role = 'gerente', is_active = true
where id = (select gerente_id from t61_context);

select throws_ok(
  format(
    $$update public.users set email = 'jon@x.c' where id = '%s'::uuid$$,
    (select gerente_id from t61_context)
  ),
  '23514',
  null,
  'users recusa UPDATE com e-mail de login mal formado'
);

select throws_ok(
  $$insert into public.users (id, email, name, role) values (gen_random_uuid(), 'jon@x.c', 'Teste', 'barbeiro')$$,
  '23514',
  null,
  'users recusa INSERT direto com e-mail mal formado'
);

do $$
declare
  v_id uuid := gen_random_uuid();
begin
  begin
    insert into auth.users (id, email) values (v_id, 'jon@x.c');
  exception when sqlstate '23514' then
    null;
  end;
end;
$$;

select is(
  (select count(*)::integer from auth.users where email = 'jon@x.c'),
  0,
  'cadastro de barbeiro (sem tenant_signup) com e-mail mal formado nao deixa auth.users nem public.users pela metade'
);
select is(
  (select count(*)::integer from public.users where email = 'jon@x.c'),
  0,
  'nenhuma linha de public.users fica orfa apos a recusa'
);

create temporary table t61_barbeiro (id uuid) on commit drop;
insert into t61_barbeiro (id) select gen_random_uuid();
insert into auth.users (id, email) values ((select id from t61_barbeiro), '__t61_barbeiro_valido__auth@teste.com');

select is(
  (select email from public.users where id = (select id from t61_barbeiro)),
  '__t61_barbeiro_valido__auth@teste.com',
  'cadastro de barbeiro com e-mail valido continua funcionando normalmente'
);

select * from finish();
rollback;
