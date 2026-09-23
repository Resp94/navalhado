begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

-- Spec 041, ticket 01: o barbeiro opera a propria agenda pelas RPCs do gestor, sem escrita
-- direta fora dela, e nunca cruza a fronteira da barbearia.

create temporary table t48 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger uuid not null,
  u_ger_nulo uuid not null,
  u_ger_b uuid not null,
  u_prop uuid not null,
  u_barb uuid not null,
  u_barb_nulo uuid not null,
  u_barb_off uuid not null,
  u_barb_cruz uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  prof3 uuid not null,
  prof_b uuid not null,
  prof_cruz uuid not null,
  service_a uuid not null,
  service_b uuid not null,
  customer_a uuid not null,
  customer_b uuid not null,
  w_ok uuid not null,
  product_a uuid not null,
  ap_cancel uuid not null,
  ap_falta uuid not null,
  ap_resch uuid not null,
  ap_resch2 uuid not null,
  ap_troca uuid not null,
  ap_p2 uuid not null,
  ap_b uuid not null,
  ap_ger uuid not null,
  d2_1000 timestamptz not null,
  d2_1100 timestamptz not null,
  d2_1400 timestamptz not null,
  d2_1500 timestamptz not null,
  d2_1600 timestamptz not null,
  d2_1700 timestamptz not null,
  d3_1000 timestamptz not null,
  d3_1100 timestamptz not null,
  d3_1400 timestamptz not null,
  d3_1500 timestamptz not null,
  d3_1700 timestamptz not null,
  d4_1000 timestamptz not null,
  d4_1100 timestamptz not null,
  d4_1400 timestamptz not null,
  passado timestamptz not null
) on commit drop;

create temporary table sched48 on commit drop as
select jsonb_object_agg(d, jsonb_build_object('start', '09:00', 'end', '18:00', 'break_start', '12:00', 'break_end', '13:00', 'active', true)) as s
from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) as d;

create temporary table hours48 on commit drop as
select jsonb_object_agg(d, jsonb_build_object('open', '08:00', 'close', '20:00', 'active', true)) as h
from unnest(array['segunda','terca','quarta','quinta','sexta','sabado','domingo']) as d;

insert into public.tenants (name, email, phone, timezone, business_hours)
select n, n || '@teste.com', p, 'America/Sao_Paulo', (select h from hours48)
from (values ('__t48_a__', '11999999981'), ('__t48_b__', '11999999982')) as v(n, p);

insert into auth.users (id, email)
select gen_random_uuid(), '__t48_' || n || '__@teste.com'
from unnest(array['ger','gernulo','gerb','prop','barb','barbnulo','barboff','barbcruz']) as n;

insert into t48
select
  (select id from public.tenants where name = '__t48_a__'),
  (select id from public.tenants where name = '__t48_b__'),
  (select id from auth.users where email = '__t48_ger__@teste.com'),
  (select id from auth.users where email = '__t48_gernulo__@teste.com'),
  (select id from auth.users where email = '__t48_gerb__@teste.com'),
  (select id from auth.users where email = '__t48_prop__@teste.com'),
  (select id from auth.users where email = '__t48_barb__@teste.com'),
  (select id from auth.users where email = '__t48_barbnulo__@teste.com'),
  (select id from auth.users where email = '__t48_barboff__@teste.com'),
  (select id from auth.users where email = '__t48_barbcruz__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '11:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '14:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '15:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '16:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 2 + time '17:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 3 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 3 + time '11:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 3 + time '14:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 3 + time '15:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 3 + time '17:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 4 + time '10:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 4 + time '11:00') at time zone 'America/Sao_Paulo'),
  (((now() at time zone 'America/Sao_Paulo')::date + 4 + time '14:00') at time zone 'America/Sao_Paulo'),
  now() - interval '2 hours';

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t48 t where u.id = t.u_ger;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t48 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t48 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t48 t where u.id = t.u_prop;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t48 t where u.id = t.u_barb;
update public.users u set tenant_id = null, role = 'barbeiro', is_active = true from t48 t where u.id = t.u_barb_nulo;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = false from t48 t where u.id = t.u_barb_off;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t48 t where u.id = t.u_barb_cruz;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id, weekly_schedule)
select v.id, v.tenant, v.nome, v.fone, 10, true, v.usr, (select s from sched48)
from t48 t,
  lateral (values
    (t.prof1, t.tenant_a, 'A Prof1 t48', '11988880181', t.u_barb),
    (t.prof2, t.tenant_a, 'B Prof2 t48', '11988880182', null::uuid),
    (t.prof3, t.tenant_a, 'C Prof3 t48', '11988880183', t.u_barb_off),
    (t.prof_b, t.tenant_b, 'Prof B t48', '11988880184', null::uuid),
    (t.prof_cruz, t.tenant_b, 'Prof Cruz t48', '11988880185', t.u_barb_cruz)
  ) as v(id, tenant, nome, fone, usr);

insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select v.id, v.tenant, v.nome, 50, 'fixed', 'corte', true, 30
from t48 t, lateral (values (t.service_a, t.tenant_a, 'Servico A t48'), (t.service_b, t.tenant_b, 'Servico B t48')) as v(id, tenant, nome);

insert into public.customers (id, tenant_id, name, phone, cadastro_completo)
select v.id, v.tenant, v.nome, v.fone, true
from t48 t, lateral (values (t.customer_a, t.tenant_a, 'Cliente A t48', '11977770181'), (t.customer_b, t.tenant_b, 'Cliente B t48', '11977770182')) as v(id, tenant, nome, fone);

insert into public.waiting_list (id, tenant_id, name, phone, status)
select w_ok, tenant_a, 'Espera t48', '11966660181', 'waiting' from t48;

insert into public.products (id, tenant_id, name, price)
select product_a, tenant_a, 'Produto t48', 10 from t48;

insert into public.professional_services (tenant_id, professional_id, service_id)
select tenant_a, prof1, service_a from t48;

-- Fixtures inseridas como dono do banco: expediente e escala sao validados pelo gatilho, entao
-- todos os horarios cabem em 09:00-18:00 fora do intervalo. O passado usa encaixe.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select a.id, a.tenant, a.prof, a.svc, a.inicio, a.inicio + interval '30 minutes', 'confirmed', 'pending', 'manual', a.fit
from t48 t,
  lateral (values
    (t.ap_cancel, t.tenant_a, t.prof1, t.service_a, t.d2_1000, false),
    (t.ap_falta, t.tenant_a, t.prof1, t.service_a, t.passado, true),
    (t.ap_resch, t.tenant_a, t.prof1, t.service_a, t.d2_1400, false),
    (t.ap_resch2, t.tenant_a, t.prof1, t.service_a, t.d3_1000, false),
    (t.ap_troca, t.tenant_a, t.prof1, t.service_a, t.d3_1400, false),
    (t.ap_p2, t.tenant_a, t.prof2, t.service_a, t.d2_1000, false),
    (t.ap_b, t.tenant_b, t.prof_b, t.service_b, t.d2_1000, false),
    (t.ap_ger, t.tenant_a, t.prof1, t.service_a, t.d4_1000, false)
  ) as a(id, tenant, prof, svc, inicio, fit);

-- Bloqueio de Horario do colega (prof2) no dia+3 as 17:00.
insert into public.blocked_slots (tenant_id, professional_id, start_time, end_time, reason)
select tenant_a, prof2, d3_1700, d3_1700 + interval '30 minutes', 'Bloqueio colega t48' from t48;

create function pg_temp.rows_affected(p_sql text) returns integer language plpgsql as $$
declare n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant select on t48 to authenticated;

-- ---------------------------------------------------------------- barbeiro, agenda propria
select set_config('request.jwt.claim.sub', (select u_barb::text from t48), true);
set local role authenticated;

