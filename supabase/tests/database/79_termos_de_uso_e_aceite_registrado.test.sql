begin;
create extension if not exists pgtap with schema extensions;
select plan(74);

-- Spec 052, ticket 16: Termos de Uso e aceite registrado. O aceite e gravado por usuario, com a versao dos termos (a data de
-- publicacao do texto, AAAA-MM-DD) e a data do relogio do banco. O navegador so le a propria linha (RLS) e grava pela funcao
-- accept_terms, que age sobre quem chama (auth.uid(), ativo) e e idempotente: aceitar a mesma versao de novo nao muda a data do
-- primeiro aceite. A versao e uma data que existe e que nao e posterior a hoje (nao se aceita de antemao um texto que ainda nao foi
-- publicado). O cadastro (trigger handle_new_user) grava o aceite da versao que o formulario mandou em raw_user_meta_data.terms_version;
-- versao ausente, mal formada, impossivel ou futura nao derruba a criacao da conta (o Gerente aceita na primeira entrada, pela tela
-- de aceite). Quem fecha o painel para o Gerente sem aceite da versao atual e o front: o banco so guarda o aceite.
-- (Revisao do ticket: a regra da versao mora em public.terms_version_valida e private.terms_version_aceitavel, e o desativado nao aceita.)

insert into public.tenants(id, name, email, phone, slug, onboarding_completed, timezone)
values ('79000000-0000-0000-0000-000000000001', 'T79 Barbearia', 't79@test.local', '92999979001', 't79-01', true, 'America/Sao_Paulo');

insert into auth.users(id, email)
values
  ('79000000-0000-0000-0000-0000000000a1', 't79-gerente-a@test.local'),
  ('79000000-0000-0000-0000-0000000000a2', 't79-gerente-b@test.local'),
  ('79000000-0000-0000-0000-0000000000a3', 't79-barbeiro@test.local'),
  ('79000000-0000-0000-0000-0000000000a4', 't79-gerente-sem-tenant@test.local'),
  ('79000000-0000-0000-0000-0000000000a5', 't79-proprietario@test.local'),
  ('79000000-0000-0000-0000-0000000000a7', 't79-gerente-desativado@test.local');
-- Usuario anonimo (login anonimo do Supabase): o trigger nao cria a linha dele em public.users.
insert into auth.users(id, email, is_anonymous)
values ('79000000-0000-0000-0000-0000000000a6', null, true);

update public.users set tenant_id = '79000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where id = '79000000-0000-0000-0000-0000000000a1';
update public.users set tenant_id = '79000000-0000-0000-0000-000000000001', role = 'gerente', is_active = true where id = '79000000-0000-0000-0000-0000000000a2';
update public.users set tenant_id = '79000000-0000-0000-0000-000000000001', role = 'barbeiro', is_active = true where id = '79000000-0000-0000-0000-0000000000a3';
-- Gerente mal cadastrado, sem barbearia vinculada: o aceite e de quem chama, nao depende de tenant.
update public.users set tenant_id = null, role = 'gerente', is_active = true where id = '79000000-0000-0000-0000-0000000000a4';
update public.users set tenant_id = null, role = 'proprietario', is_active = true where id = '79000000-0000-0000-0000-0000000000a5';
-- Gerente desativado: a linha existe, mas o banco o trata como sem papel (private.get_auth_role()).
update public.users set tenant_id = '79000000-0000-0000-0000-000000000001', role = 'gerente', is_active = false where id = '79000000-0000-0000-0000-0000000000a7';

-- Executa um comando com o papel de quem chama e devolve "ok:<linhas>" ou o SQLSTATE do erro, sem abortar a transacao.
create function pg_temp.tenta(p_sql text) returns text language plpgsql as $$
declare
  v_linhas bigint;
begin
  execute p_sql;
  get diagnostics v_linhas = row_count;
  return 'ok:' || v_linhas;
exception when others then
  return sqlstate;
end;
$$;

-- Executa um SELECT de uma coluna e devolve o valor como texto, ou "ERRO <sqlstate>" se falhar.
create function pg_temp.valor(p_sql text) returns text language plpgsql as $$
declare
  v_valor text;
begin
  execute p_sql into v_valor;
  return v_valor;
exception when others then
  return 'ERRO ' || sqlstate;
end;
$$;

