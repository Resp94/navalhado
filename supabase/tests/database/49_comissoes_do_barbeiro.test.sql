begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Spec 041, ticket 03: o barbeiro ve a comissao gravada, so a dele, e nunca cruza a barbearia.

create temporary table t49 (
  tenant_a uuid not null,
  tenant_b uuid not null,
  u_barb1 uuid not null,
  u_barb2 uuid not null,
  u_barb_b uuid not null,
  u_cruz uuid not null,
  u_inativo uuid not null,
  u_ger_a uuid not null,
  u_ger_b uuid not null,
  u_ger_nulo uuid not null,
  u_prop uuid not null,
  prof1 uuid not null,
  prof2 uuid not null,
  prof_b uuid not null,
  prof_inativo uuid not null,
  prof_cruz uuid not null,
  srv_a uuid not null,
  srv_b uuid not null,
  cust_a uuid not null,
  c1 uuid not null,
  c2 uuid not null,
  c3 uuid not null,
  c_b uuid not null,
  i1 uuid not null,
  i2 uuid not null,
  i3 uuid not null,
  i4 uuid not null,
  i_b uuid not null
) on commit drop;

insert into public.tenants (name, email, phone)
values
  ('__t49_a__', '__t49_a__@teste.com', '11999999491'),
  ('__t49_b__', '__t49_b__@teste.com', '11999999492');

insert into auth.users (id, email)
select gen_random_uuid(), '__t49_' || n || '__@teste.com'
from unnest(array['barb1','barb2','barbb','cruz','inativo','gera','gerb','gernulo','prop']) as n;

insert into t49
select
  (select id from public.tenants where name = '__t49_a__'),
  (select id from public.tenants where name = '__t49_b__'),
  (select id from auth.users where email = '__t49_barb1__@teste.com'),
  (select id from auth.users where email = '__t49_barb2__@teste.com'),
  (select id from auth.users where email = '__t49_barbb__@teste.com'),
  (select id from auth.users where email = '__t49_cruz__@teste.com'),
  (select id from auth.users where email = '__t49_inativo__@teste.com'),
  (select id from auth.users where email = '__t49_gera__@teste.com'),
  (select id from auth.users where email = '__t49_gerb__@teste.com'),
  (select id from auth.users where email = '__t49_gernulo__@teste.com'),
  (select id from auth.users where email = '__t49_prop__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t49 t where u.id = t.u_barb1;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t49 t where u.id = t.u_barb2;
update public.users u set tenant_id = t.tenant_b, role = 'barbeiro', is_active = true from t49 t where u.id = t.u_barb_b;
-- vinculo cruzado: usuario da barbearia A apontando para o profissional da barbearia B
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t49 t where u.id = t.u_cruz;
update public.users u set tenant_id = t.tenant_a, role = 'barbeiro', is_active = true from t49 t where u.id = t.u_inativo;
update public.users u set tenant_id = t.tenant_a, role = 'gerente', is_active = true from t49 t where u.id = t.u_ger_a;
update public.users u set tenant_id = t.tenant_b, role = 'gerente', is_active = true from t49 t where u.id = t.u_ger_b;
update public.users u set tenant_id = null, role = 'gerente', is_active = true from t49 t where u.id = t.u_ger_nulo;
update public.users u set tenant_id = null, role = 'proprietario', is_active = true from t49 t where u.id = t.u_prop;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select v.id, v.tenant, v.nome, v.fone, 10, v.ativo, v.usr
from t49 t,
  lateral (values
    (t.prof1, t.tenant_a, 'Prof1 t49', '11988880491', true, t.u_barb1),
    (t.prof2, t.tenant_a, 'Prof2 t49', '11988880492', true, t.u_barb2),
    (t.prof_b, t.tenant_b, 'ProfB t49', '11988880493', true, t.u_barb_b),
    (t.prof_inativo, t.tenant_a, 'ProfInativo t49', '11988880494', false, t.u_inativo)
  ) as v(id, tenant, nome, fone, ativo, usr);

-- o usuario u_cruz esta ligado ao profissional da outra barbearia
insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active, user_id)
select prof_cruz, tenant_b, 'ProfCruz t49', '11988880495', 10, true, u_cruz from t49;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active)
select v.id, v.tenant, v.nome, 50, 'fixed', 'corte', true
from t49 t, lateral (values (t.srv_a, t.tenant_a, 'Servico A t49'), (t.srv_b, t.tenant_b, 'Servico B t49')) as v(id, tenant, nome);

