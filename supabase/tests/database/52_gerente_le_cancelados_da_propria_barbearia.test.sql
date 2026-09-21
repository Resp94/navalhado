-- Spec 043, ticket 05: o gerente le os Agendamentos cancelados de toda a propria barbearia e de
-- nenhuma outra.
--
-- A Agenda do gerente omite o profissional na consulta e confia no banco para o recorte; o filtro de
-- equipe da tela e conveniencia de leitura, nao fronteira de acesso. A politica de leitura nao
-- condiciona por status, e estes testes travam isso para cancelado.
--
-- O proprietario (admin do SaaS) alcanca qualquer barbearia por desenho. Esta bateria prova a
-- fronteira para gerente e barbeiro e documenta o proprietario como excecao explicita.

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create temporary table t52 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger_a uuid not null,
  u_ger_b uuid not null,
  u_ger_nulo uuid not null,
  u_prop uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  prof_b uuid not null,
  service_a uuid not null,
  service_b uuid not null,
  customer_a uuid not null,
  customer_b uuid not null,
  ap_canc_prof1 uuid not null,
  ap_canc_prof2 uuid not null,
  ap_canc_b uuid not null,
  ap_ativo_a uuid not null,
  t_1000 timestamptz not null,
  t_1100 timestamptz not null
) on commit drop;

insert into public.tenants (name, email, phone, timezone)
select n, n || '@teste.com', p, 'America/Sao_Paulo'
from (values ('__t52_a__', '11999999521'), ('__t52_b__', '11999999522')) as v(n, p);

insert into auth.users (id, email)
select gen_random_uuid(), '__t52_' || n || '__@teste.com'
from unnest(array['gera', 'gerb', 'gernulo', 'prop']) as n;

insert into t52
select
  (select id from public.tenants where name = '__t52_a__'),
  (select id from public.tenants where name = '__t52_b__'),
  (select id from auth.users where email = '__t52_gera__@teste.com'),
  (select id from auth.users where email = '__t52_gerb__@teste.com'),
  (select id from auth.users where email = '__t52_gernulo__@teste.com'),
  (select id from auth.users where email = '__t52_prop__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '11:00') at time zone 'America/Sao_Paulo');

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t52 t where u.id = t.u_ger_a;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t52 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t52 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t52 t where u.id = t.u_prop;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select v.id, v.tenant, v.nome, v.fone, 10, true
from t52 t,
  lateral (values
    (t.prof1, t.tenant_a, 'A Prof1 t52', '11988880521'),
    (t.prof2, t.tenant_a, 'B Prof2 t52', '11988880522'),
    (t.prof_b, t.tenant_b, 'Prof B t52', '11988880523')
  ) as v(id, tenant, nome, fone);

insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select v.id, v.tenant, v.nome, 50, 'fixed', 'corte', true, 30
from t52 t, lateral (values (t.service_a, t.tenant_a, 'Servico A t52'), (t.service_b, t.tenant_b, 'Servico B t52')) as v(id, tenant, nome);

insert into public.customers (id, tenant_id, name, phone, cadastro_completo)
select v.id, v.tenant, v.nome, v.fone, true
from t52 t, lateral (values (t.customer_a, t.tenant_a, 'Cliente A t52', '11977770521'), (t.customer_b, t.tenant_b, 'Cliente B t52', '11977770522')) as v(id, tenant, nome, fone);

insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, cancellation_reason)
select v.id, v.tenant, v.cust, v.prof, v.serv, v.inicio, v.inicio + interval '30 minutes', v.st, 'pending', v.motivo
from t52 t,
  lateral (values
    (t.ap_canc_prof1, t.tenant_a, t.customer_a, t.prof1, t.service_a, t.t_1000, 'canceled', 'Motivo do prof1'),
    (t.ap_canc_prof2, t.tenant_a, t.customer_a, t.prof2, t.service_a, t.t_1000, 'canceled', 'Motivo do prof2'),
    (t.ap_canc_b, t.tenant_b, t.customer_b, t.prof_b, t.service_b, t.t_1000, 'canceled', 'Motivo de outra barbearia'),
    (t.ap_ativo_a, t.tenant_a, t.customer_a, t.prof1, t.service_a, t.t_1100, 'confirmed', null)
  ) as v(id, tenant, cust, prof, serv, inicio, st, motivo);

grant select on t52 to authenticated;

-- ---------------------------------------------------------------------------
-- Gerente da barbearia A
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_ger_a::text from t52), true);
set local role authenticated;

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_canc_prof1 from t52)),
  1,
  'Gerente alcanca o cancelado do profissional 1 da propria barbearia'
);

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_canc_prof2 from t52)),
  1,
  'Gerente alcanca o cancelado do profissional 2, de outro profissional da mesma barbearia'
);

select is(
  (select count(*)::int from public.appointments a
   where a.status = 'canceled' and a.tenant_id = (select tenant_a from t52)),
  2,
  'Sem restringir por profissional, o gerente alcanca os cancelados de todos os profissionais da barbearia'
);

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_canc_b from t52)),
  0,
  'Gerente nao alcanca cancelado de outra barbearia'
);

-- ---------------------------------------------------------------------------
-- Gerente da barbearia B: a fronteira vale nos dois sentidos
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t52), true);
set local role authenticated;

select is(
  (select count(*)::int from public.appointments a
   where a.id in (select ap_canc_prof1 from t52 union select ap_canc_prof2 from t52 union select ap_canc_b from t52)),
  1,
  'Gerente da outra barbearia alcanca so o proprio cancelado e nenhum da barbearia A'
);

-- ---------------------------------------------------------------------------
-- Gerente sem barbearia vinculada
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t52), true);
set local role authenticated;

select is(
  (select count(*)::int from public.appointments a
   where a.id in (select ap_canc_prof1 from t52 union select ap_canc_prof2 from t52 union select ap_canc_b from t52)),
  0,
  'Gerente com barbearia nula nao alcanca nenhum cancelado'
);

-- ---------------------------------------------------------------------------
-- Excecao por desenho: o proprietario e o admin do SaaS e alcanca qualquer barbearia
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_prop::text from t52), true);
set local role authenticated;

select is(
  (select count(*)::int from public.appointments a
   where a.id in (select ap_canc_prof1 from t52 union select ap_canc_prof2 from t52 union select ap_canc_b from t52)),
  3,
  'Excecao por desenho: o proprietario (admin do SaaS) alcanca cancelado de qualquer barbearia'
);

-- ---------------------------------------------------------------------------
-- Controle: a leitura de Agendamento ativo funciona para o gerente, entao os zeros nao sao vacuos
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_a::text from t52), true);
set local role authenticated;

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_ativo_a from t52)),
  1,
  'Controle: o gerente alcanca o Agendamento ativo da propria barbearia, a leitura em si funciona'
);

reset role;

select * from finish();
rollback;
