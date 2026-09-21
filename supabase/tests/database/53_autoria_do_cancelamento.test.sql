-- Spec 043, ticket 06: autoria do cancelamento.
--
-- Cada Agendamento cancelado passa a guardar quem cancelou, com dominio fechado (shop ou customer),
-- gravado exclusivamente pelas RPCs de cancelamento. Cobre as quatro que gravam status canceled: a
-- do gestor (usada pela Agenda e pela Minha Agenda), as duas do Canal do Cliente e a que cancela a
-- Comanda junto com o Agendamento. Nao ha backfill: cancelamento anterior fica com autoria nula.
-- Cada RPC alterada tem asserção de isolamento, incluindo o gerente com barbearia nula.

begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create temporary table t53 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger uuid not null,
  u_ger_b uuid not null,
  u_ger_nulo uuid not null,
  u_barb uuid not null,
  u_ses uuid not null,
  prof1 uuid not null,
  service_a uuid not null,
  cust1 uuid not null,
  cust2 uuid not null,
  token1 uuid not null,
  token2 uuid not null,
  ap_mgr uuid not null,
  ap_com uuid not null,
  ap_tok uuid not null,
  ap_ses uuid not null,
  ap_ativo uuid not null,
  ap_iso_mgr uuid not null,
  ap_iso_com uuid not null,
  ap_iso_tok uuid not null,
  ap_iso_ses uuid not null
) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t53_a__', '__t53_a__@teste.com', '11999999531'),
  ('__t53_b__', '__t53_b__@teste.com', '11999999532');

insert into auth.users (id, email)
select gen_random_uuid(), '__t53_' || n || '__@teste.com'
from unnest(array['ger', 'gerb', 'gernulo', 'barb', 'ses']) as n;

insert into t53
select
  (select id from public.tenants where name = '__t53_a__'),
  (select id from public.tenants where name = '__t53_b__'),
  (select id from auth.users where email = '__t53_ger__@teste.com'),
  (select id from auth.users where email = '__t53_gerb__@teste.com'),
  (select id from auth.users where email = '__t53_gernulo__@teste.com'),
  (select id from auth.users where email = '__t53_barb__@teste.com'),
  (select id from auth.users where email = '__t53_ses__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t53 t where u.id = t.u_ger;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t53 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t53 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t53 t where u.id = t.u_barb;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof1, t.tenant_a, 'Prof1 t53', '11988880531', 10, true, t.u_barb from t53 t;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active)
select t.service_a, t.tenant_a, 'Servico t53', 50, 'fixed', 'corte', true from t53 t;

insert into public.customers (id, tenant_id, name, phone, cadastro_completo, token_acesso)
select v.id, t.tenant_a, v.nome, v.fone, true, v.tok
from t53 t, lateral (values
  (t.cust1, 'Cliente 1 t53', '11977770531', t.token1),
  (t.cust2, 'Cliente 2 t53', '11977770532', t.token2)
) as v(id, nome, fone, tok);

insert into public.public_customer_sessions (auth_user_id, tenant_id, customer_id)
select t.u_ses, t.tenant_a, t.cust2 from t53 t;

-- is_fitting = true dispensa a validacao de expediente; horarios distintos evitam sobreposicao.
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select v.id, t.tenant_a, v.cust, t.prof1, t.service_a, v.inicio, v.inicio + interval '30 minutes', 'confirmed', 'pending', 'manual', true
from t53 t,
  lateral (values
    (t.ap_mgr, t.cust1, now() + interval '5 hours'),
    (t.ap_com, t.cust1, now() + interval '6 hours'),
    (t.ap_tok, t.cust1, now() + interval '7 hours'),
    (t.ap_ses, t.cust2, now() + interval '8 hours'),
    (t.ap_ativo, t.cust1, now() + interval '9 hours'),
    (t.ap_iso_mgr, t.cust1, now() + interval '10 hours'),
    (t.ap_iso_com, t.cust1, now() + interval '11 hours'),
    (t.ap_iso_tok, t.cust2, now() + interval '12 hours'),
    (t.ap_iso_ses, t.cust1, now() + interval '13 hours')
  ) as v(id, cust, inicio);

grant select on t53 to authenticated;

-- ---------------------------------------------------------------------------
-- Estrutura e dominio
-- ---------------------------------------------------------------------------

select has_column('public', 'appointments', 'canceled_by', 'O Agendamento tem coluna de autoria do cancelamento');
select col_type_is('public', 'appointments', 'canceled_by', 'text', 'A autoria e texto com dominio fechado');

select throws_ok(
  $$update public.appointments set canceled_by = 'ninguem' where id = (select ap_ativo from t53)$$,
  '23514',
  null,
  'A restricao de verificacao recusa autoria fora do dominio'
);

select is(
  (select canceled_by from public.appointments where id = (select ap_ativo from t53)),
  null,
  'Agendamento nao cancelado mantem autoria nula'
);

-- ---------------------------------------------------------------------------
-- Gestor: a RPC usada pela Agenda do gerente e pela Minha Agenda do barbeiro
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_ger::text from t53), true);
set local role authenticated;

select lives_ok(
  $$select public.cancel_appointment_by_manager((select ap_mgr from t53), (select tenant_a from t53), 'Barbearia fechou mais cedo')$$,
  'Gerente cancela pela RPC do gestor'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_mgr from t53)),
  'shop',
  'O cancelamento pela RPC do gestor grava autoria de barbearia'
);

