begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create temporary table t44 (
  tenant_id uuid not null,
  u_ger uuid not null,
  prof_id uuid not null,
  service_id uuid not null,
  ap_id uuid not null,
  comanda_extra_id uuid not null
) on commit drop;

insert into public.tenants (name, email, phone)
values ('__t44__', '__t44__@teste.com', '11999999944');

insert into auth.users (id, email) values (gen_random_uuid(), '__t44_ger__@teste.com');

insert into t44
select
  (select id from public.tenants where name = '__t44__'),
  (select id from auth.users where email = '__t44_ger__@teste.com'),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

update public.users u set tenant_id = t.tenant_id, role = 'gerente', is_active = true
from t44 t where u.id = t.u_ger;

insert into public.professionals (id, tenant_id, name, phone, commission_percentage, is_active)
select prof_id, tenant_id, 'Prof T44', '11988880144', 10, true from t44;

insert into public.services (id, tenant_id, name, price, price_type, category, is_active)
select service_id, tenant_id, 'Servico T44', 65, 'fixed', 'corte', true from t44;

-- is_fitting = true dispensa a validacao de expediente na insercao do teste.
insert into public.appointments (id, tenant_id, professional_id, service_id, start_time, end_time, status, payment_status, origin, is_fitting)
select ap_id, tenant_id, prof_id, service_id, now() + interval '1 hour', now() + interval '90 minutes',
  'confirmed', 'pending', 'manual', true
from t44;

grant select on t44 to authenticated;

-- O gatilho de insercao cria exatamente uma comanda aberta, ja com o item do servico.
select is(
  (select count(*) from public.comandas where appointment_id = (select ap_id from t44) and status = 'aberta'),
  1::bigint,
  'agendamento novo gera exatamente uma comanda aberta'
);
select is(
  (select count(*) from public.comanda_itens ci join public.comandas c on c.id = ci.comanda_id
   where c.appointment_id = (select ap_id from t44)
     and ci.item_type = 'servico'
     and ci.service_id = (select service_id from t44)
     and ci.professional_id = (select prof_id from t44)
     and ci.unit_price = 65),
  1::bigint,
  'a comanda nasce com o item do servico, pelo preco do catalogo e com o profissional do agendamento'
);

-- No maximo uma comanda aberta por agendamento.
select throws_ok(
  $$insert into public.comandas (id, tenant_id, appointment_id, status, total_amount, discount_amount, tip_amount)
    select comanda_extra_id, tenant_id, ap_id, 'aberta', 0, 0, 0 from t44$$,
  '23505',
  null,
  'segunda comanda aberta para o mesmo agendamento e recusada'
);
select lives_ok(
  $$insert into public.comandas (id, tenant_id, appointment_id, status, total_amount, discount_amount, tip_amount)
    select comanda_extra_id, tenant_id, ap_id, 'cancelada', 0, 0, 0 from t44$$,
  'comanda cancelada extra do mesmo agendamento continua permitida'
);

-- Venda de balcao (sem agendamento) nao e afetada.
select lives_ok(
  $$insert into public.comandas (tenant_id, status, total_amount, discount_amount, tip_amount)
    select tenant_id, 'aberta', 0, 0, 0 from t44, generate_series(1, 2)$$,
  'varias comandas de balcao abertas, sem agendamento, continuam permitidas'
);

-- Iniciar o atendimento nao gera uma segunda comanda.
select set_config('request.jwt.claim.sub', (select u_ger::text from t44), true);
set local role authenticated;

select lives_ok(
  $$select public.start_appointment_service((select ap_id from t44), (select tenant_id from t44))$$,
  'gerente inicia o atendimento'
);
select is(
  (select count(*) from public.comandas where appointment_id = (select ap_id from t44) and status = 'aberta'),
  1::bigint,
  'iniciar o atendimento nao cria uma segunda comanda aberta'
);
select is(
  (select count(*) from public.comanda_itens ci join public.comandas c on c.id = ci.comanda_id
   where c.appointment_id = (select ap_id from t44) and c.status = 'aberta'),
  1::bigint,
  'iniciar o atendimento nao duplica o item do servico'
);

select * from finish(true);
rollback;
