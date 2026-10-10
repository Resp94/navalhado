begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Spec 056, ticket 01: a guarda das rotas de Contatos do Site. O Worker do app repassa o JWT do usuario para
-- public.assert_proprietario() antes de ler ou marcar no D1 do site; a regra de quem e Proprietario fica no Postgres
-- (private.assert_saas_admin: role 'proprietario' e is_active). Gerente, inclusive com tenant_id nulo, Barbeiro, Proprietario
-- inativo e anonimo recebem 42501.

insert into auth.users(id, email)
values
  ('81000000-0000-0000-0000-0000000000a1', 't81-proprietario@test.local'),
  ('81000000-0000-0000-0000-0000000000a2', 't81-gerente@test.local'),
  ('81000000-0000-0000-0000-0000000000a3', 't81-barbeiro@test.local'),
  ('81000000-0000-0000-0000-0000000000a4', 't81-gerente-sem-tenant@test.local'),
  ('81000000-0000-0000-0000-0000000000a5', 't81-proprietario-inativo@test.local');
insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone)
values ('81000000-0000-0000-0000-000000000001', 'T81 Barbearia', 't81-01@test.local', '92999981001', 't81-01', true, 'America/Sao_Paulo');
update public.users set tenant_id = null, role = 'proprietario', is_active = true where id = '81000000-0000-0000-0000-0000000000a1';
update public.users set tenant_id = '81000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where id = '81000000-0000-0000-0000-0000000000a2';
update public.users set tenant_id = '81000000-0000-0000-0000-000000000001', role = 'barbeiro', is_active = true where id = '81000000-0000-0000-0000-0000000000a3';
update public.users set tenant_id = null, role = 'gerente', is_active = true where id = '81000000-0000-0000-0000-0000000000a4';
update public.users set tenant_id = null, role = 'proprietario', is_active = false where id = '81000000-0000-0000-0000-0000000000a5';

select has_function('public', 'assert_proprietario', array[]::text[], 'public.assert_proprietario() existe');
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'assert_proprietario'),
  true,
  'assert_proprietario e security definer'
);

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.assert_proprietario()$$, 'o Proprietario ativo passa');
reset role;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-0000000000a5', true);
set local role authenticated;
select throws_ok($$select public.assert_proprietario()$$, '42501', 'ADMIN_ONLY', 'o Proprietario inativo e recusado com ADMIN_ONLY');
reset role;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select throws_ok($$select public.assert_proprietario()$$, '42501', 'ADMIN_ONLY', 'o Gerente e recusado com ADMIN_ONLY');
reset role;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select throws_ok($$select public.assert_proprietario()$$, '42501', 'ADMIN_ONLY', 'o Gerente sem barbearia (tenant_id nulo) e recusado com ADMIN_ONLY');
reset role;

select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select throws_ok($$select public.assert_proprietario()$$, '42501', 'ADMIN_ONLY', 'o Barbeiro e recusado com ADMIN_ONLY');
reset role;

-- O anonimo nem chega na guarda: nao tem EXECUTE na funcao (permission denied, tambem 42501).
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_ok($$select public.assert_proprietario()$$, '42501', null, 'quem nao esta logado (anon) e recusado');
reset role;

select * from finish();
rollback;