select lives_ok(
  $$select public.cancel_appointment_by_manager((select ap_cancel from t48), (select tenant_a from t48), 'Cliente desistiu')$$,
  'barbeiro cancela o proprio agendamento'
);
select is(
  (select status from public.appointments where id = (select ap_cancel from t48)),
  'canceled',
  'agendamento do barbeiro vai para canceled'
);
select is(
  (select status from public.comandas where appointment_id = (select ap_cancel from t48)),
  'cancelada',
  'comanda do agendamento cancelado pelo barbeiro e cancelada pelo gatilho'
);
select lives_ok(
  $$select public.mark_appointment_no_show((select ap_falta from t48), (select tenant_a from t48))$$,
  'barbeiro marca falta no proprio agendamento ja iniciado'
);
select is(
  (select status from public.appointments where id = (select ap_falta from t48)),
  'no_show',
  'agendamento do barbeiro vai para no_show'
);
select lives_ok(
  $$select public.reschedule_appointment_by_manager((select ap_resch from t48), (select tenant_a from t48), (select d2_1100 from t48))$$,
  'barbeiro reagenda o proprio agendamento mudando so data e hora'
);
select is(
  (select start_time from public.appointments where id = (select ap_resch from t48)),
  (select d2_1100 from t48),
  'novo horario gravado'
);
select lives_ok(
  $$select public.reschedule_appointment_by_manager((select ap_resch2 from t48), (select tenant_a from t48), (select d3_1100 from t48), (select prof1 from t48))$$,
  'barbeiro reagenda informando o proprio profissional'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_troca from t48), (select tenant_a from t48), (select d3_1400 from t48), (select prof2 from t48))$$,
  '42501', 'Barbeiro não troca o profissional do agendamento.',
  'barbeiro nao reagenda para outro profissional'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d2_1600 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_a from t48))$$,
  'barbeiro cria agendamento na propria agenda com cliente existente'
);
select is(
  (select count(*)::integer from public.comandas c join public.appointments a on a.id = c.appointment_id
   where a.professional_id = (select prof1 from t48) and a.start_time = (select d2_1600 from t48)),
  1,
  'comanda do agendamento criado pelo barbeiro nasce pelo gatilho'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d2_1500 from t48), p_professional_id => (select prof1 from t48), p_new_customer_name => 'Cliente Novo t48', p_new_customer_phone => '11955550181', p_is_fitting => true)$$,
  'barbeiro cria encaixe na propria agenda com cliente novo'
);
select is(
  (select count(*)::integer from public.customers where tenant_id = (select tenant_a from t48) and name = 'Cliente Novo t48'),
  1,
  'cliente novo nasce na barbearia do barbeiro pela RPC'
);

-- ---------------------------------------------------------------- barbeiro, recusas
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_p2 from t48), (select tenant_a from t48), 'Motivo')$$,
  '42501', 'Acesso negado a este agendamento.',
  'barbeiro nao cancela agendamento do colega'
);
select throws_ok(
  $$select public.mark_appointment_no_show((select ap_p2 from t48), (select tenant_a from t48))$$,
  '42501', 'Acesso negado a este agendamento.',
  'barbeiro nao marca falta em agendamento do colega'
);
select throws_ok(
  $$select public.reschedule_appointment_by_manager((select ap_p2 from t48), (select tenant_a from t48), (select d2_1100 from t48))$$,
  '42501', 'Acesso negado a este agendamento.',
  'barbeiro nao reagenda agendamento do colega'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_customer_id => (select customer_a from t48))$$,
  '42501', 'Barbeiro só cria agendamento na própria agenda.',
  'barbeiro nao cria com "Tanto faz"'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof2 from t48), p_customer_id => (select customer_a from t48))$$,
  '42501', 'Barbeiro só cria agendamento na própria agenda.',
  'barbeiro nao cria na agenda do colega'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_a from t48), p_waiting_list_id => (select w_ok from t48))$$,
  '42501', 'Barbeiro não consome a Lista de Espera.',
  'barbeiro nao consome entrada da Lista de Espera'
);
select is(
  (select status from public.waiting_list where id = (select w_ok from t48)),
  'waiting',
  'entrada da Lista de Espera segue aguardando'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_b from t48), p_service_id => (select service_b from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_b from t48))$$,
  '42501', 'Acesso negado para esta unidade.',
  'barbeiro nao cria agendamento em outra barbearia'
);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_b from t48), (select tenant_b from t48), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'barbeiro nao cancela agendamento de outra barbearia informando o tenant dela'
);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_b from t48), (select tenant_a from t48), 'Motivo')$$,
  'P0001', 'Agendamento não encontrado.',
  'barbeiro nao cancela agendamento de outra barbearia informando o proprio tenant'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_b from t48))$$,
  'P0001', 'Cliente não encontrado.',
  'barbeiro nao usa cliente de outra barbearia'
);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_b from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_a from t48))$$,
  'P0001', 'Serviço não encontrado ou inativo.',
  'barbeiro nao usa servico de outra barbearia'
);

