begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

create temporary table t46 (
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
  service_inativo uuid not null,
  customer_id uuid not null,
  w_ok uuid not null,
  w_fail uuid not null,
  w_done uuid not null,
  ap_p1_1000 uuid not null,
  ap_p1_1400 uuid not null,
  ap_p2_1400 uuid not null,
  t_1000 timestamptz not null,
  t_1100 timestamptz not null,
  t_1400 timestamptz not null,
  t_1500 timestamptz not null,
  t_1630 timestamptz not null,
  t_1700 timestamptz not null,
  t_1730 timestamptz not null,
  t_1900 timestamptz not null,
  t_2100 timestamptz not null,
  t_ontem timestamptz not null
) on commit drop;

insert into public.tenants (name, email, phone, timezone, business_hours) values
  ('__t46_a__', '__t46_a__@teste.com', '11999999971', 'America/Sao_Paulo', jsonb_build_object('segunda', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'terca', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quarta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quinta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sexta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sabado', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'domingo', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true))),
  ('__t46_b__', '__t46_b__@teste.com', '11999999972', 'America/Sao_Paulo', jsonb_build_object('segunda', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'terca', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quarta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'quinta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sexta', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'sabado', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true), 'domingo', jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true)));

insert into auth.users (id, email)
select gen_random_uuid(), '__t46_' || n || '__@teste.com'
from unnest(array['ger','gernulo','gerb','prop','barb']) as n;

insert into t46
select
  (select id from public.tenants where name = '__t46_a__'),
  (select id from public.tenants where name = '__t46_b__'),
  (select id from auth.users where email = '__t46_ger__@teste.com'),
  (select id from auth.users where email = '__t46_gernulo__@teste.com'),
  (select id from auth.users where email = '__t46_gerb__@teste.com'),
  (select id from auth.users where email = '__t46_prop__@teste.com'),
  (select id from auth.users where email = '__t46_barb__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '11:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '14:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '15:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '16:30') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '17:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '17:30') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '19:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '21:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + -1 + time '10:00') at time zone 'America/Sao_Paulo');

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t46 t where u.id = t.u_ger;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t46 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t46 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t46 t where u.id = t.u_prop;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t46 t where u.id = t.u_barb;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id, weekly_schedule)
select t.prof1, t.tenant_a, 'A Prof1 t46', '11988880171', 10, true, t.u_barb, jsonb_build_object('monday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'tuesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'thursday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'friday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'saturday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'sunday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true)) from t46 t;
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
select t.prof2, t.tenant_a, 'B Prof2 t46', '11988880172', 10, true, jsonb_build_object('monday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'tuesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'wednesday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'thursday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'friday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'saturday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true), 'sunday', jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true)) from t46 t;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select service_id, tenant_a, 'Servico t46', 50, 'fixed', 'corte', true, 30 from t46;
insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select service_inativo, tenant_a, 'Inativo t46', 50, 'fixed', 'corte', false, 30 from t46;

insert into public.customers (id, tenant_id, name, phone, cadastro_completo)
select customer_id, tenant_a, 'Cliente t46', '11977770001', true from t46;

insert into public.waiting_list (id, tenant_id, name, phone, status)
select w.id, t.tenant_a, 'Espera ' || w.st, '11966660001', w.st
from t46 t, lateral (values (t.w_ok, 'waiting'), (t.w_fail, 'waiting'), (t.w_done, 'scheduled')) as w(id, st);

insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin)
select a.id, t.tenant_a, a.prof, t.service_id, a.inicio, a.inicio + interval '30 minutes', 'confirmed', 'pending', 'manual'
from t46 t,
  lateral (values
    (t.ap_p1_1000, t.prof1, t.t_1000),
    (t.ap_p1_1400, t.prof1, t.t_1400),
    (t.ap_p2_1400, t.prof2, t.t_1400)
  ) as a(id, prof, inicio);

-- Bloqueio de Horario do prof1 entre 17:01 e 17:30 do dia+2.
insert into public.blocked_slots (tenant_id, professional_id, start_time, end_time, reason)
select tenant_a, prof1, t_1700 + interval '1 minute', t_1700 + interval '30 minutes', 'Bloqueio t46' from t46;

grant select on t46 to authenticated;

select set_config('request.jwt.claim.sub', (select u_ger::text from t46), true);
set local role authenticated;

