-- Spec 043, ticket 01: observacao da Lista de Espera.
--
-- A coluna nunca existiu e o adaptador descartava o texto em silencio. Estes
-- testes travam o contrato de persistencia: a coluna existe, o texto vai e volta
-- inteiro, ausencia vira nulo e nao texto vazio, e a entrada continua isolada por
-- barbearia agora que ela carrega texto livre.

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create temporary table t50 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger_a uuid not null,
  u_ger_b uuid not null,
  u_ger_nulo uuid not null,
  nota_longa text not null
) on commit drop;

insert into public.tenants (name, email, phone, timezone)
values
  ('__t50_a__', '__t50_a__@teste.com', '11999999501', 'America/Sao_Paulo'),
  ('__t50_b__', '__t50_b__@teste.com', '11999999502', 'America/Sao_Paulo');

insert into auth.users (id, email) values
  (gen_random_uuid(), '__t50_ger_a__@teste.com'),
  (gen_random_uuid(), '__t50_ger_b__@teste.com'),
  (gen_random_uuid(), '__t50_ger_nulo__@teste.com');

insert into t50
select
  (select id from public.tenants where name = '__t50_a__'),
  (select id from public.tenants where name = '__t50_b__'),
  (select id from auth.users where email = '__t50_ger_a__@teste.com'),
  (select id from auth.users where email = '__t50_ger_b__@teste.com'),
  (select id from auth.users where email = '__t50_ger_nulo__@teste.com'),
  'So pode depois das 18h, quer o Marcos e aceita esperar. ' || repeat('detalhe ', 250);

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t50 t where u.id = t.u_ger_a;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t50 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t50 t where u.id = t.u_ger_nulo;

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select has_column('public', 'waiting_list', 'notes', 'A Lista de Espera tem coluna de observacao');
select col_type_is('public', 'waiting_list', 'notes', 'text', 'A observacao e texto livre, sem limite de tamanho declarado');

-- ---------------------------------------------------------------------------
-- Ida e volta do texto
-- ---------------------------------------------------------------------------

insert into public.waiting_list (tenant_id, name, phone, status, notes)
select tenant_a, '__t50_com_nota__', '11988887771', 'waiting', nota_longa from t50;

insert into public.waiting_list (tenant_id, name, phone, status)
select tenant_a, '__t50_sem_nota__', '11988887772', 'waiting' from t50;

insert into public.waiting_list (tenant_id, name, phone, status, notes)
select tenant_b, '__t50_outra_barbearia__', '11988887773', 'waiting', 'Observacao da barbearia B' from t50;

select is(
  (select w.notes from public.waiting_list w where w.name = '__t50_com_nota__'),
  (select t.nota_longa from t50 t),
  'A observacao volta identica ao que foi gravado, sem truncamento'
);

select is(
  (select w.notes from public.waiting_list w where w.name = '__t50_sem_nota__'),
  null,
  'Entrada gravada sem observacao devolve nulo, nao texto vazio'
);

-- ---------------------------------------------------------------------------
-- Isolamento por barbearia
-- ---------------------------------------------------------------------------

grant select on t50 to authenticated;

select set_config('request.jwt.claim.sub', (select u_ger_a::text from t50), true);
set local role authenticated;

select is(
  (select count(*)::int from public.waiting_list w where w.name = '__t50_com_nota__' and w.notes is not null),
  1,
  'Gerente alcanca a observacao da propria barbearia'
);

select is(
  (select count(*)::int from public.waiting_list w where w.name = '__t50_outra_barbearia__'),
  0,
  'Gerente nao alcanca entrada de outra barbearia, nem a observacao dela'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t50), true);
set local role authenticated;

select is(
  (select count(*)::int from public.waiting_list w where w.phone in ('11988887771', '11988887772', '11988887773')),
  0,
  'Gerente com barbearia nula nao alcanca entrada nenhuma'
);

reset role;

select * from finish();
rollback;