-- ---------------------------------------------------------------- barbeiro, escrita direta
select throws_ok(
  $$insert into public.appointments (tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin) select tenant_a, prof1, service_a, d3_1500, d3_1500 + interval '30 minutes', 'confirmed', 'pending', 'manual' from t48$$,
  '42501', null,
  'barbeiro nao insere agendamento direto'
);
select is(
  pg_temp.rows_affected($q$update public.appointments set notes = 'direto' where id = (select ap_troca from t48)$q$),
  0,
  'barbeiro nao atualiza agendamento direto'
);
select is(
  pg_temp.rows_affected($q$update public.comandas set notes = 'direto' where appointment_id = (select ap_troca from t48)$q$),
  0,
  'barbeiro nao atualiza Comanda direto'
);
select is(
  pg_temp.rows_affected($q$update public.comanda_itens set quantity = 9 where comanda_id in (select id from public.comandas where appointment_id = (select ap_troca from t48))$q$),
  0,
  'barbeiro nao atualiza Item de Comanda direto'
);
select is(
  pg_temp.rows_affected($q$update public.products set price = 1 where id = (select product_a from t48)$q$),
  0,
  'barbeiro nao atualiza produto'
);
select throws_ok(
  $$insert into public.waiting_list (tenant_id, name, phone) select tenant_a, 'Direto t48', '11966660182' from t48$$,
  '42501', null,
  'barbeiro nao insere na Lista de Espera'
);
select is(
  pg_temp.rows_affected($q$update public.waiting_list set status = 'scheduled' where id = (select w_ok from t48)$q$),
  0,
  'barbeiro nao atualiza a Lista de Espera'
);
select throws_ok(
  $$insert into public.customers (tenant_id, name, phone, cadastro_completo) select tenant_a, 'Direto t48', '11977770183', true from t48$$,
  '42501', null,
  'barbeiro nao insere cliente direto'
);
select is(
  pg_temp.rows_affected($q$update public.customers set name = 'Alterado' where id = (select customer_a from t48)$q$),
  0,
  'barbeiro nao atualiza cliente direto'
);
select is(
  pg_temp.rows_affected($q$update public.professional_services set is_enabled = false where professional_id = (select prof1 from t48)$q$),
  0,
  'barbeiro nao atualiza Associacao Profissional-Servico'
);
select is(
  pg_temp.rows_affected($q$delete from public.professional_services where professional_id = (select prof1 from t48)$q$),
  0,
  'barbeiro nao remove Associacao Profissional-Servico'
);

-- ---------------------------------------------------------------- barbeiro, leitura
select is(
  (select count(*)::integer from public.appointments where professional_id = (select prof2 from t48)),
  0,
  'barbeiro nao le agendamento do colega'
);
select is(
  (select (select count(*) from public.appointments where tenant_id = (select tenant_b from t48))
        + (select count(*) from public.customers where tenant_id = (select tenant_b from t48))
        + (select count(*) from public.services where tenant_id = (select tenant_b from t48))
        + (select count(*) from public.professionals where tenant_id = (select tenant_b from t48))
        + (select count(*) from public.comandas where tenant_id = (select tenant_b from t48))
        + (select count(*) from public.blocked_slots where tenant_id = (select tenant_b from t48)))::integer,
  0,
  'barbeiro nao le nenhuma linha da outra barbearia'
);