-- A. A tabela e a funcao ----------------------------------------------------------------------------------------------------------
select has_table('public', 'terms_acceptances', 'a tabela de aceites existe');
select columns_are('public', 'terms_acceptances', array['id', 'user_id', 'version', 'accepted_at'], 'a tabela guarda o usuario, a versao dos termos e a data do aceite, e mais nada');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'terms_acceptances' and is_nullable = 'NO'), 4, 'todas as colunas sao obrigatorias');
select col_has_default('public', 'terms_acceptances', 'accepted_at', 'a data do aceite vem do relogio do banco');
select is((select c.relrowsecurity from pg_class c where c.oid = 'public.terms_acceptances'::regclass), true, 'a RLS esta ligada');
select policies_are('public', 'terms_acceptances', array['terms_acceptances_select_policy'], 'a tabela so tem a politica de leitura: nenhuma politica deixa o navegador escrever');
select is(
  (select coalesce(array_agg(p order by p), '{}'::text[]) from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege('authenticated', 'public.terms_acceptances', p)),
  array['select'],
  'o navegador logado so tem o privilegio de ler a tabela'
);
select is(
  (select count(*)::int from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) p where has_table_privilege('anon', 'public.terms_acceptances', p)),
  0,
  'quem nao esta logado nao tem privilegio nenhum na tabela'
);
select has_function('public', 'accept_terms', array['text'], 'a funcao accept_terms existe');
select is_definer('public', 'accept_terms', array['text'], 'accept_terms roda com os privilegios do dono (ela grava e o navegador nao)');
select is((select p.proconfig from pg_proc p where p.oid = 'public.accept_terms(text)'::regprocedure), array['search_path=""'], 'e com o search_path vazio');
select is(has_function_privilege('anon', 'public.accept_terms(text)', 'execute') or has_function_privilege('public', 'public.accept_terms(text)', 'execute'), false, 'quem nao esta logado nao executa accept_terms');
select is(has_function_privilege('authenticated', 'public.accept_terms(text)', 'execute'), true, 'o usuario logado executa accept_terms');