insert into public.customers (id, tenant_id, name, phone, cadastro_completo)
select cust_a, tenant_a, 'Cliente A t49', '11977770491', true from t49;

-- Comandas ja fechadas: as insercoes diretas nao disparam os gatilhos de fechamento (so UPDATE).
insert into public.comandas (id, tenant_id, customer_id, status, total_amount, discount_amount, tip_amount, closed_at)
select v.id, v.tenant, v.cust, 'fechada', 50, 0, 0, v.closed
from t49 t,
  lateral (values
    (t.c1, t.tenant_a, t.cust_a, now() - interval '2 days'),
    (t.c2, t.tenant_a, t.cust_a, now() - interval '1 day'),
    (t.c3, t.tenant_a, t.cust_a, now() - interval '1 day'),
    (t.c_b, t.tenant_b, null::uuid, now() - interval '1 day')
  ) as v(id, tenant, cust, closed);

insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount, snapshot_status
)
select v.id, v.comanda, v.tenant, 'servico', v.srv, v.prof, 1, v.total, v.total, v.total, v.pct, v.comm, 'confirmed'
from t49 t,
  lateral (values
    (t.i1, t.c1, t.tenant_a, t.srv_a, t.prof1, 50::numeric, 40::numeric, 20::numeric),
    (t.i2, t.c2, t.tenant_a, t.srv_a, t.prof1, 50::numeric, 20::numeric, 10::numeric),
    (t.i3, t.c3, t.tenant_a, t.srv_a, t.prof2, 60::numeric, 25::numeric, 15::numeric),
    (t.i4, t.c1, t.tenant_a, t.srv_a, t.prof1, 20::numeric, 25::numeric, 5::numeric),
    (t.i_b, t.c_b, t.tenant_b, t.srv_b, t.prof_b, 40::numeric, 20::numeric, 8::numeric)
  ) as v(id, comanda, tenant, srv, prof, total, pct, comm);

-- i2 e legado (sem obrigacao). i1, i3 e iB tem obrigacao; a de i4 foi estornada.
insert into public.commission_obligations (
  tenant_id, professional_id, comanda_id, comanda_item_id, amount, status, commission_rule, created_at
)
select v.tenant, v.prof, v.comanda, v.item, v.amount, v.status, 'service', v.created
from t49 t,
  lateral (values
    (t.tenant_a, t.prof1, t.c1, t.i1, 20::numeric, 'open', now() - interval '2 days'),
    (t.tenant_a, t.prof2, t.c3, t.i3, 15::numeric, 'open', now() - interval '1 day'),
    (t.tenant_a, t.prof1, t.c1, t.i4, 5::numeric, 'reversed', now() - interval '2 days'),
    (t.tenant_b, t.prof_b, t.c_b, t.i_b, 8::numeric, 'open', now() - interval '1 day')
  ) as v(tenant, prof, comanda, item, amount, status, created);

grant select on t49 to authenticated;

-- ---------------------------------------------------------------- barbeiro 1, o proprio extrato
select set_config('request.jwt.claim.sub', (select u_barb1::text from t49), true);
set local role authenticated;

