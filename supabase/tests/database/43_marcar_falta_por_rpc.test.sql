begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temporary table t43 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger uuid not null,
  u_ger_nulo uuid not null,
  u_ger_b uuid not null,
  u_prop uuid not null,
  u_barb uuid not null,
  prof1 uuid not null,
  ap_pend uuid not null,
  ap_conf uuid not null,
  ap_futuro uuid not null,
  ap_prog uuid not null,
  ap_completed uuid not null,
  ap_canceled uuid not null,
  ap_noshow uuid not null,
  ap_barb uuid not null,
  ap_outra uuid not null,
  ap_prop uuid not null
) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t43_a__', '__t43_a__@teste.com', '11999999951'),
  ('__t43_b__', '__t43_b__@teste.com', '11999999952');

insert into auth.users (id, email)
select gen_random_uuid(), '__t43_' || n || '__@teste.com'
from unnest(array['ger','gernulo','gerb','prop','barb']) as n;

insert into t43
select
  (select id from public.tenants where name = '__t43_a__'),
  (select id from public.tenants where name = '__t43_b__'),
  (select id from auth.users where email = '__t43_ger__@teste.com'),
  (select id from auth.users where email = '__t43_gernulo__@teste.com'),
  (select id from auth.users where email = '__t43_gerb__@teste.com'),
  (select id from auth.users where email = '__t43_prop__@teste.com'),
  (select id from auth.users where email = '__t43_barb__@teste.com'),
  gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t43 t where u.id = t.u_ger;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t43 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t43 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t43 t where u.id = t.u_prop;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t43 t where u.id = t.u_barb;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof1, t.tenant_a, 'Prof1 t43', '11988880151', 10, true, t.u_barb from t43 t;

insert into public.services (tenant_id, name, price, price_type, category, is_active)
select tenant_a, 'Servico t43', 50, 'fixed', 'corte', true from t43;

-- is_fitting = true dispensa a validacao de expediente na insercao do teste.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select a.id, t.tenant_a, a.prof, (select id from public.services where tenant_id = t.tenant_a limit 1),
  a.inicio, a.inicio + interval '30 minutes', a.status, 'pending', 'manual', true
from t43 t,
  lateral (values
    (t.ap_pend, t.prof1, 'pending', now() - interval '2 hours'),
    (t.ap_conf, t.prof1, 'confirmed', now() - interval '2 hours'),
    (t.ap_futuro, t.prof1, 'confirmed', now() + interval '2 hours'),
    (t.ap_prog, t.prof1, 'in_progress', now() - interval '2 hours'),
    (t.ap_completed, t.prof1, 'completed', now() - interval '2 hours'),
    (t.ap_canceled, t.prof1, 'canceled', now() - interval '2 hours'),
    (t.ap_noshow, t.prof1, 'no_show', now() - interval '2 hours'),
    (t.ap_barb, t.prof1, 'confirmed', now() - interval '2 hours'),
    (t.ap_outra, t.prof1, 'confirmed', now() - interval '2 hours'),
    (t.ap_prop, t.prof1, 'confirmed', now() - interval '2 hours')
  ) as a(id, prof, status, inicio);

grant select on t43 to authenticated;

select set_config('request.jwt.claim.sub', (select u_ger::text from t43), true);
set local role authenticated;

select lives_ok(
  $$select public.mark_appointment_no_show((select ap_pend from t43), (select tenant_a from t43))$$,
  'gerente marca falta em agendamento pendente que ja comecou'
);
select is(
  (select status from public.appointments where id = (select ap_pend from t43)),
  'no_show',
  'agendamento vai para no_show'
);
select is(
  (select status from public.comandas where appointment_id = (select ap_pend from t43)),
  'cancelada',
  'comanda aberta do agendamento com falta e cancelada'
);
select lives_ok(
  $$select public.mark_appointment_no_show((select ap_conf from t43), (select tenant_a from t43))$$,
  'gerente marca falta em agendamento confirmado que ja comecou'
);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_futuro from t43), (select tenant_a from t43))$$,
  'P0001', 'O atendimento ainda não começou.',
  'recusa falta antes do horario de inicio'
);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_prog from t43), (select tenant_a from t43))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.',
  'recusa falta em agendamento em andamento'
);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_completed from t43), (select tenant_a from t43))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.',
  'recusa falta em agendamento concluido'
);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_canceled from t43), (select tenant_a from t43))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.',
  'recusa falta em agendamento cancelado'
);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_noshow from t43), (select tenant_a from t43))$$,
  'P0001', 'Somente atendimentos pendentes ou confirmados podem ser marcados como não compareceu.',
  'recusa falta em agendamento que ja tem falta'
);
select set_config('request.jwt.claim.sub', (select u_barb::text from t43), true);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_barb from t43), (select tenant_a from t43))$$,
  '42501', 'Acesso negado.',
  'barbeiro nao marca falta'
);
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t43), true);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_outra from t43), (select tenant_a from t43))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente de outra unidade e recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t43), true);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_outra from t43), (select tenant_a from t43))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente com tenant_id nulo e recusado'
);
select set_config('request.jwt.claim.sub', (select u_prop::text from t43), true);
select lives_ok(
  $$select public.mark_appointment_no_show((select ap_prop from t43), (select tenant_a from t43))$$,
  'proprietario marca falta em qualquer unidade'
);

select * from finish(true);
rollback;
