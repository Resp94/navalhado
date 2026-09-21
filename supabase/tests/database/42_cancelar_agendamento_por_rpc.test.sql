begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temporary table t42 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger uuid not null,
  u_ger_nulo uuid not null,
  u_ger_b uuid not null,
  u_prop uuid not null,
  u_barb uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  ap_pend uuid not null,
  ap_prog uuid not null,
  ap_completed uuid not null,
  ap_canceled uuid not null,
  ap_noshow uuid not null,
  ap_branco uuid not null,
  ap_barb uuid not null,
  ap_outra uuid not null,
  ap_prop uuid not null
) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t42_a__', '__t42_a__@teste.com', '11999999951'),
  ('__t42_b__', '__t42_b__@teste.com', '11999999952');

insert into auth.users (id, email)
select gen_random_uuid(), '__t42_' || n || '__@teste.com'
from unnest(array['ger','gernulo','gerb','prop','barb']) as n;

insert into t42
select
  (select id from public.tenants where name = '__t42_a__'),
  (select id from public.tenants where name = '__t42_b__'),
  (select id from auth.users where email = '__t42_ger__@teste.com'),
  (select id from auth.users where email = '__t42_gernulo__@teste.com'),
  (select id from auth.users where email = '__t42_gerb__@teste.com'),
  (select id from auth.users where email = '__t42_prop__@teste.com'),
  (select id from auth.users where email = '__t42_barb__@teste.com'),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t42 t where u.id = t.u_ger;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t42 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t42 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t42 t where u.id = t.u_prop;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t42 t where u.id = t.u_barb;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof1, t.tenant_a, 'Prof1 t42', '11988880151', 10, true, t.u_barb from t42 t;

-- Colega do barbeiro: o barbeiro so opera a propria agenda (spec 041, ticket 01).
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select t.prof2, t.tenant_a, 'Prof2 t42', '11988880152', 10, true from t42 t;

insert into public.services (tenant_id, name, price, price_type, category, is_active)
select tenant_a, 'Servico t42', 50, 'fixed', 'corte', true from t42;

-- is_fitting = true dispensa a validacao de expediente na insercao do teste. Os Agendamentos ativos
-- ficam em horarios distintos: o indice uq_appointments_one_fitting_per_slot (spec 040, ticket 09)
-- recusa dois encaixes ativos do mesmo profissional no mesmo instante.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select a.id, t.tenant_a, a.prof, (select id from public.services where tenant_id = t.tenant_a limit 1),
  a.inicio, a.inicio + interval '30 minutes', a.status, 'pending', 'manual', true
from t42 t,
  lateral (values
    (t.ap_pend, t.prof1, 'pending', now() + interval '2 hours'),
    (t.ap_prog, t.prof1, 'in_progress', now() + interval '3 hours'),
    (t.ap_completed, t.prof1, 'completed', now() + interval '2 hours'),
    (t.ap_canceled, t.prof1, 'canceled', now() + interval '2 hours'),
    (t.ap_noshow, t.prof1, 'no_show', now() - interval '2 hours'),
    (t.ap_branco, t.prof1, 'confirmed', now() + interval '4 hours'),
    (t.ap_barb, t.prof2, 'confirmed', now() + interval '5 hours'),
    (t.ap_outra, t.prof1, 'confirmed', now() + interval '6 hours'),
    (t.ap_prop, t.prof1, 'confirmed', now() + interval '7 hours')
  ) as a(id, prof, status, inicio);

grant select on t42 to authenticated;

select set_config('request.jwt.claim.sub', (select u_ger::text from t42), true);
set local role authenticated;

select lives_ok(
  $$select public.cancel_appointment_by_manager((select ap_pend from t42), (select tenant_a from t42), 'Cliente desistiu')$$,
  'gerente cancela agendamento pendente com motivo'
);
select is(
  (select status from public.appointments where id = (select ap_pend from t42)),
  'canceled',
  'agendamento vai para canceled'
);
select is(
  (select cancellation_reason from public.appointments where id = (select ap_pend from t42)),
  'Cliente desistiu',
  'motivo do cancelamento e gravado'
);
select is(
  (select status from public.comandas where appointment_id = (select ap_pend from t42)),
  'cancelada',
  'comanda aberta do agendamento e cancelada junto'
);
select lives_ok(
  $$select public.cancel_appointment_by_manager((select ap_prog from t42), (select tenant_a from t42), 'Cliente passou mal')$$,
  'gerente cancela agendamento em andamento'
);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_completed from t42), (select tenant_a from t42), 'Motivo qualquer')$$,
  'P0001', 'Somente atendimentos pendentes, confirmados ou em andamento podem ser cancelados.',
  'recusa cancelar agendamento concluido'
);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_canceled from t42), (select tenant_a from t42), 'Motivo qualquer')$$,
  'P0001', 'Somente atendimentos pendentes, confirmados ou em andamento podem ser cancelados.',
  'recusa cancelar agendamento ja cancelado'
);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_noshow from t42), (select tenant_a from t42), 'Motivo qualquer')$$,
  'P0001', 'Somente atendimentos pendentes, confirmados ou em andamento podem ser cancelados.',
  'recusa cancelar agendamento com falta'
);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_branco from t42), (select tenant_a from t42), '   ')$$,
  'P0001', 'Informe o motivo do cancelamento.',
  'recusa motivo em branco'
);
select set_config('request.jwt.claim.sub', (select u_barb::text from t42), true);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_barb from t42), (select tenant_a from t42), 'Motivo')$$,
  '42501', 'Acesso negado a este agendamento.',
  'barbeiro nao cancela agendamento de colega'
);
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t42), true);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_outra from t42), (select tenant_a from t42), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente de outra unidade e recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t42), true);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_outra from t42), (select tenant_a from t42), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente com tenant_id nulo e recusado'
);
select set_config('request.jwt.claim.sub', (select u_prop::text from t42), true);
select lives_ok(
  $$select public.cancel_appointment_by_manager((select ap_prop from t42), (select tenant_a from t42), 'Motivo')$$,
  'proprietario cancela agendamento de qualquer unidade'
);

select * from finish(true);
rollback;
