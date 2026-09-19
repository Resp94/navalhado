begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temporary table t47 (
  tenant_a uuid not null,
  u_ger uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  service_id uuid not null,
  ap_e1 uuid not null,
  ap_e2 uuid not null,
  ap_move uuid not null,
  t_1000 timestamptz not null,
  t_1010 timestamptz not null,
  t_1100 timestamptz not null,
  t_1400 timestamptz not null,
  t_1500 timestamptz not null,
  t_1600 timestamptz not null,
  t_1700 timestamptz not null
) on commit drop;

insert into public.tenants (name, email, phone, timezone, business_hours)
values ('__t47_a__', '__t47_a__@teste.com', '11999999981', 'America/Sao_Paulo', jsonb_build_object('segunda', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'terca', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quarta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quinta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sexta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sabado', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'domingo', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true)));

insert into auth.users (id, email) values (gen_random_uuid(), '__t47_ger__@teste.com');

insert into t47
select
  (select id from public.tenants where name = '__t47_a__'),
  (select id from auth.users where email = '__t47_ger__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '10:10') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '11:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '14:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '15:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '16:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '17:00') at time zone 'America/Sao_Paulo');

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t47 t where u.id = t.u_ger;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
select t.prof1, t.tenant_a, 'A Prof1 t47', '11988880181', 10, true, jsonb_build_object('monday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'tuesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'thursday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'friday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'saturday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'sunday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true)) from t47 t;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
select t.prof2, t.tenant_a, 'B Prof2 t47', '11988880182', 10, true, jsonb_build_object('monday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'tuesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'thursday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'friday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'saturday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'sunday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true)) from t47 t;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select service_id, tenant_a, 'Servico t47', 50, 'fixed', 'corte', true, 30 from t47;

-- Dois encaixes ativos no mesmo profissional e horario, inseridos direto (sem RPC), nao podem coexistir.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select ap_e1, tenant_a, prof1, service_id, t_1000, t_1000 + interval '30 minutes', 'confirmed', 'pending', 'manual', true from t47;
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select ap_move, tenant_a, prof1, service_id, t_1500, t_1500 + interval '30 minutes', 'confirmed', 'pending', 'manual', true from t47;

grant select on t47 to authenticated;

select has_index('public', 'appointments', 'uq_appointments_one_fitting_per_slot', 'indice unico do limite de encaixe existe');

select throws_ok(
  $$insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
    select ap_e2, tenant_a, prof1, service_id, t_1000, t_1000 + interval '30 minutes', 'confirmed', 'pending', 'manual', true from t47$$,
  '23505',
  null,
  'o banco recusa o segundo encaixe ativo no mesmo profissional e horario, mesmo sem passar pela RPC'
);

select set_config('request.jwt.claim.sub', (select u_ger::text from t47), true);
set local role authenticated;

select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1000 from t47), p_is_fitting => true, p_professional_id => (select prof1 from t47))$$,
  'P0001', 'Limite atingido: já existe 1 encaixe agendado para este profissional neste horário.',
  'a RPC devolve mensagem propria ao recusar o segundo encaixe'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1000 from t47), p_is_fitting => true, p_professional_id => (select prof2 from t47))$$,
  'outro profissional aceita encaixe no mesmo horario'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1010 from t47), p_is_fitting => true, p_professional_id => (select prof1 from t47))$$,
  'encaixe do mesmo profissional em outro horario e aceito'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1000 from t47), p_is_fitting => false, p_professional_id => (select prof1 from t47))$$,
  'agendamento normal no mesmo horario de um encaixe continua permitido'
);

-- Cancelar o primeiro libera o horario.
select lives_ok(
  $$select public.cancel_appointment_by_manager((select ap_e1 from t47), (select tenant_a from t47), 'Motivo T47')$$,
  'gerente cancela o encaixe'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1000 from t47), p_is_fitting => true, p_professional_id => (select prof1 from t47))$$,
  'encaixe liberado depois de cancelar o primeiro'
);

-- Tanto faz: o limite vale sobre o profissional resolvido (pula quem ja tem encaixe naquele horario).
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1400 from t47), p_is_fitting => true, p_professional_id => (select prof1 from t47))$$,
  'prepara: prof1 com encaixe as 14:00'
);
select is(
  (select (select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1400 from t47), p_is_fitting => true))->>'professional_id'),
  (select prof2::text from t47),
  'Tanto faz encaixe pula o profissional que ja tem encaixe no horario'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t47), p_service_id => (select service_id from t47), p_start_time => (select t_1400 from t47), p_is_fitting => true)$$,
  'P0001', 'Não há profissionais disponíveis para este horário.',
  'Tanto faz sem nenhum profissional sem encaixe no horario e recusado'
);

-- Reagendar um encaixe para o horario de outro encaixe do mesmo profissional tambem e recusado.
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_move from t47), (select tenant_a from t47), (select t_1000 from t47), (select prof1 from t47))$$,
  'P0001', 'Limite atingido: já existe 1 encaixe agendado para este profissional neste horário.',
  'reagendar um encaixe para horario de outro encaixe do profissional e recusado'
);

select * from finish(true);
rollback;
