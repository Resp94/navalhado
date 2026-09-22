-- Spec 044, ticket 08: autoria do cancelamento protegida contra escrita direta.
--
-- appointments_update_policy deixa o gerente (e o proprietario, via is_saas_admin) atualizar
-- qualquer coluna de um Agendamento da propria barbearia, canceled_by e cancellation_reason
-- inclusive. So a politica de RLS nao restringe coluna; quem tiver a chave do gerente reescreve a
-- autoria sem passar pelas funcoes de cancelamento. A protecao e por privilegio de coluna (REVOKE
-- UPDATE em canceled_by e cancellation_reason de authenticated): as quatro funcoes de cancelamento
-- continuam gravando porque rodam SECURITY DEFINER como dono da tabela (postgres), que ignora
-- GRANT/REVOKE de coluna por ser dono. Nenhuma outra coluna perde o UPDATE.

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create temporary table t56 (
  tenant_a uuid not null,
  u_ger uuid not null,
  u_prop uuid not null,
  u_ses uuid not null,
  prof1 uuid not null,
  service_a uuid not null,
  cust1 uuid not null,
  cust2 uuid not null,
  token1 uuid not null,
  ap_direto1 uuid not null,
  ap_direto2 uuid not null,
  ap_notes uuid not null,
  ap_mgr uuid not null,
  ap_com uuid not null,
  ap_tok uuid not null,
  ap_ses uuid not null
) on commit drop;

insert into public.tenants (name, email, phone) values
  ('__t56_a__', '__t56_a__@teste.com', '11999999561');

insert into auth.users (id, email)
select gen_random_uuid(), '__t56_' || n || '__@teste.com'
from unnest(array['ger', 'prop', 'ses']) as n;

insert into t56
select
  (select id from public.tenants where name = '__t56_a__'),
  (select id from auth.users where email = '__t56_ger__@teste.com'),
  (select id from auth.users where email = '__t56_prop__@teste.com'),
  (select id from auth.users where email = '__t56_ses__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t56 t where u.id = t.u_ger;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t56 t where u.id = t.u_prop;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select t.prof1, t.tenant_a, 'Prof1 t56', '11988880561', 10, true, null from t56 t;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active)
select t.service_a, t.tenant_a, 'Servico t56', 50, 'fixed', 'corte', true from t56 t;

insert into public.customers (id, tenant_id, name, phone, cadastro_completo, token_acesso)
select v.id, t.tenant_a, v.nome, v.fone, true, v.tok
from t56 t, lateral (values
  (t.cust1, 'Cliente 1 t56', '11977770561', t.token1),
  (t.cust2, 'Cliente 2 t56', '11977770562', gen_random_uuid())
) as v(id, nome, fone, tok);

insert into public.public_customer_sessions (auth_user_id, tenant_id, customer_id)
select t.u_ses, t.tenant_a, t.cust2 from t56 t;

-- is_fitting = true dispensa a validacao de expediente; horarios distintos evitam sobreposicao.
insert into public.appointments (id, tenant_id, customer_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select v.id, t.tenant_a, v.cust, t.prof1, t.service_a, v.inicio, v.inicio + interval '30 minutes', 'confirmed', 'pending', 'manual', true
from t56 t,
  lateral (values
    (t.ap_direto1, t.cust1, now() + interval '5 hours'),
    (t.ap_direto2, t.cust1, now() + interval '6 hours'),
    (t.ap_notes, t.cust1, now() + interval '7 hours'),
    (t.ap_mgr, t.cust1, now() + interval '8 hours'),
    (t.ap_com, t.cust1, now() + interval '9 hours'),
    (t.ap_tok, t.cust1, now() + interval '10 hours'),
    (t.ap_ses, t.cust2, now() + interval '11 hours')
  ) as v(id, cust, inicio);

grant select on t56 to authenticated;

-- ---------------------------------------------------------------------------
-- Escrita direta na autoria e no motivo: recusada pelo banco, para os dois papeis que a politica
-- de UPDATE alcanca.
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', (select u_ger::text from t56), true);
set local role authenticated;

select throws_ok(
  $$update public.appointments set canceled_by = 'shop' where id = (select ap_direto1 from t56)$$,
  '42501',
  null,
  'Gerente: escrita direta na autoria e recusada'
);
select throws_ok(
  $$update public.appointments set cancellation_reason = 'Forjado' where id = (select ap_direto1 from t56)$$,
  '42501',
  null,
  'Gerente: escrita direta no motivo e recusada'
);

reset role;
select set_config('request.jwt.claim.sub', (select u_prop::text from t56), true);
set local role authenticated;

select throws_ok(
  $$update public.appointments set canceled_by = 'shop' where id = (select ap_direto2 from t56)$$,
  '42501',
  null,
  'Proprietario (admin SaaS): escrita direta na autoria e recusada'
);
select throws_ok(
  $$update public.appointments set cancellation_reason = 'Forjado' where id = (select ap_direto2 from t56)$$,
  '42501',
  null,
  'Proprietario (admin SaaS): escrita direta no motivo e recusada'
);

-- ---------------------------------------------------------------------------
-- Controle: a protecao alcanca so as duas colunas; o gerente continua atualizando o resto direto.
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claim.sub', (select u_ger::text from t56), true);
set local role authenticated;

select lives_ok(
  $$update public.appointments set notes = 'Observacao legitima' where id = (select ap_notes from t56)$$,
  'Gerente: atualizacao legitima em outra coluna continua funcionando'
);
select is(
  (select notes from public.appointments where id = (select ap_notes from t56)),
  'Observacao legitima',
  'A atualizacao legitima realmente gravou'
);

-- ---------------------------------------------------------------------------
-- As quatro funcoes de cancelamento continuam gravando autoria e motivo: rodam SECURITY DEFINER
-- como dono da tabela, que ignora o REVOKE de coluna.
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select public.cancel_appointment_by_manager((select ap_mgr from t56), (select tenant_a from t56), 'Barbearia fechou mais cedo')$$,
  'RPC do gestor continua cancelando'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_mgr from t56)),
  'shop',
  'RPC do gestor continua gravando autoria'
);
select is(
  (select cancellation_reason from public.appointments where id = (select ap_mgr from t56)),
  'Barbearia fechou mais cedo',
  'RPC do gestor continua gravando motivo'
);

select lives_ok(
  $$select public.cancel_comanda_appointment(null, (select ap_com from t56), (select tenant_a from t56), 'Motivo t56')$$,
  'RPC da Comanda continua cancelando'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_com from t56)),
  'shop',
  'RPC da Comanda continua gravando autoria'
);

reset role;

select lives_ok(
  $$select public.cancel_appointment_by_token((select token1 from t56), (select ap_tok from t56), 'Fiquei doente')$$,
  'RPC por token continua cancelando'
);
select is(
  (select canceled_by from public.appointments where id = (select ap_tok from t56)),
  'customer',
  'RPC por token continua gravando autoria'
);

select set_config('request.jwt.claim.sub', (select u_ses::text from t56), true);
select set_config('request.jwt.claims', json_build_object('sub', (select u_ses from t56), 'role', 'authenticated', 'is_anonymous', true)::text, true);
set local role authenticated;

select lives_ok(
  $$select public.cancel_appointment_by_public_session((select ap_ses from t56), 'Cancelado pelo cliente')$$,
  'RPC por sessao publica continua cancelando'
);

reset role;
select is(
  (select canceled_by from public.appointments where id = (select ap_ses from t56)),
  'customer',
  'RPC por sessao publica continua gravando autoria'
);

select * from finish(true);
rollback;
