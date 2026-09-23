begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temporary table t41 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger uuid not null,
  u_ger_nulo uuid not null,
  u_ger_b uuid not null,
  u_prop uuid not null,
  u_barb uuid not null,
  u_barb2 uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  ap_ger uuid not null,
  ap_prop uuid not null,
  ap_barb uuid not null,
  ap_barb_outro uuid not null,
  ap_progress uuid not null,
  ap_completed uuid not null,
  ap_canceled uuid not null,
  ap_noshow uuid not null,
  ap_nulo uuid not null
) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t41_a__', '__t41_a__@teste.com', '11999999941'),
  ('__t41_b__', '__t41_b__@teste.com', '11999999942');

insert into auth.users (id, email)
select gen_random_uuid(), '__t41_' || n || '__@teste.com'
from unnest(array['ger','gernulo','gerb','prop','barb','barb2']) as n;

insert into t41
select
  (select id from public.tenants where name = '__t41_a__'),
  (select id from public.tenants where name = '__t41_b__'),
  (select id from auth.users where email = '__t41_ger__@teste.com'),
  (select id from auth.users where email = '__t41_gernulo__@teste.com'),
  (select id from auth.users where email = '__t41_gerb__@teste.com'),
  (select id from auth.users where email = '__t41_prop__@teste.com'),
  (select id from auth.users where email = '__t41_barb__@teste.com'),
  (select id from auth.users where email = '__t41_barb2__@teste.com'),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t41 t where u.id = t.u_ger;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t41 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t41 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t41 t where u.id = t.u_prop;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t41 t where u.id in (t.u_barb, t.u_barb2);

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof1, t.tenant_a, 'Prof1 T41', '11988880141', 10, true, t.u_barb from t41 t;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof2, t.tenant_a, 'Prof2 T41', '11988880142', 10, true, t.u_barb2 from t41 t;

insert into public.services (tenant_id, name, price, price_type, category, is_active)
select tenant_a, 'Servico T41', 50, 'fixed', 'corte', true from t41;

-- is_fitting = true dispensa a validacao de expediente na insercao do teste.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select a.id, t.tenant_a, a.prof, (select id from public.services where tenant_id = t.tenant_a limit 1),
  now() + interval '1 hour', now() + interval '90 minutes', a.status, 'pending', 'manual', true
from t41 t,
  lateral (values
    (t.ap_ger, t.prof1, 'pending'),
    (t.ap_prop, t.prof1, 'confirmed'),
    (t.ap_barb, t.prof1, 'confirmed'),
    (t.ap_barb_outro, t.prof2, 'confirmed'),
    (t.ap_progress, t.prof1, 'in_progress'),
    (t.ap_completed, t.prof1, 'completed'),
    (t.ap_canceled, t.prof1, 'canceled'),
    (t.ap_noshow, t.prof1, 'no_show'),
    (t.ap_nulo, t.prof1, 'pending')
  ) as a(id, prof, status);

grant select on t41 to authenticated;

-- Gerente da unidade inicia um agendamento pendente.
select set_config('request.jwt.claim.sub', (select u_ger::text from t41), true);
set local role authenticated;

select lives_ok(
  $$select public.start_appointment_service((select ap_ger from t41), (select tenant_a from t41))$$,
  'gerente inicia atendimento pendente'
);
select is(
  (select status from public.appointments where id = (select ap_ger from t41)),
  'in_progress',
  'agendamento vai para in_progress'
);

-- Estados de origem proibidos.
select throws_ok(
  $$select public.start_appointment_service((select ap_progress from t41), (select tenant_a from t41))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser iniciados.',
  'recusa iniciar atendimento ja em andamento'
);
select throws_ok(
  $$select public.start_appointment_service((select ap_completed from t41), (select tenant_a from t41))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser iniciados.',
  'recusa iniciar atendimento concluido'
);
select throws_ok(
  $$select public.start_appointment_service((select ap_canceled from t41), (select tenant_a from t41))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser iniciados.',
  'recusa iniciar atendimento cancelado'
);
select throws_ok(
  $$select public.start_appointment_service((select ap_noshow from t41), (select tenant_a from t41))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser iniciados.',
  'recusa iniciar atendimento com falta'
);
select throws_ok(
  $$select public.start_appointment_service(gen_random_uuid(), (select tenant_a from t41))$$,
  'P0001', 'Agendamento não encontrado.',
  'recusa agendamento inexistente'
);

-- Barbeiro inicia so o proprio agendamento.
select set_config('request.jwt.claim.sub', (select u_barb::text from t41), true);
select lives_ok(
  $$select public.start_appointment_service((select ap_barb from t41), (select tenant_a from t41))$$,
  'barbeiro inicia o proprio atendimento'
);
select throws_ok(
  $$select public.start_appointment_service((select ap_barb_outro from t41), (select tenant_a from t41))$$,
  '42501', 'Acesso negado a este agendamento.',
  'barbeiro nao inicia atendimento de outro profissional'
);

-- Gerente de outra unidade e gerente sem unidade sao recusados.
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t41), true);
select throws_ok(
  $$select public.start_appointment_service((select ap_nulo from t41), (select tenant_a from t41))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente de outra unidade e recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t41), true);
select throws_ok(
  $$select public.start_appointment_service((select ap_nulo from t41), (select tenant_a from t41))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente com tenant_id nulo e recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger::text from t41), true);
select is(
  (select status from public.appointments where id = (select ap_nulo from t41)),
  'pending',
  'recusas de acesso nao alteram o agendamento'
);

-- Proprietario opera qualquer unidade.
select set_config('request.jwt.claim.sub', (select u_prop::text from t41), true);
select lives_ok(
  $$select public.start_appointment_service((select ap_prop from t41), (select tenant_a from t41))$$,
  'proprietario inicia atendimento de qualquer unidade'
);

select * from finish(true);
rollback;
