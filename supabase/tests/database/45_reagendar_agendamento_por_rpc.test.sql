begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create temporary table t45 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger uuid not null,
  u_ger_nulo uuid not null,
  u_ger_b uuid not null,
  u_prop uuid not null,
  u_barb uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  service_id uuid not null,
  ap_a uuid not null,
  ap_b uuid not null,
  ap_prog uuid not null,
  ap_done uuid not null,
  ap_canc uuid not null,
  ap_noshow uuid not null,
  ap_barb uuid not null,
  ap_outra uuid not null,
  ap_prop uuid not null,
  t_1000 timestamptz not null,
  t_1100 timestamptz not null,
  t_1215 timestamptz not null,
  t_1400 timestamptz not null,
  t_1500 timestamptz not null,
  t_1530 timestamptz not null,
  t_1600 timestamptz not null,
  t_1630 timestamptz not null,
  t_1700 timestamptz not null,
  t_2100 timestamptz not null,
  t_ontem timestamptz not null
) on commit drop;

insert into public.tenants (name, email, phone, timezone, business_hours) values
  ('__t45_a__', '__t45_a__@teste.com', '11999999961', 'America/Sao_Paulo', jsonb_build_object('segunda', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'terca', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quarta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quinta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sexta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sabado', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'domingo', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true))),
  ('__t45_b__', '__t45_b__@teste.com', '11999999962', 'America/Sao_Paulo', jsonb_build_object('segunda', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'terca', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quarta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quinta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sexta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sabado', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'domingo', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true)));

insert into auth.users (id, email)
select gen_random_uuid(), '__t45_' || n || '__@teste.com'
from unnest(array['ger','gernulo','gerb','prop','barb']) as n;

insert into t45
select
  (select id from public.tenants where name = '__t45_a__'),
  (select id from public.tenants where name = '__t45_b__'),
  (select id from auth.users where email = '__t45_ger__@teste.com'),
  (select id from auth.users where email = '__t45_gernulo__@teste.com'),
  (select id from auth.users where email = '__t45_gerb__@teste.com'),
  (select id from auth.users where email = '__t45_prop__@teste.com'),
  (select id from auth.users where email = '__t45_barb__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '11:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '12:15') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '14:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '15:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '15:30') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '16:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '16:30') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '17:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '21:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + -1 + time '10:00') at time zone 'America/Sao_Paulo');

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t45 t where u.id = t.u_ger;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t45 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t45 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t45 t where u.id = t.u_prop;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t45 t where u.id = t.u_barb;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id, weekly_schedule)
select t.prof1, t.tenant_a, 'Prof1 t45', '11988880161', 10, true, t.u_barb, jsonb_build_object('monday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'tuesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'thursday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'friday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'saturday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'sunday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true)) from t45 t;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
select t.prof2, t.tenant_a, 'Prof2 t45', '11988880162', 10, true, jsonb_build_object('monday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'tuesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'thursday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'friday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'saturday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'sunday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true)) from t45 t;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select service_id, tenant_a, 'Servico t45', 50, 'fixed', 'corte', true, 30 from t45;

-- prof2 executa o servico em 60 minutos (duracao propria).
insert into public.professional_services (tenant_id, professional_id, service_id, custom_duration_minutes, is_enabled)
select tenant_a, prof2, service_id, 60, true from t45;

insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
select a.id, t.tenant_a, t.prof1, t.service_id, a.inicio, a.inicio + interval '30 minutes', a.status, 'pending', 'manual'
from t45 t,
  lateral (values
    (t.ap_a, t.t_1000, 'confirmed'),
    (t.ap_b, t.t_1400, 'confirmed'),
    (t.ap_prog, t.t_1500, 'in_progress'),
    (t.ap_done, t.t_1530, 'completed'),
    (t.ap_canc, t.t_1530, 'canceled'),
    (t.ap_noshow, t.t_1530, 'no_show'),
    (t.ap_barb, t.t_1600, 'confirmed'),
    (t.ap_outra, t.t_1630, 'confirmed'),
    (t.ap_prop, t.t_1700, 'confirmed')
  ) as a(id, inicio, status);

-- Bloqueio de Horario do prof1 entre 16:00 e 17:00 do dia+2 (fora do que ja esta agendado).
insert into public.blocked_slots (tenant_id, professional_id, start_time, end_time, reason)
select tenant_a, prof1, t_1600 + interval '31 minutes', t_1600 + interval '60 minutes', 'Almoco T45' from t45;

grant select on t45 to authenticated;

select set_config('request.jwt.claim.sub', (select u_ger::text from t45), true);
set local role authenticated;

select lives_ok(
  $$select public.reschedule_appointment_by_manager((select ap_a from t45), (select tenant_a from t45), (select t_1100 from t45), null::uuid)$$,
  'gerente reagenda para outro horario do mesmo profissional'
);
select is(
  (select start_time from public.appointments where id = (select ap_a from t45)),
  (select t_1100 from t45),
  'o novo horario e gravado'
);
-- 2 outro profissional, duracao propria (60 min)
select lives_ok(
  $$select public.reschedule_appointment_by_manager((select ap_a from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  'gerente reagenda para outro profissional'
);
select is(
  (select end_time from public.appointments where id = (select ap_a from t45)),
  (select t_1100 + interval '60 minutes' from t45),
  'o fim e recalculado pela duracao do novo profissional'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_prog from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser reagendados.',
  'recusa reagendar agendamento em andamento'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_done from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser reagendados.',
  'recusa reagendar agendamento concluido'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_canc from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser reagendados.',
  'recusa reagendar agendamento cancelado'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_noshow from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser reagendados.',
  'recusa reagendar agendamento com falta'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_a from t45), (select tenant_a from t45), (select t_1400 from t45), (select prof1 from t45))$$,
  'P0001', 'O horário selecionado já está ocupado.',
  'recusa horario ocupado por outro agendamento do profissional'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_a from t45), (select tenant_a from t45), (select t_1630 from t45), (select prof1 from t45))$$,
  'P0001', 'O horário escolhido está bloqueado na agenda.',
  'recusa horario em Bloqueio de Horario'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_a from t45), (select tenant_a from t45), (select t_2100 from t45), (select prof2 from t45))$$,
  '22023', null,
  'recusa horario fora do expediente'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_a from t45), (select tenant_a from t45), (select t_1215 from t45), (select prof2 from t45))$$,
  '22023', null,
  'recusa horario no intervalo do profissional'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_a from t45), (select tenant_a from t45), (select t_ontem from t45), (select prof2 from t45))$$,
  'P0001', 'Não é possível reagendar para um horário que já passou.',
  'recusa horario que ja passou'
);
select set_config('request.jwt.claim.sub', (select u_barb::text from t45), true);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_barb from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  '42501', 'Acesso negado.',
  'barbeiro nao reagenda'
);
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t45), true);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_outra from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente de outra unidade e recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t45), true);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_outra from t45), (select tenant_a from t45), (select t_1100 from t45), (select prof2 from t45))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente com tenant_id nulo e recusado'
);
select set_config('request.jwt.claim.sub', (select u_prop::text from t45), true);
select lives_ok(
  $$select public.reschedule_appointment_by_manager((select ap_prop from t45), (select tenant_a from t45), (select t_1500 from t45), (select prof2 from t45))$$,
  'proprietario reagenda em qualquer unidade'
);

select * from finish(true);
rollback;
