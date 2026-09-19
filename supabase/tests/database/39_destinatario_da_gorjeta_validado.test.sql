begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create temporary table ticket40_02_context (
  user_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  service_id uuid not null,
  prof_a1_id uuid not null,
  prof_a2_id uuid not null,
  prof_a3_id uuid not null,
  prof_b1_id uuid not null,
  comanda_outro_tenant_id uuid not null,
  comanda_fora_itens_id uuid not null,
  comanda_sem_destino_id uuid not null,
  comanda_dois_ok_id uuid not null,
  comanda_um_ok_id uuid not null,
  comanda_trigger_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket40_02_ctx__', '__ticket40_02_ctx__@teste.com', '11999999999')
  returning id
), t2 as (
  insert into public.tenants (name, email, phone)
  values ('__ticket40_02_outro__', '__ticket40_02_outro__@teste.com', '11999999998')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket40_02_ctx__auth@teste.com')
  returning id
), pa1 as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Prof A1 T40', '11988880041', 10, true from t returning id
), pa2 as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Prof A2 T40', '11988880042', 10, true from t returning id
), pa3 as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Prof A3 T40', '11988880043', 10, true from t returning id
), pb1 as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t2.id, 'Prof B1 T40', '11988880044', 10, true from t2 returning id
), svc as (
  insert into public.services (tenant_id, name, price, price_type, category, is_active)
  select t.id, 'Corte T40', 100, 'fixed', 'corte', true from t returning id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open' from t, au returning id
)
insert into ticket40_02_context
select au.id, t.id, cs.id, svc.id, pa1.id, pa2.id, pa3.id, pb1.id,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from t, au, cs, svc, pa1, pa2, pa3, pb1;

update public.users
set tenant_id = (select tenant_id from ticket40_02_context), role = 'gerente', is_active = true
where id = (select user_id from ticket40_02_context);

grant select on ticket40_02_context to authenticated;

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select c, tenant_id, 'aberta', 0, 0, 0
from ticket40_02_context,
  unnest(array[
    comanda_outro_tenant_id, comanda_fora_itens_id, comanda_sem_destino_id,
    comanda_dois_ok_id, comanda_um_ok_id, comanda_trigger_id
  ]) as c;

-- O gatilho de credito recusa destinatario de outra unidade mesmo fora da RPC
-- (comanda_trigger_id fecha por update direto, com papel privilegiado).
select throws_ok(
  $$update public.comandas
    set status = 'fechada', total_amount = 110, tip_amount = 10,
        tip_professional_id = (select prof_b1_id from ticket40_02_context)
    where id = (select comanda_trigger_id from ticket40_02_context)$$,
  'P0001',
  'O destinatário da gorjeta não pertence à unidade da comanda.',
  'gatilho recusa credito de gorjeta a profissional de outra unidade'
);
select is(
  (select count(*) from public.professional_account_entries
   where professional_id = (select prof_b1_id from ticket40_02_context)),
  0::bigint,
  'nenhum credito e lancado na Conta do Profissional de outra unidade'
);

select set_config('request.jwt.claim.sub', (select user_id::text from ticket40_02_context), true);
set local role authenticated;

-- Destinatario de outra unidade.
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_outro_tenant_id from ticket40_02_context),
    (select tenant_id from ticket40_02_context),
    null, null, 0, 10,
    (select cash_session_id from ticket40_02_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_02_context),'professional_id',(select prof_a1_id from ticket40_02_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":110}]'::jsonb,
    (select prof_b1_id from ticket40_02_context)
  )$$,
  'P0001',
  'O destinatário da gorjeta não pertence à unidade.',
  'recusa destinatario de gorjeta de outra unidade'
);
select is(
  (select status from public.comandas where id = (select comanda_outro_tenant_id from ticket40_02_context)),
  'aberta',
  'recusa por destinatario de outra unidade nao fecha a comanda'
);

-- Destinatario da unidade, mas que nao aparece em nenhum item.
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_fora_itens_id from ticket40_02_context),
    (select tenant_id from ticket40_02_context),
    null, null, 0, 10,
    (select cash_session_id from ticket40_02_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_02_context),'professional_id',(select prof_a1_id from ticket40_02_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":110}]'::jsonb,
    (select prof_a3_id from ticket40_02_context)
  )$$,
  'P0001',
  'O destinatário da gorjeta deve ser um profissional que atendeu na comanda.',
  'recusa destinatario que nao aparece em nenhum item'
);

-- Gorjeta com dois profissionais nos itens e sem destinatario.
select throws_ok(
  $$select public.settle_comanda(
    (select comanda_sem_destino_id from ticket40_02_context),
    (select tenant_id from ticket40_02_context),
    null, null, 0, 10,
    (select cash_session_id from ticket40_02_context),
    jsonb_build_array(
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_02_context),'professional_id',(select prof_a1_id from ticket40_02_context),'quantity',1,'unit_price',100),
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_02_context),'professional_id',(select prof_a2_id from ticket40_02_context),'quantity',1,'unit_price',100)
    ),
    '[{"payment_method":"pix","amount":210}]'::jsonb,
    null
  )$$,
  'P0001',
  'Informe o destinatário da gorjeta: mais de um profissional atendeu na comanda.',
  'exige destinatario quando ha mais de um profissional nos itens'
);
select is(
  (select status from public.comandas where id = (select comanda_sem_destino_id from ticket40_02_context)),
  'aberta',
  'recusa por destinatario ausente nao fecha a comanda'
);

-- Dois profissionais com destinatario valido fecha e credita ao escolhido.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_dois_ok_id from ticket40_02_context),
    (select tenant_id from ticket40_02_context),
    null, null, 0, 10,
    (select cash_session_id from ticket40_02_context),
    jsonb_build_array(
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_02_context),'professional_id',(select prof_a1_id from ticket40_02_context),'quantity',1,'unit_price',100),
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_02_context),'professional_id',(select prof_a2_id from ticket40_02_context),'quantity',1,'unit_price',100)
    ),
    '[{"payment_method":"pix","amount":210}]'::jsonb,
    (select prof_a2_id from ticket40_02_context)
  )$$,
  'dois profissionais com destinatario valido fecha a comanda'
);
select is(
  (select professional_id from public.professional_account_entries
   where comanda_id = (select comanda_dois_ok_id from ticket40_02_context) and entry_type = 'gorjeta'),
  (select prof_a2_id from ticket40_02_context),
  'gorjeta e creditada ao destinatario escolhido'
);

-- Um profissional so, com ele como destinatario, fecha.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_um_ok_id from ticket40_02_context),
    (select tenant_id from ticket40_02_context),
    null, null, 0, 10,
    (select cash_session_id from ticket40_02_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket40_02_context),'professional_id',(select prof_a1_id from ticket40_02_context),'quantity',1,'unit_price',100)),
    '[{"payment_method":"pix","amount":110}]'::jsonb,
    (select prof_a1_id from ticket40_02_context)
  )$$,
  'um profissional so, como destinatario, fecha a comanda'
);

select * from finish(true);
rollback;