select is(
  (select jsonb_array_length(public.get_professional_commission_items((select prof1 from t49), null, null, (select tenant_a from t49)))),
  2,
  'barbeiro ve os dois itens da propria comissao (obrigacao e legado), sem o estornado'
);
select is(
  (select sum((e ->> 'commission_amount')::numeric)
   from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), null, null, null)) e),
  30::numeric,
  'a comissao dos itens soma o valor gravado (20 da obrigacao + 10 do legado)'
);
select is(
  (select sum((e ->> 'commission_amount')::numeric)
   from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), null, null, null)) e),
  ((public.get_professional_commission_balance((select prof1 from t49), null, null, null)) ->> 'generated_commission')::numeric,
  'a soma dos itens bate com a comissao gerada do saldo'
);
select is(
  (select sum((e ->> 'commission_amount')::numeric)
   from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), now() - interval '36 hours', now(), null)) e),
  ((public.get_professional_commission_balance((select prof1 from t49), now() - interval '36 hours', now(), null)) ->> 'generated_commission')::numeric,
  'a soma dos itens bate com o saldo tambem num periodo recortado'
);
select is(
  (select jsonb_array_length(public.get_professional_commission_items((select prof1 from t49), now() - interval '36 hours', now(), null))),
  1,
  'o periodo recorta pela data em que a comissao nasceu'
);
select is(
  (select e ->> 'item_name' from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), null, null, null)) e
   where (e ->> 'item_id')::uuid = (select i1 from t49)),
  'Servico A t49',
  'o item traz o nome do servico'
);
select is(
  (select e ->> 'customer_name' from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), null, null, null)) e
   where (e ->> 'item_id')::uuid = (select i1 from t49)),
  'Cliente A t49',
  'o item traz o cliente da Comanda'
);
select is(
  (select (e ->> 'commission_percentage')::numeric from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), null, null, null)) e
   where (e ->> 'item_id')::uuid = (select i1 from t49)),
  40::numeric,
  'o item traz a porcentagem gravada no fechamento'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), null, null, null)) e
   where (e ->> 'item_id')::uuid = (select i4 from t49)),
  0,
  'obrigacao estornada nao aparece'
);

-- Mudar a porcentagem do catalogo depois do fechamento nao altera o que ele ve.
reset role;
update public.services set commission_percentage = 99 where id = (select srv_a from t49);
update public.professionals set commission_percentage = 99 where id = (select prof1 from t49);
select set_config('request.jwt.claim.sub', (select u_barb1::text from t49), true);
set local role authenticated;

select is(
  (select sum((e ->> 'commission_amount')::numeric)
   from jsonb_array_elements(public.get_professional_commission_items((select prof1 from t49), null, null, null)) e),
  30::numeric,
  'mudar a porcentagem do catalogo nao altera a comissao ja gravada'
);

-- ---------------------------------------------------------------- barbeiro 1, o que nao e dele
select throws_ok(
  $$select public.get_professional_commission_items((select prof2 from t49), null, null, null)$$,
  '42501', 'Acesso negado para este extrato.',
  'barbeiro nao ve o extrato de comissao do colega'
);
select throws_ok(
  $$select public.get_professional_commission_balance((select prof2 from t49), null, null, null)$$,
  '42501', 'Acesso negado para este extrato.',
  'barbeiro nao ve o saldo do colega'
);
select throws_ok(
  $$select public.get_professional_account_statement((select prof2 from t49), null)$$,
  '42501', 'Acesso negado para este extrato.',
  'barbeiro nao ve o extrato da conta do colega'
);
select throws_ok(
  $$select public.get_professional_commission_items((select prof_b from t49), null, null, null)$$,
  '42501', 'Acesso negado para este extrato.',
  'barbeiro nao ve a comissao de profissional de outra barbearia'
);
select throws_ok(
  $$select public.get_professional_commission_items((select prof1 from t49), null, null, (select tenant_b from t49))$$,
  '42501', 'Acesso negado para este extrato.',
  'barbeiro nao consulta o proprio profissional informando outra barbearia'
);

-- ---------------------------------------------------------------- barbeiro 1, leitura direta dos itens
select is(
  (select count(*)::integer from public.comanda_itens where professional_id = (select prof1 from t49)),
  3,
  'barbeiro le os proprios Itens de Comanda'
);
select is(
  (select count(*)::integer from public.comanda_itens where professional_id <> (select prof1 from t49)),
  0,
  'barbeiro nao le Itens de Comanda do colega nem de outra barbearia'
);

