-- Spec 044, ticket 07: cancelamento pela tela de Comandas grava o Motivo de Cancelamento.
--
-- public.cancel_comanda_appointment cancela a Comanda e o Agendamento juntos. Ate aqui gravava
-- autoria (ticket 06 da spec 043) mas nao motivo. Cobre: motivo gravado quando ha Agendamento,
-- motivo em branco/so espaco recusado, atomicidade mantida na recusa, comanda de balcao (sem
-- Agendamento) continua sem exigir motivo, e isolamento por barbearia intacto.

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create temporary table t55 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger uuid not null,
  u_ger_b uuid not null,
  u_ger_nulo uuid not null,
  u_barb uuid not null,
  prof1 uuid not null,
  service_a uuid not null,
  cust1 uuid not null,
  ap_com uuid not null,
  ap_branco uuid not null,
  ap_espaco uuid not null,
  ap_iso uuid not null,
  com_com uuid not null,
  com_branco uuid not null,
  com_espaco uuid not null,
  com_iso uuid not null,
  com_balcao uuid not null
) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t55_a__', '__t55_a__@teste.com', '11999999551'),
  ('__t55_b__', '__t55_b__@teste.com', '11999999552');

insert into auth.users (id, email)
select gen_random_uuid(), '__t55_' || n || '__@teste.com'
from unnest(array['ger', 'gerb', 'gernulo', 'barb']) as n;

insert into t55
select
  (select id from public.tenants where name = '__t55_a__'),
  (select id from public.tenants where name = '__t55_b__'),
  (select id from auth.users where email = '__t55_ger__@teste.com'),
  (select id from auth.users where email = '__t55_gerb__@teste.com'),
  (select id from auth.users where email = '__t55_gernulo__@teste.com'),
  (select id from auth.users where email = '__t55_barb__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t55 t where u.id = t.u_ger;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t55 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t55 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t55 t where u.id = t.u_barb;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof1, t.tenant_a, 'Prof1 t55', '11988880551', 10, true, t.u_barb from t55 t;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active)
select t.service_a, t.tenant_a, 'Servico t55', 50, 'fixed', 'corte', true from t55 t;

insert into public.customers (id, tenant_id, name, phone, cadastro_completo)
select t.cust1, t.tenant_a, 'Cliente 1 t55', '11977770551', true from t55 t;

-- is_fitting = true dispensa a validacao de expediente; horarios distintos evitam sobreposicao.
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select v.id, t.tenant_a, t.cust1, t.prof1, t.service_a, v.inicio, v.inicio + interval '30 minutes', 'confirmed', 'pending', 'manual', true
from t55 t,
  lateral (values
    (t.ap_com, now() + interval '5 hours'),
    (t.ap_branco, now() + interval '6 hours'),
    (t.ap_espaco, now() + interval '7 hours'),
    (t.ap_iso, now() + interval '8 hours')
  ) as v(id, inicio);

-- O gatilho trg_auto_create_comanda_for_appointment ja cria a Comanda 'aberta' de cada Agendamento;
-- inserir aqui de novo violaria a unicidade de Comanda aberta por Agendamento. So capturamos os ids.
update t55 t set com_com = c.id from public.comandas c where c.appointment_id = t.ap_com;
update t55 t set com_branco = c.id from public.comandas c where c.appointment_id = t.ap_branco;
update t55 t set com_espaco = c.id from public.comandas c where c.appointment_id = t.ap_espaco;
update t55 t set com_iso = c.id from public.comandas c where c.appointment_id = t.ap_iso;

-- Comanda de balcao: sem Agendamento vinculado.
insert into public.comandas (id, tenant_id, appointment_id, customer_id, status)
select t.com_balcao, t.tenant_a, null, t.cust1, 'aberta' from t55 t;

grant select on t55 to authenticated;

-- ---------------------------------------------------------------------------
-- Motivo gravado quando ha Agendamento
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_ger::text from t55), true);
set local role authenticated;

select lives_ok(
  $$select public.cancel_comanda_appointment((select com_com from t55), (select ap_com from t55), (select tenant_a from t55), 'Cliente pediu para cancelar')$$,
  'Gerente cancela Comanda e Agendamento juntos, informando o motivo'
);
select is(
  (select cancellation_reason from public.appointments where id = (select ap_com from t55)),
  'Cliente pediu para cancelar',
  'O motivo informado e gravado no Agendamento'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_com from t55)),
  'shop',
  'A autoria continua sendo a da barbearia'
);
select is(
  (select status from public.comandas where id = (select com_com from t55)),
  'cancelada',
  'A Comanda e cancelada na mesma operacao'
);

-- ---------------------------------------------------------------------------
-- Motivo em branco ou so espaco: recusado, nada muda (atomicidade)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.cancel_comanda_appointment((select com_branco from t55), (select ap_branco from t55), (select tenant_a from t55), '')$$,
  'P0001', 'Informe o motivo do cancelamento.',
  'Motivo em branco e recusado'
);
select throws_ok(
  $$select public.cancel_comanda_appointment((select com_espaco from t55), (select ap_espaco from t55), (select tenant_a from t55), '   ')$$,
  'P0001', 'Informe o motivo do cancelamento.',
  'Motivo so com espaco e recusado'
);
select is(
  (select status from public.appointments where id = (select ap_branco from t55)),
  'confirmed',
  'Recusa por motivo em branco nao altera o Agendamento'
);
select is(
  (select status from public.comandas where id = (select com_branco from t55)),
  'aberta',
  'Recusa por motivo em branco nao altera a Comanda (atomicidade)'
);

-- ---------------------------------------------------------------------------
-- Comanda de balcao, sem Agendamento: continua sem exigir motivo
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.cancel_comanda_appointment((select com_balcao from t55), null, (select tenant_a from t55))$$,
  'Comanda de balcao, sem agendamento, cancela sem motivo'
);
select is(
  (select status from public.comandas where id = (select com_balcao from t55)),
  'cancelada',
  'Comanda de balcao e cancelada mesmo sem motivo'
);

-- ---------------------------------------------------------------------------
-- Isolamento: acesso recusado nao grava nada, mesmo com motivo informado
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_barb::text from t55), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_comanda_appointment((select com_iso from t55), (select ap_iso from t55), (select tenant_a from t55), 'Motivo')$$,
  '42501', 'Acesso negado para cancelar atendimento.',
  'Isolamento: barbeiro e recusado mesmo informando motivo'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t55), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_comanda_appointment((select com_iso from t55), (select ap_iso from t55), (select tenant_a from t55), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'Isolamento: gerente de outra barbearia e recusado'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t55), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_comanda_appointment((select com_iso from t55), (select ap_iso from t55), (select tenant_a from t55), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'Isolamento: gerente com barbearia nula e recusado'
);

reset role;
select is(
  (select status from public.appointments where id = (select ap_iso from t55)),
  'confirmed',
  'Isolamento: acesso recusado nao altera o Agendamento'
);
select is(
  (select cancellation_reason from public.appointments where id = (select ap_iso from t55)),
  null,
  'Isolamento: acesso recusado nao grava motivo'
);

select * from finish(true);
rollback;
