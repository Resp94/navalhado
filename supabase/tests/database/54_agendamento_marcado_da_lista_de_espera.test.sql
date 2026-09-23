-- Spec 043, ticket 07: o Agendamento criado a partir da Lista de Espera fica marcado no banco.
--
-- Antes, a unica marca era o texto [Fila de Espera] no inicio da nota: dado estruturado disfarcado de
-- texto livre, que a recepcao podia apagar e que nenhuma consulta enxergava. A marca passa a ser uma
-- coluna propria, gravada pela mesma RPC que ja baixa a entrada, dentro da mesma transacao. Nao usa
-- origin, que descreve o canal de entrada e alimenta o relatorio por origem.

begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

create temporary table t54 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_ger_a uuid not null,
  u_ger_b uuid not null,
  u_ger_nulo uuid not null,
  u_barb uuid not null,
  prof1 uuid not null,
  service_a uuid not null,
  service_b uuid not null,
  customer_a uuid not null,
  w_ok uuid not null,
  w_usada uuid not null,
  w_iso uuid not null,
  w_b uuid not null,
  t_1 timestamptz not null,
  t_2 timestamptz not null,
  t_3 timestamptz not null,
  t_4 timestamptz not null,
  t_5 timestamptz not null,
  t_6 timestamptz not null
) on commit drop;

create temporary table res54 (rotulo text not null, appointment_id uuid not null) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t54_a__', '__t54_a__@teste.com', '11999999541'),
  ('__t54_b__', '__t54_b__@teste.com', '11999999542');

insert into auth.users (id, email)
select gen_random_uuid(), '__t54_' || n || '__@teste.com'
from unnest(array['gera', 'gerb', 'gernulo', 'barb']) as n;

insert into t54
select
  (select id from public.tenants where name = '__t54_a__'),
  (select id from public.tenants where name = '__t54_b__'),
  (select id from auth.users where email = '__t54_gera__@teste.com'),
  (select id from auth.users where email = '__t54_gerb__@teste.com'),
  (select id from auth.users where email = '__t54_gernulo__@teste.com'),
  (select id from auth.users where email = '__t54_barb__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  now() + interval '20 hours', now() + interval '21 hours', now() + interval '22 hours',
  now() + interval '23 hours', now() + interval '24 hours', now() + interval '25 hours';

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t54 t where u.id = t.u_ger_a;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t54 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t54 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t54 t where u.id = t.u_barb;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof1, t.tenant_a, 'Prof1 t54', '11988880541', 10, true, t.u_barb from t54 t;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active, duration_minutes)
select v.id, v.tenant, v.nome, 50, 'fixed', 'corte', true, 30
from t54 t, lateral (values (t.service_a, t.tenant_a, 'Servico A t54'), (t.service_b, t.tenant_b, 'Servico B t54')) as v(id, tenant, nome);

insert into public.customers (id, tenant_id, name, phone, cadastro_completo)
select t.customer_a, t.tenant_a, 'Cliente A t54', '11977770541', true from t54 t;

insert into public.waiting_list (id, tenant_id, name, phone, status)
select v.id, v.tenant, v.nome, v.fone, v.st
from t54 t, lateral (values
  (t.w_ok, t.tenant_a, 'Espera ok t54', '11966660541', 'waiting'),
  (t.w_usada, t.tenant_a, 'Espera usada t54', '11966660542', 'scheduled'),
  (t.w_iso, t.tenant_a, 'Espera iso t54', '11966660543', 'waiting'),
  (t.w_b, t.tenant_b, 'Espera B t54', '11966660544', 'waiting')
) as v(id, tenant, nome, fone, st);

grant select on t54 to authenticated;
grant select, insert on res54 to authenticated;

-- ---------------------------------------------------------------------------
-- Estrutura
-- ---------------------------------------------------------------------------

select has_column('public', 'appointments', 'from_waiting_list', 'O Agendamento tem indicador de que veio da Lista de Espera');
select col_type_is('public', 'appointments', 'from_waiting_list', 'boolean', 'O indicador e booleano');
select col_not_null('public', 'appointments', 'from_waiting_list', 'O indicador nunca e nulo: ou veio da fila ou nao veio');
select col_default_is('public', 'appointments', 'from_waiting_list', 'false', 'Por padrao o Agendamento nao veio da fila');

-- ---------------------------------------------------------------------------
-- Gerente cria o Agendamento a partir de uma entrada da Lista de Espera
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_ger_a::text from t54), true);
set local role authenticated;

select lives_ok(
  $$insert into res54 select 'da_fila', (public.create_appointment_by_manager(
      p_tenant_id => (select tenant_a from t54), p_service_id => (select service_a from t54),
      p_start_time => (select t_1 from t54), p_professional_id => (select prof1 from t54),
      p_customer_id => (select customer_a from t54), p_is_fitting => true,
      p_waiting_list_id => (select w_ok from t54)
    )->>'appointment_id')::uuid$$,
  'Gerente cria o encaixe consumindo a entrada da Lista de Espera'
);
select is(
  (select a.from_waiting_list from public.appointments a where a.id = (select appointment_id from res54 where rotulo = 'da_fila')),
  true,
  'O Agendamento criado a partir da fila fica marcado'
);
select is(
  (select w.status from public.waiting_list w where w.id = (select w_ok from t54)),
  'scheduled',
  'A entrada e baixada na mesma operacao'
);