-- A regra da versao: uma data que existe (public.terms_version_valida, imutavel, usada pelo CHECK) e que nao e posterior a hoje no
-- fuso de Sao Paulo (private.terms_version_aceitavel, usada por quem escreve o aceite).
select has_function('public', 'terms_version_valida', array['text'], 'a regra do formato da versao existe');
select is((select p.provolatile from pg_proc p where p.oid = 'public.terms_version_valida(text)'::regprocedure), 'i', 'a regra do formato e imutavel (o CHECK da tabela a usa)');
select is(
  (select coalesce(array_agg(v order by v), '{}'::text[]) from unnest(array['2026-10-02', '2024-02-29', '0001-01-01', '9999-12-31']) v where public.terms_version_valida(v)),
  array['0001-01-01', '2024-02-29', '2026-10-02', '9999-12-31'],
  'a regra do formato aceita data que existe, inclusive 29 de fevereiro de ano bissexto'
);
select is(
  (select count(*)::int from unnest(array['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '0000-01-01', 'lixo', '2026-10-2', ' 2026-10-02', E'2026-10-02\n', '']) v where public.terms_version_valida(v)),
  0,
  'e recusa data que nao existe, mes 13, mes e dia zero, ano zero, texto e formato torto'
);
select is(public.terms_version_valida(null), false, 'a versao nula nao e valida');
select is(
  (select array_agg(private.terms_version_aceitavel(t.v) order by t.ord)
   from (values
     (1, to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')),
     (2, to_char((now() at time zone 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD')),
     (3, '2000-01-01'),
     (4, '2999-12-31'),
     (5, '2026-02-30'),
     (6, null)) t(ord, v)),
  array[true, false, true, false, false, false],
  'a versao aceitavel e a de hoje ou anterior: a de amanha, a futura, a impossivel e a nula nao'
);
select is(
  has_function_privilege('anon', 'public.terms_version_valida(text)', 'execute') or has_function_privilege('authenticated', 'public.terms_version_valida(text)', 'execute')
    or has_function_privilege('anon', 'private.terms_version_aceitavel(text)', 'execute') or has_function_privilege('authenticated', 'private.terms_version_aceitavel(text)', 'execute'),
  false,
  'as duas funcoes da regra nao ficam abertas ao navegador'
);

-- B. Aceitar --------------------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.accept_terms('2026-10-02')$$, 'o Gerente aceita a versao dos termos');
reset role;
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a1' and version = '2026-10-02'), 1, 'o aceite fica gravado para o usuario, com a versao');
select ok((select abs(extract(epoch from now() - accepted_at)) < 5 from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a1'), 'e com a data do relogio do banco');

-- Aceitar de novo a mesma versao nao cria outra linha nem muda a data do primeiro aceite.
update public.terms_acceptances set accepted_at = timestamptz '2026-01-01 12:00:00+00' where user_id = '79000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is(
  pg_temp.valor($$select extract(epoch from public.accept_terms('2026-10-02'))::bigint::text$$),
  extract(epoch from timestamptz '2026-01-01 12:00:00+00')::bigint::text,
  'aceitar a mesma versao de novo devolve a data do primeiro aceite'
);
reset role;
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a1'), 1, 'e nao cria uma segunda linha');
select is((select accepted_at from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a1'), timestamptz '2026-01-01 12:00:00+00', 'nem muda a data do primeiro aceite');

-- Versao nova e outro aceite; a antiga fica.
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select lives_ok($$select public.accept_terms('2026-09-15')$$, 'uma versao nova dos termos e outro aceite');
reset role;
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a1'), 2, 'a versao antiga continua gravada ao lado da nova');

-- Versao fora do formato AAAA-MM-DD.
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select throws_ok($$select public.accept_terms('')$$, '22023', 'INVALID_VERSION', 'versao vazia e recusada');
select throws_ok($$select public.accept_terms(null)$$, '22023', 'INVALID_VERSION', 'versao nula e recusada');
select throws_ok($$select public.accept_terms('v1')$$, '22023', 'INVALID_VERSION', 'versao que nao e uma data e recusada');
select throws_ok($$select public.accept_terms('2026-10-2')$$, '22023', 'INVALID_VERSION', 'data sem o zero do dia e recusada');
select throws_ok($$select public.accept_terms(' 2026-10-02')$$, '22023', 'INVALID_VERSION', 'versao com espaco na frente e recusada');
select throws_ok($$select public.accept_terms(E'2026-10-02\n')$$, '22023', 'INVALID_VERSION', 'versao com quebra de linha atras e recusada');
select throws_ok($$select public.accept_terms('2026-02-30')$$, '22023', 'INVALID_VERSION', 'data que nao existe e recusada');
select throws_ok($$select public.accept_terms('0000-00-00')$$, '22023', 'INVALID_VERSION', 'data zerada e recusada');
select throws_ok(
  format('select public.accept_terms(%L)', to_char((now() at time zone 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD')),
  '22023', 'INVALID_VERSION', 'a versao de amanha e recusada: nao se aceita de antemao um texto que ainda nao foi publicado'
);
select throws_ok($$select public.accept_terms('2999-12-31')$$, '22023', 'INVALID_VERSION', 'a versao futura e recusada');
reset role;
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a1'), 2, 'as recusas nao gravaram nada');

-- Cada um aceita por si: o outro Gerente da mesma barbearia, o Barbeiro e o Gerente sem barbearia.
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select lives_ok($$select public.accept_terms('2026-10-02')$$, 'o outro Gerente da barbearia aceita por si');
reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select lives_ok($$select public.accept_terms('2026-10-02')$$, 'o Barbeiro aceita por si');
reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select lives_ok($$select public.accept_terms('2026-10-02')$$, 'o Gerente sem barbearia (tenant_id nulo) aceita por si: o aceite nao depende de tenant');
reset role;

-- Quem nao tem linha ativa em public.users (anonimo, desativado) ou nao esta logado nao aceita.
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a6', true);
set local role authenticated;
select throws_ok($$select public.accept_terms('2026-10-02')$$, '42501', 'FORBIDDEN', 'o usuario anonimo (sem linha em public.users) e recusado');
reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a7', true);
set local role authenticated;
select throws_ok($$select public.accept_terms('2026-10-02')$$, '42501', 'FORBIDDEN', 'o Gerente desativado (is_active = false) e recusado, como em toda escrita');
reset role;
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a7'), 0, 'e nao gravou aceite para o desativado');
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
select throws_ok($$select public.accept_terms('2026-10-02')$$, '42501', 'FORBIDDEN', 'a chamada sem usuario na sessao e recusada');
reset role;
set local role anon;
select throws_ok($$select public.accept_terms('2026-10-02')$$, '42501', null, 'quem nao esta logado (anon) e recusado');
reset role;
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000a6'), 0, 'as recusas nao gravaram aceite para o anonimo');

-- C. Ler: so a propria linha ------------------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is((select count(*)::int || '/' || (count(*) filter (where user_id <> '79000000-0000-0000-0000-0000000000a1'))::int from public.terms_acceptances), '2/0', 'o Gerente le so os proprios aceites');
reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a2', true);
set local role authenticated;
select is((select count(*)::int || '/' || (count(*) filter (where user_id <> '79000000-0000-0000-0000-0000000000a2'))::int from public.terms_acceptances), '1/0', 'o outro Gerente da mesma barbearia nao le os aceites do primeiro');
reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a3', true);
set local role authenticated;
select is((select count(*)::int || '/' || (count(*) filter (where user_id <> '79000000-0000-0000-0000-0000000000a3'))::int from public.terms_acceptances), '1/0', 'o Barbeiro le so o proprio aceite');
reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a4', true);
set local role authenticated;
select is((select count(*)::int || '/' || (count(*) filter (where user_id <> '79000000-0000-0000-0000-0000000000a4'))::int from public.terms_acceptances), '1/0', 'o Gerente sem barbearia (tenant_id nulo) le so o proprio aceite');
reset role;
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a5', true);
set local role authenticated;
select is((select count(*)::int from public.terms_acceptances), 0, 'o Proprietario, que nao aceitou nada, nao le os aceites dos outros');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.terms_acceptances$$, '42501', null, 'quem nao esta logado nao le a tabela');
reset role;

-- O navegador nao grava na tabela: so a funcao grava.
select set_config('request.jwt.claim.sub', '79000000-0000-0000-0000-0000000000a1', true);
set local role authenticated;
select is(pg_temp.tenta($$insert into public.terms_acceptances(user_id, version) values ('79000000-0000-0000-0000-0000000000a1', '2026-12-01')$$), '42501', 'o navegador nao grava o aceite direto na tabela');
select is(pg_temp.tenta($$insert into public.terms_acceptances(user_id, version) values ('79000000-0000-0000-0000-0000000000a2', '2026-12-01')$$), '42501', 'nem o aceite em nome de outro usuario');
select is(pg_temp.tenta($$update public.terms_acceptances set accepted_at = now()$$), '42501', 'nem muda a data de um aceite');
select is(pg_temp.tenta($$delete from public.terms_acceptances$$), '42501', 'nem apaga um aceite');
reset role;
select is((select count(*)::int from public.terms_acceptances where user_id in ('79000000-0000-0000-0000-0000000000a1', '79000000-0000-0000-0000-0000000000a2')), 3, 'as tentativas nao mudaram nenhuma linha');

-- D. Cadastro: o aceite da tela de cadastro --------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values (
  '79000000-0000-0000-0000-0000000000b1',
  't79-cadastro@test.local',
  jsonb_build_object(
    'name', 'Gestor T79',
    'terms_version', '2026-10-02',
    'tenant_signup', jsonb_build_object(
      'name', 'Barbearia T79 Cadastro',
      'email', 'contato-b1@barbeariat79.com',
      'phone', '11988887777',
      'plan_id', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'
    )
  )
);
select is((select version from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000b1'), '2026-10-02', 'o cadastro grava o aceite da versao que o formulario mandou');
select ok((select abs(extract(epoch from now() - accepted_at)) < 5 from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000b1'), 'com a data do relogio do banco');
select is(
  (select s.status from public.tenant_subscriptions s join public.tenants t on t.id = s.tenant_id where t.name = 'Barbearia T79 Cadastro'),
  'trialing',
  'e a barbearia nasce em teste, como antes'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '79000000-0000-0000-0000-0000000000b2',
  't79-sem-aceite@test.local',
  jsonb_build_object(
    'name', 'Gestor T79 Sem Aceite',
    'tenant_signup', jsonb_build_object(
      'name', 'Barbearia T79 Sem Aceite',
      'email', 'contato-b2@barbeariat79.com',
      'phone', '11988887777',
      'plan_id', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'
    )
  )
);
select is(
  (select u.role || '/' || (select count(*)::int from public.terms_acceptances a where a.user_id = u.id) from public.users u where u.id = '79000000-0000-0000-0000-0000000000b2'),
  'gerente/0',
  'o cadastro sem a versao cria a conta e nao grava aceite: o Gerente aceita na primeira entrada'
);

-- Versao que nao e aceitavel no cadastro (texto qualquer, vazio, numero, objeto, data impossivel, data futura) nao derruba a criacao
-- da conta e nao grava aceite.
select lives_ok(
  $$insert into auth.users (id, email, raw_user_meta_data)
    values
      ('79000000-0000-0000-0000-0000000000b3', 't79-lixo1@test.local', jsonb_build_object(
        'name', 'Gestor T79 Lixo 1', 'terms_version', 'lixo',
        'tenant_signup', jsonb_build_object('name', 'Barbearia T79 Lixo 1', 'email', 'contato-b3@barbeariat79.com', 'phone', '11988887777', 'plan_id', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'))),
      ('79000000-0000-0000-0000-0000000000b4', 't79-lixo2@test.local', jsonb_build_object(
        'name', 'Gestor T79 Lixo 2', 'terms_version', 5,
        'tenant_signup', jsonb_build_object('name', 'Barbearia T79 Lixo 2', 'email', 'contato-b4@barbeariat79.com', 'phone', '11988887777', 'plan_id', 'b3fa7384-d113-4a1b-a5ed-1efeb7e51c22'))),
      ('79000000-0000-0000-0000-0000000000b5', 't79-lixo3@test.local', jsonb_build_object('terms_version', '')),
      ('79000000-0000-0000-0000-0000000000b6', 't79-lixo4@test.local', jsonb_build_object('terms_version', jsonb_build_object('v', '2026-10-02'))),
      ('79000000-0000-0000-0000-0000000000b9', 't79-lixo5@test.local', jsonb_build_object('name', 'Barbeiro T79 Impossivel', 'terms_version', '2026-02-30')),
      ('79000000-0000-0000-0000-0000000000ba', 't79-lixo6@test.local', jsonb_build_object('name', 'Barbeiro T79 Futura', 'terms_version', '2999-12-31'))$$,
  'versao que nao e aceitavel no cadastro nao derruba a criacao da conta'
);
select is((select count(*)::int from public.users where id in ('79000000-0000-0000-0000-0000000000b3', '79000000-0000-0000-0000-0000000000b4', '79000000-0000-0000-0000-0000000000b5', '79000000-0000-0000-0000-0000000000b6', '79000000-0000-0000-0000-0000000000b9', '79000000-0000-0000-0000-0000000000ba')), 6, 'as seis contas foram criadas');
select is((select count(*)::int from public.terms_acceptances where user_id in ('79000000-0000-0000-0000-0000000000b3', '79000000-0000-0000-0000-0000000000b4', '79000000-0000-0000-0000-0000000000b5', '79000000-0000-0000-0000-0000000000b6', '79000000-0000-0000-0000-0000000000b9', '79000000-0000-0000-0000-0000000000ba')), 0, 'e nenhuma gravou aceite');

-- O aceite que veio no cadastro vale para qualquer usuario criado com a versao, nao so para o Gerente.
insert into auth.users (id, email, raw_user_meta_data)
values ('79000000-0000-0000-0000-0000000000b7', 't79-barbeiro-novo@test.local', jsonb_build_object('name', 'Barbeiro T79', 'terms_version', '2026-10-02'));
select is((select version from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000b7'), '2026-10-02', 'o aceite do cadastro vale tambem para o usuario criado sem barbearia');

-- Usuario anonimo com a versao: o trigger o ignora antes de tocar em qualquer tabela.
select lives_ok(
  $$insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
    values ('79000000-0000-0000-0000-0000000000b8', null, true, jsonb_build_object('terms_version', '2026-10-02'))$$,
  'o login anonimo com a versao no metadado nao quebra'
);
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000b8'), 0, 'e nao grava aceite para o anonimo');

-- Apagar o usuario apaga os aceites dele.
delete from auth.users where id = '79000000-0000-0000-0000-0000000000b1';
select is((select count(*)::int from public.terms_acceptances where user_id = '79000000-0000-0000-0000-0000000000b1'), 0, 'apagar o usuario apaga os aceites dele');

-- E. As regras da tabela, valendo para quem escreve com privilegio -----------------------------------------------------------
select throws_ok($$insert into public.terms_acceptances(user_id, version) values ('79000000-0000-0000-0000-0000000000a1', 'lixo')$$, '23514', null, 'a tabela recusa versao fora do formato AAAA-MM-DD');
select throws_ok($$insert into public.terms_acceptances(user_id, version) values ('79000000-0000-0000-0000-0000000000a1', '2026-02-30')$$, '23514', null, 'a tabela recusa data que nao existe');
select throws_ok($$insert into public.terms_acceptances(user_id, version) values ('79000000-0000-0000-0000-0000000000a1', '2026-09-15')$$, '23505', null, 'a tabela recusa o mesmo aceite duas vezes');
select throws_ok($$insert into public.terms_acceptances(user_id, version) values ('79000000-0000-0000-0000-0000000000ff', '2026-10-02')$$, '23503', null, 'a tabela recusa aceite de usuario que nao existe');

select * from finish();
rollback;