-- ---------------------------------------------------------------- barbeiro, Bloqueio de Horario
select lives_ok(
  $$insert into public.blocked_slots (tenant_id, professional_id, start_time, end_time, reason) select tenant_a, prof1, d2_1700, d2_1700 + interval '30 minutes', 'Almoco t48' from t48$$,
  'barbeiro cria Bloqueio de Horario na propria agenda'
);
select throws_ok(
  $$insert into public.blocked_slots (tenant_id, professional_id, start_time, end_time, reason) select tenant_a, prof2, d2_1700, d2_1700 + interval '30 minutes', 'Bloqueio t48' from t48$$,
  '42501', null,
  'barbeiro nao cria Bloqueio na agenda do colega'
);
select throws_ok(
  $$insert into public.blocked_slots (tenant_id, professional_id, start_time, end_time, reason) select tenant_b, prof_b, d2_1700, d2_1700 + interval '30 minutes', 'Bloqueio t48' from t48$$,
  '42501', null,
  'barbeiro nao cria Bloqueio em outra barbearia'
);
select is(
  pg_temp.rows_affected($q$delete from public.blocked_slots where professional_id = (select prof2 from t48)$q$),
  0,
  'barbeiro nao remove Bloqueio do colega'
);

-- ---------------------------------------------------------------- outros barbeiros
select set_config('request.jwt.claim.sub', (select u_barb_nulo::text from t48), true);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_a from t48))$$,
  '42501', 'Acesso negado para esta unidade.',
  'barbeiro sem barbearia e recusado ao criar'
);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_p2 from t48), (select tenant_a from t48), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'barbeiro sem barbearia e recusado ao cancelar'
);
select is(
  (select (select count(*) from public.appointments) + (select count(*) from public.customers) + (select count(*) from public.services) + (select count(*) from public.professionals))::integer,
  0,
  'barbeiro sem barbearia nao le nenhuma linha'
);
select set_config('request.jwt.claim.sub', (select u_barb_off::text from t48), true);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof3 from t48), p_customer_id => (select customer_a from t48))$$,
  '42501', 'Acesso negado.',
  'barbeiro desativado e recusado'
);
select set_config('request.jwt.claim.sub', (select u_barb_cruz::text from t48), true);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof_cruz from t48), p_customer_id => (select customer_a from t48))$$,
  '42501', 'Barbeiro só cria agendamento na própria agenda.',
  'vinculo cruzado (profissional de outra barbearia) e recusado'
);

-- ---------------------------------------------------------------- gestor e proprietario sem regressao
select set_config('request.jwt.claim.sub', (select u_ger::text from t48), true);
select lives_ok(
  $$select public.reschedule_appointment_by_manager((select ap_ger from t48), (select tenant_a from t48), (select d4_1100 from t48), (select prof2 from t48))$$,
  'gerente continua reagendando para outro profissional'
);
select is(
  (select professional_id from public.appointments where id = (select ap_ger from t48)),
  (select prof2 from t48),
  'profissional trocado pelo gerente'
);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d4_1400 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_a from t48), p_waiting_list_id => (select w_ok from t48))$$,
  'gerente continua consumindo a Lista de Espera ao criar'
);
select is(
  (select status from public.waiting_list where id = (select w_ok from t48)),
  'scheduled',
  'entrada da Lista de Espera consumida pelo gerente'
);
select is(
  pg_temp.rows_affected($q$update public.appointments set notes = 'gerente' where id = (select ap_troca from t48)$q$),
  1,
  'gerente continua escrevendo em agendamento da propria barbearia'
);
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t48), true);
select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_p2 from t48), (select tenant_a from t48), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente de outra barbearia segue recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t48), true);
select throws_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_a from t48))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente com tenant_id nulo segue recusado'
);
select set_config('request.jwt.claim.sub', (select u_prop::text from t48), true);
select lives_ok(
  $$select public.create_appointment_by_manager(p_tenant_id => (select tenant_a from t48), p_service_id => (select service_a from t48), p_start_time => (select d3_1500 from t48), p_professional_id => (select prof1 from t48), p_customer_id => (select customer_a from t48), p_is_fitting => true)$$,
  'proprietario segue operando qualquer barbearia'
);

select * from finish(true);
rollback;
