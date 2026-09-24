-- Notificacao de Agendamento so vai para o barbeiro que tem login.
--
-- public.handle_appointment_notification criava a notificacao do barbeiro em
-- todo Agendamento, mesmo quando o profissional ainda nao tinha login. As
-- notificacoes se acumulavam e, quando o gerente criava o acesso, o barbeiro
-- recem-criado "herdava" tudo de uma vez. Agora a notificacao do barbeiro so
-- nasce quando o profissional esta vinculado a um usuario barbeiro ativo. A
-- notificacao do gerente (professional_id nulo) continua em todo Agendamento.

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temporary table t62 (
  tenant_a uuid not null,
  u_ger uuid not null,
  u_barb uuid not null,
  u_barb_2 uuid not null,
  u_barb_inativo uuid not null,
  prof_com_login uuid not null,
  prof_com_login_2 uuid not null,
  prof_sem_login uuid not null,
  prof_gerente uuid not null,
  prof_login_inativo uuid not null,
  service_a uuid not null,
  ap_com_login uuid not null,
  ap_com_login_2 uuid not null,
  ap_sem_login uuid not null,
  ap_gerente uuid not null,
  ap_login_inativo uuid not null
) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t62_a__', '__t62_a__@teste.com', '11999999621');

insert into auth.users (id, email)
select gen_random_uuid(), '__t62_' || n || '__@teste.com'
from unnest(array['ger', 'barb', 'barb2', 'barbinativo']) as n;

insert into t62
select
  (select id from public.tenants where name = '__t62_a__'),
  (select id from auth.users where email = '__t62_ger__@teste.com'),
  (select id from auth.users where email = '__t62_barb__@teste.com'),
  (select id from auth.users where email = '__t62_barb2__@teste.com'),
  (select id from auth.users where email = '__t62_barbinativo__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t62 t where u.id = t.u_ger;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t62 t where u.id = t.u_barb;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t62 t where u.id = t.u_barb_2;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = false from t62 t where u.id = t.u_barb_inativo;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select v.id, t.tenant_a, v.nome, v.fone, 10, true, v.usuario
from t62 t,
  lateral (values
    (t.prof_com_login, 'Com login t62', '11988880621', t.u_barb),
    (t.prof_com_login_2, 'Com login 2 t62', '11988880625', t.u_barb_2),
    (t.prof_sem_login, 'Sem login t62', '11988880622', null::uuid),
    (t.prof_gerente, 'Gerente t62', '11988880623', t.u_ger),
    (t.prof_login_inativo, 'Login inativo t62', '11988880624', t.u_barb_inativo)
  ) as v(id, nome, fone, usuario);

insert into public.services (id, tenant_id, name, price, price_type, category, is_active)
select t.service_a, t.tenant_a, 'Servico t62', 50, 'fixed', 'corte', true from t62 t;

-- is_fitting = true dispensa a validacao de expediente; sem cliente, nada vai
-- para o WhatsApp.
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select v.id, t.tenant_a, null, v.prof, t.service_a, v.inicio, v.inicio + interval '30 minutes', 'confirmed', 'pending', 'manual', true
from t62 t,
  lateral (values
    (t.ap_com_login, t.prof_com_login, now() + interval '5 hours'),
    (t.ap_com_login_2, t.prof_com_login_2, now() + interval '5 hours 30 minutes'),
    (t.ap_sem_login, t.prof_sem_login, now() + interval '6 hours'),
    (t.ap_gerente, t.prof_gerente, now() + interval '7 hours'),
    (t.ap_login_inativo, t.prof_login_inativo, now() + interval '8 hours')
  ) as v(id, prof, inicio);

-- ---------------------------------------------------------------------------
-- Novo Agendamento
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.notifications n, t62 t where n.professional_id = t.prof_com_login),
  1,
  'Novo Agendamento notifica o barbeiro que tem login'
);

select is(
  (select count(*)::int from public.notifications n, t62 t where n.professional_id = t.prof_sem_login),
  0,
  'Novo Agendamento nao notifica o profissional sem login'
);

select is(
  (select count(*)::int from public.notifications n, t62 t
   where n.professional_id in (t.prof_gerente, t.prof_login_inativo)),
  0,
  'Novo Agendamento nao notifica profissional vinculado ao gerente nem a barbeiro inativo'
);

select is(
  (select count(*)::int from public.notifications n, t62 t
   where n.tenant_id = t.tenant_a and n.professional_id is null and n.type = 'appointment_created'),
  5,
  'Novo Agendamento continua notificando o gerente em todos os casos'
);

select is(
  (select count(*)::int from public.notifications n, t62 t where n.professional_id = t.prof_com_login),
  1,
  'O Agendamento de um barbeiro nao gera notificacao para outro barbeiro'
);

-- ---------------------------------------------------------------------------
-- Leitura por RLS: o barbeiro le so as notificacoes do proprio cadastro
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_barb::text from t62), true);
set local role authenticated;

select is(
  (select count(*)::int from public.notifications n, t62 t where n.tenant_id = t.tenant_a),
  1,
  'Sem restringir por profissional, o barbeiro so alcanca a propria notificacao'
);

select is(
  (select count(*)::int from public.notifications n, t62 t where n.professional_id = t.prof_com_login_2),
  0,
  'O barbeiro nao le a notificacao de um colega'
);

select is(
  (select count(*)::int from public.notifications n, t62 t where n.professional_id is null),
  0,
  'O barbeiro nao le a notificacao geral do gerente'
);

reset role;

-- ---------------------------------------------------------------------------
-- Cancelamento
-- ---------------------------------------------------------------------------

update public.appointments a
set status = 'canceled', canceled_by = 'shop'
from t62 t
where a.id in (t.ap_com_login, t.ap_sem_login, t.ap_gerente, t.ap_login_inativo);

select is(
  (select count(*)::int from public.notifications n, t62 t
   where n.professional_id = t.prof_com_login and n.type = 'appointment_canceled'),
  1,
  'Cancelamento notifica o barbeiro que tem login'
);

select is(
  (select count(*)::int from public.notifications n, t62 t where n.professional_id = t.prof_sem_login),
  0,
  'Cancelamento nao notifica o profissional sem login'
);

select is(
  (select count(*)::int from public.notifications n, t62 t
   where n.professional_id in (t.prof_gerente, t.prof_login_inativo)),
  0,
  'Cancelamento nao notifica profissional vinculado ao gerente nem a barbeiro inativo'
);

select is(
  (select count(*)::int from public.notifications n, t62 t
   where n.tenant_id = t.tenant_a and n.professional_id is null and n.type = 'appointment_canceled'),
  4,
  'Cancelamento continua notificando o gerente em todos os casos'
);

select * from finish();
rollback;