-- ---------------------------------------------------------------------------
-- Cancelamento pela Comanda: quarto caminho que grava canceled
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.cancel_comanda_appointment(null, (select ap_com from t53), (select tenant_a from t53))$$,
  'Gerente cancela o Agendamento pela Comanda'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_com from t53)),
  'shop',
  'O cancelamento pela Comanda grava autoria de barbearia'
);

-- ---------------------------------------------------------------------------
-- Canal do Cliente por token: a autoria vale mesmo com motivo proprio do cliente
-- ---------------------------------------------------------------------------

reset role;

select lives_ok(
  $$select public.cancel_appointment_by_token((select token1 from t53), (select ap_tok from t53), 'Fiquei doente')$$,
  'Cliente cancela pelo link com token'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_tok from t53)),
  'customer',
  'O cancelamento por token grava autoria de cliente'
);
select is(
  (select cancellation_reason from public.appointments where id = (select ap_tok from t53)),
  'Fiquei doente',
  'A autoria e gravada mesmo com motivo proprio; o motivo continua sendo o que o cliente escreveu'
);

-- ---------------------------------------------------------------------------
-- Canal do Cliente por sessao publica
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_ses::text from t53), true);
select set_config('request.jwt.claims', json_build_object('sub', (select u_ses from t53), 'role', 'authenticated', 'is_anonymous', true)::text, true);
set local role authenticated;

select lives_ok(
  $$select public.cancel_appointment_by_public_session((select ap_ses from t53), 'Cancelado pelo cliente')$$,
  'Cliente cancela pela sessao publica'
);

-- A leitura e feita sem o papel da sessao anonima do cliente, que pela politica de leitura nao
-- enxerga o Agendamento; lida com ele, o nulo seria linha invisivel e nao autoria ausente.
reset role;

select is(
  (select canceled_by from public.appointments where id = (select ap_ses from t53)),
  'customer',
  'O cancelamento por sessao publica grava autoria de cliente'
);

-- ---------------------------------------------------------------------------
-- Isolamento: gestor. Nada e gravado quando o acesso e recusado.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t53), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_iso_mgr from t53), (select tenant_a from t53), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'RPC do gestor: gerente de outra barbearia e recusado'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t53), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_appointment_by_manager((select ap_iso_mgr from t53), (select tenant_a from t53), 'Motivo')$$,
  '42501', 'Acesso negado para esta unidade.',
  'RPC do gestor: gerente com barbearia nula e recusado'
);

reset role;
select is(
  (select canceled_by from public.appointments where id = (select ap_iso_mgr from t53)),
  null,
  'RPC do gestor: o acesso recusado nao grava autoria'
);

-- ---------------------------------------------------------------------------
-- Isolamento: cancelamento pela Comanda
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_barb::text from t53), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_comanda_appointment(null, (select ap_iso_com from t53), (select tenant_a from t53))$$,
  '42501', 'Acesso negado para cancelar atendimento.',
  'Cancelamento pela Comanda: barbeiro e recusado'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t53), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_comanda_appointment(null, (select ap_iso_com from t53), (select tenant_a from t53))$$,
  '42501', 'Acesso negado para esta unidade.',
  'Cancelamento pela Comanda: gerente de outra barbearia e recusado'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t53), true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_comanda_appointment(null, (select ap_iso_com from t53), (select tenant_a from t53))$$,
  '42501', 'Acesso negado para esta unidade.',
  'Cancelamento pela Comanda: gerente com barbearia nula e recusado'
);

reset role;
select is(
  (select canceled_by from public.appointments where id = (select ap_iso_com from t53)),
  null,
  'Cancelamento pela Comanda: o acesso recusado nao grava autoria'
);

-- ---------------------------------------------------------------------------
-- Isolamento: Canal do Cliente por token
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.cancel_appointment_by_token((select token1 from t53), (select ap_iso_tok from t53), 'Motivo')$$,
  'P0001', 'Agendamento não encontrado ou não pertence a este cliente.',
  'Por token: o token de um cliente nao cancela o Agendamento de outro'
);
select throws_ok(
  $$select public.cancel_appointment_by_token(gen_random_uuid(), (select ap_iso_tok from t53), 'Motivo')$$,
  'P0001', 'Cliente não encontrado ou token inválido.',
  'Por token: token inexistente e recusado'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_iso_tok from t53)),
  null,
  'Por token: o acesso recusado nao grava autoria'
);

-- ---------------------------------------------------------------------------
-- Isolamento: Canal do Cliente por sessao publica
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_ses::text from t53), true);
select set_config('request.jwt.claims', json_build_object('sub', (select u_ses from t53), 'role', 'authenticated', 'is_anonymous', true)::text, true);
set local role authenticated;

select throws_ok(
  $$select public.cancel_appointment_by_public_session((select ap_iso_ses from t53), 'Motivo')$$,
  'P0001', 'Agendamento não encontrado ou não pertence a este cliente.',
  'Por sessao publica: a sessao de um cliente nao cancela o Agendamento de outro'
);

reset role;
select is(
  (select canceled_by from public.appointments where id = (select ap_iso_ses from t53)),
  null,
  'Por sessao publica: o acesso recusado nao grava autoria'
);

select * from finish();
rollback;