-- ---------------------------------------------------------------- vinculo cruzado, inativo e outra barbearia
select set_config('request.jwt.claim.sub', (select u_cruz::text from t49), true);
select throws_ok(
  $$select public.get_professional_commission_items((select prof_cruz from t49), null, null, null)$$,
  '42501', 'Acesso negado para este extrato.',
  'usuario da barbearia A ligado a profissional da B nao ve a comissao'
);
select throws_ok(
  $$select public.get_professional_commission_balance((select prof_cruz from t49), null, null, null)$$,
  '42501', 'Acesso negado para este extrato.',
  'vinculo cruzado tambem e recusado no saldo'
);
select throws_ok(
  $$select public.get_professional_account_statement((select prof_cruz from t49), null)$$,
  '42501', 'Acesso negado para este extrato.',
  'vinculo cruzado tambem e recusado no extrato da conta'
);
select throws_ok(
  $$select public.get_professional_commission_items((select prof_cruz from t49), null, null, (select tenant_b from t49))$$,
  '42501', 'Acesso negado para este extrato.',
  'vinculo cruzado e recusado mesmo informando a barbearia do profissional'
);
select set_config('request.jwt.claim.sub', (select u_inativo::text from t49), true);
select throws_ok(
  $$select public.get_professional_commission_items((select prof_inativo from t49), null, null, null)$$,
  '42501', 'Acesso negado para este extrato.',
  'profissional inativo e recusado'
);
select set_config('request.jwt.claim.sub', (select u_barb_b::text from t49), true);
select throws_ok(
  $$select public.get_professional_commission_items((select prof1 from t49), null, null, (select tenant_a from t49))$$,
  '42501', 'Acesso negado para este extrato.',
  'barbeiro da barbearia B nao ve a comissao da barbearia A'
);
select is(
  (select count(*)::integer from public.comanda_itens),
  1,
  'barbeiro da barbearia B so le o proprio Item de Comanda'
);

-- ---------------------------------------------------------------- gestor e proprietario sem regressao
select set_config('request.jwt.claim.sub', (select u_ger_a::text from t49), true);
select is(
  (select jsonb_array_length(public.get_professional_commission_items((select prof1 from t49), null, null, (select tenant_a from t49)))),
  2,
  'gerente ve a comissao do profissional da propria barbearia'
);
select is(
  (select jsonb_array_length(public.get_professional_commission_items((select prof2 from t49), null, null, null))),
  1,
  'gerente ve a comissao de outro profissional da propria barbearia'
);
select is(
  (select count(*)::integer from public.comanda_itens),
  4,
  'gerente continua lendo todos os Itens de Comanda da barbearia'
);
select set_config('request.jwt.claim.sub', (select u_ger_b::text from t49), true);
select throws_ok(
  $$select public.get_professional_commission_items((select prof1 from t49), null, null, (select tenant_a from t49))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente de outra barbearia e recusado'
);
select set_config('request.jwt.claim.sub', (select u_ger_nulo::text from t49), true);
select throws_ok(
  $$select public.get_professional_commission_items((select prof1 from t49), null, null, null)$$,
  '22023', 'Unidade nao informada.',
  'gerente com tenant_id nulo, sem informar unidade, e recusado'
);
select throws_ok(
  $$select public.get_professional_commission_items((select prof1 from t49), null, null, (select tenant_a from t49))$$,
  '42501', 'Acesso negado para esta unidade.',
  'gerente com tenant_id nulo informando a unidade e recusado'
);
select set_config('request.jwt.claim.sub', (select u_prop::text from t49), true);
select is(
  (select jsonb_array_length(public.get_professional_commission_items((select prof1 from t49), null, null, (select tenant_a from t49)))),
  2,
  'proprietario ve a comissao de qualquer barbearia'
);

select * from finish(true);
rollback;
