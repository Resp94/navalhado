-- Spec 043, ticket 04: o barbeiro le os Agendamentos cancelados so do proprio profissional.
--
-- O Painel de Cancelados do Dia omite o profissional na consulta e confia no banco para o recorte.
-- Esta garantia nao e demonstravel na costura em memoria, que nao reproduz a politica de leitura;
-- ela vive aqui. A politica nao condiciona por status, e estes testes travam isso contra regressao.

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create temporary table t51 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_barb uuid not null,
  u_barb_nulo uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  prof_b uuid not null,
  service_a uuid not null,
  service_b uuid not null,
  customer_a uuid not null,
  customer_b uuid not null,
  ap_canc_proprio uuid not null,
  ap_canc_colega uuid not null,
  ap_canc_outra uuid not null,
  ap_ativo_proprio uuid not null,
  t_1000 timestamptz not null,
  t_1100 timestamptz not null,
  t_1400 timestamptz not null
) on commit drop;

insert into public.tenants (name, email, phone, timezone)
select n, n || '@teste.com', p, 'America/Sao_Paulo'
from (values ('__t51_a__', '11999999511'), ('__t51_b__', '11999999512')) as v(n, p);

insert into auth.users (id, email)
select gen_random_uuid(), '__t51_' || n || '__@teste.com'
from unnest(array['barb', 'barbnulo']) as n;

insert into t51
select
  (select id from public.tenants where name = '__t51_a__'),
  (select id from public.tenants where name = '__t51_b__'),
  (select id from auth.users where email = '__t51_barb__@teste.com'),
  (select id from auth.users where email = '__t51_barbnulo__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '11:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '14:00') at time zone 'America/Sao_Paulo');

update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t51 t where u.id = t.u_barb;
update public.users u set tenant_id = null, role = 'barbeiro', is_active = true from t51 t where u.id = t.u_barb_nulo;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select v.id, v.tenant, v.nome, v.fone, 10, true, v.usr
from t51 t,
  lateral (values
    (t.prof1, t.tenant_a, 'A Prof1 t51', '11988880511', t.u_barb),
    (t.prof2, t.tenant_a, 'B Prof2 t51', '11988880512', null::uuid),
    (t.prof_b, t.tenant_b, 'Prof B t51', '11988880513', null::uuid)
  ) as v(id, tenant, nome, fone, usr);

insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select v.id, v.tenant, v.nome, 50, 'fixed', 'corte', true, 30
from t51 t, lateral (values (t.service_a, t.tenant_a, 'Servico A t51'), (t.service_b, t.tenant_b, 'Servico B t51')) as v(id, tenant, nome);

insert into public.customers (id, tenant_id, name, phone, cadastro_completo)
select v.id, v.tenant, v.nome, v.fone, true
from t51 t, lateral (values (t.customer_a, t.tenant_a, 'Cliente A t51', '11977770511'), (t.customer_b, t.tenant_b, 'Cliente B t51', '11977770512')) as v(id, tenant, nome, fone);

insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, cancellation_reason)
select v.id, v.tenant, v.cust, v.prof, v.serv, v.inicio, v.inicio + interval '30 minutes', v.st, 'pending', v.motivo
from t51 t,
  lateral (values
    (t.ap_canc_proprio, t.tenant_a, t.customer_a, t.prof1, t.service_a, t.t_1000, 'canceled', 'Motivo do proprio'),
    (t.ap_canc_colega, t.tenant_a, t.customer_a, t.prof2, t.service_a, t.t_1000, 'canceled', 'Motivo do colega'),
    (t.ap_canc_outra, t.tenant_b, t.customer_b, t.prof_b, t.service_b, t.t_1000, 'canceled', 'Motivo de outra barbearia'),
    (t.ap_ativo_proprio, t.tenant_a, t.customer_a, t.prof1, t.service_a, t.t_1100, 'confirmed', null)
  ) as v(id, tenant, cust, prof, serv, inicio, st, motivo);

grant select on t51 to authenticated;

-- ---------------------------------------------------------------------------
-- Barbeiro vinculado ao profissional 1 da barbearia A
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_barb::text from t51), true);
set local role authenticated;

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_canc_proprio from t51)),
  1,
  'Barbeiro alcanca o Agendamento cancelado do proprio profissional'
);

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_canc_colega from t51)),
  0,
  'Barbeiro nao alcanca o cancelado de um colega da mesma barbearia'
);

select is(
  (select count(*)::int from public.appointments a
   where a.status = 'canceled' and a.tenant_id = (select tenant_a from t51)),
  1,
  'Sem restringir por profissional, o barbeiro continua alcancando apenas o proprio cancelado'
);

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_canc_outra from t51)),
  0,
  'Barbeiro nao alcanca cancelado de outra barbearia'
);

select is(
  (select count(*)::int from public.appointments a where a.id = (select ap_ativo_proprio from t51)),
  1,
  'Controle: o barbeiro alcanca o proprio Agendamento ativo, a leitura em si funciona'
);

select is(
  (select a.cancellation_reason from public.appointments a where a.id = (select ap_canc_proprio from t51)),
  'Motivo do proprio',
  'O barbeiro le o Motivo de Cancelamento do proprio Agendamento'
);

-- ---------------------------------------------------------------------------
-- Barbeiro sem barbearia vinculada
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_barb_nulo::text from t51), true);
set local role authenticated;

select is(
  (select count(*)::int from public.appointments a where a.status = 'canceled'
   and a.id in (select ap_canc_proprio from t51 union select ap_canc_colega from t51 union select ap_canc_outra from t51)),
  0,
  'Barbeiro com barbearia nula nao alcanca nenhum cancelado'
);

reset role;

select * from finish();
rollback;