select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1100 from t46), p_professional_id => (select prof1 from t46), p_customer_id => (select customer_id from t46))$$,
  'gerente cria agendamento com cliente e profissional'
);
select is(
  (select status || '/' || payment_status || '/' || origin || '/' || (end_time - start_time)::text
   from public.appointments where tenant_id = (select tenant_a from t46) and start_time = (select t_1100 from t46) and professional_id = (select prof1 from t46)),
  'confirmed/pending/manual/00:30:00',
  'grava confirmed, pagamento pending, origem manual e fim pela duracao do servico'
);
select is(
  (select count(*) from public.comandas c join public.appointments a on a.id = c.appointment_id
   where a.start_time = (select t_1100 from t46) and a.professional_id = (select prof1 from t46) and c.status = 'aberta'),
  1::bigint,
  'o agendamento novo nasce com uma comanda aberta (gatilho)'
);
select is(
  (select (select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1000 from t46)))->>'professional_id'),
  (select prof2::text from t46),
  'Tanto faz pula o profissional ocupado e resolve o proximo livre'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1400 from t46))$$,
  'P0001', 'Não há profissionais disponíveis para este horário.',
  'Tanto faz sem nenhum profissional livre e recusado'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1000 from t46), p_professional_id => (select prof1 from t46))$$,
  'P0001', 'O horário selecionado já está ocupado.',
  'recusa horario ocupado por outro agendamento do profissional'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1700 from t46), p_professional_id => (select prof1 from t46))$$,
  'P0001', 'O horário escolhido está bloqueado na agenda.',
  'recusa horario em Bloqueio de Horario'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_2100 from t46), p_professional_id => (select prof1 from t46))$$,
  '22023', null,
  'recusa horario fora do expediente (gatilho existente)'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_ontem from t46), p_professional_id => (select prof1 from t46))$$,
  'P0001', 'Não é possível agendar em um horário que já passou. Horários passados só como encaixe.',
  'recusa horario passado que nao e encaixe'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_ontem from t46), p_professional_id => (select prof1 from t46), p_is_fitting => true)$$,
  'aceita horario passado como encaixe'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_inativo from t46), p_start_time => (select t_1500 from t46), p_professional_id => (select prof1 from t46))$$,
  'P0001', 'Serviço não encontrado ou inativo.',
  'recusa servico inativo'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1730 from t46), p_professional_id => (select prof1 from t46), p_new_customer_name => 'Cliente Novo T46', p_new_customer_phone => '(11) 95555-0001')$$,
  'cria o Cliente na mesma transacao do agendamento'
);
select is(
  (select c.name from public.appointments a join public.customers c on c.id = a.customer_id
   where a.start_time = (select t_1730 from t46) and a.professional_id = (select prof1 from t46)),
  'Cliente Novo T46',
  'o agendamento fica ligado ao cliente criado'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1900 from t46), p_professional_id => (select prof1 from t46), p_new_customer_name => 'Sem Telefone T46', p_new_customer_phone => '123')$$,
  'P0001', 'Telefone inválido (mínimo DDD + 8 dígitos).',
  'recusa cliente novo com telefone invalido'
);
select is(
  (select count(*) from public.customers where name = 'Sem Telefone T46'),
  0::bigint,
  'recusa nao deixa cliente criado'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1500 from t46), p_professional_id => (select prof1 from t46), p_waiting_list_id => (select w_ok from t46))$$,
  'cria agendamento consumindo a entrada da Lista de Espera'
);
select is(
  (select status from public.waiting_list where id = (select w_ok from t46)),
  'scheduled',
  'a entrada da Lista de Espera sai da fila quando o agendamento e salvo'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1000 from t46), p_professional_id => (select prof1 from t46), p_waiting_list_id => (select w_fail from t46))$$,
  'P0001', 'O horário selecionado já está ocupado.',
  'criacao recusada com entrada da Lista de Espera'
);
select is(
  (select status from public.waiting_list where id = (select w_fail from t46)),
  'waiting',
  'criacao recusada mantem a entrada aguardando'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1100 from t46), p_professional_id => (select prof2 from t46), p_waiting_list_id => (select w_done from t46))$$,
  'P0001', 'Esta entrada da Lista de Espera não está mais aguardando.',
  'recusa entrada da Lista de Espera que ja foi atendida'
);
select set_config('request.jwt.claim.sub', (select u_barb::text from t46), true);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1100 from t46), p_professional_id => (select prof2 from t46))$$,
  '42501', 'Barbeiro só cria agendamento na própria agenda.',
  'barbeiro nao cria agendamento na agenda de colega'
);
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t46), true);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1100 from t46), p_professional_id => (select prof2 from t46))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente de outra unidade e recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t46), true);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1100 from t46), p_professional_id => (select prof2 from t46))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente com tenant_id nulo e recusado'
);
select set_config('request.jwt.claim.sub', (select u_prop::text from t46), true);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t46), p_service_id => (select service_id from t46), p_start_time => (select t_1100 from t46), p_professional_id => (select prof2 from t46))$$,
  'proprietario cria agendamento em qualquer unidade'
);

select * from finish(true);
rollback;