select lives_ok(
  $$insert into res54 select 'avulso', (public.create_appointment_by_manager(
      p_tenant_id => (select tenant_a from t54), p_service_id => (select service_a from t54),
      p_start_time => (select t_2 from t54), p_professional_id => (select prof1 from t54),
      p_customer_id => (select customer_a from t54), p_is_fitting => true
    )->>'appointment_id')::uuid$$,
  'Gerente cria um encaixe avulso, sem entrada da fila'
);
select is(
  (select a.from_waiting_list from public.appointments a where a.id = (select appointment_id from res54 where rotulo = 'avulso')),
  false,
  'O encaixe avulso nao fica marcado como vindo da fila'
);

-- ---------------------------------------------------------------------------
-- Atomicidade: entrada ja usada recusa e nao deixa Agendamento marcado para tras
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.create_appointment_by_manager(
      p_tenant_id => (select tenant_a from t54), p_service_id => (select service_a from t54),
      p_start_time => (select t_3 from t54), p_professional_id => (select prof1 from t54),
      p_customer_id => (select customer_a from t54), p_is_fitting => true,
      p_waiting_list_id => (select w_usada from t54))$$,
  'P0001', 'Esta entrada da Lista de Espera não está mais aguardando.',
  'Entrada que nao esta mais aguardando e recusada'
);
select is(
  (select count(*)::int from public.appointments a where a.tenant_id = (select tenant_a from t54) and a.from_waiting_list),
  1,
  'A recusa desfaz o insert: nenhum Agendamento marcado fica para tras'
);

-- ---------------------------------------------------------------------------
-- Remarcar mantem a marca
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.reschedule_appointment_by_manager(
      (select appointment_id from res54 where rotulo = 'da_fila'), (select tenant_a from t54),
      (select t_4 from t54), null)$$,
  'Gerente remarca o Agendamento vindo da fila'
);
select is(
  (select a.from_waiting_list from public.appointments a where a.id = (select appointment_id from res54 where rotulo = 'da_fila')),
  true,
  'Remarcar mantem a marca de que veio da fila'
);

-- ---------------------------------------------------------------------------
-- Isolamento da RPC alterada
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t54), true);
set local role authenticated;

select throws_ok(
  $$select public.create_appointment_by_manager(
      p_tenant_id => (select tenant_a from t54), p_service_id => (select service_a from t54),
      p_start_time => (select t_5 from t54), p_professional_id => (select prof1 from t54),
      p_customer_id => (select customer_a from t54), p_is_fitting => true,
      p_waiting_list_id => (select w_iso from t54))$$,
  '42501', null,
  'Gerente de outra barbearia nao consome a fila da barbearia A'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t54), true);
set local role authenticated;

select throws_ok(
  $$select public.create_appointment_by_manager(
      p_tenant_id => (select tenant_a from t54), p_service_id => (select service_a from t54),
      p_start_time => (select t_5 from t54), p_professional_id => (select prof1 from t54),
      p_customer_id => (select customer_a from t54), p_is_fitting => true,
      p_waiting_list_id => (select w_iso from t54))$$,
  '42501', null,
  'Gerente com barbearia nula nao consome a fila'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_barb::text from t54), true);
set local role authenticated;

select throws_ok(
  $$select public.create_appointment_by_manager(
      p_tenant_id => (select tenant_a from t54), p_service_id => (select service_a from t54),
      p_start_time => (select t_5 from t54), p_professional_id => (select prof1 from t54),
      p_customer_id => (select customer_a from t54), p_is_fitting => true,
      p_waiting_list_id => (select w_iso from t54))$$,
  '42501', 'Barbeiro não consome a Lista de Espera.',
  'Barbeiro nao consome a Lista de Espera'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_ger_a::text from t54), true);
set local role authenticated;

select throws_ok(
  $$select public.create_appointment_by_manager(
      p_tenant_id => (select tenant_a from t54), p_service_id => (select service_a from t54),
      p_start_time => (select t_6 from t54), p_professional_id => (select prof1 from t54),
      p_customer_id => (select customer_a from t54), p_is_fitting => true,
      p_waiting_list_id => (select w_b from t54))$$,
  'P0001', 'Esta entrada da Lista de Espera não está mais aguardando.',
  'Gerente nao consome entrada de outra barbearia informando o proprio tenant'
);

reset role;

select is(
  (select w.status from public.waiting_list w where w.id = (select w_iso from t54)) || '/' ||
  (select count(*)::text from public.appointments a where a.tenant_id = (select tenant_a from t54) and a.from_waiting_list),
  'waiting/1',
  'Depois de todas as recusas a entrada segue aguardando e so ha um Agendamento marcado'
);

select * from finish();
rollback;
