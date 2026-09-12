begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Contexto sintetico: tenant, gerente e um profissional com comissao legada
-- (comanda fechada sem obrigacao registrada) para o calculo de saldo pendente.
create temporary table ticket04_context (
  user_id uuid not null, tenant_id uuid not null, professional_id uuid not null, comanda_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket04_ctx__', '__ticket04_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket04_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket04', '11988880004', 30, true
  from t
  returning id, tenant_id
), com as (
  insert into public.comandas (tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
  select t.id, 'fechada', 0, 0, 0, timezone('utc'::text, now())
  from t
  returning id, tenant_id
)
insert into ticket04_context (user_id, tenant_id, professional_id, comanda_id)
select au.id, t.id, prof.id, com.id
from t, au, prof, com;

update public.users
set tenant_id = (select tenant_id from ticket04_context), role = 'gerente', is_active = true
where id = (select user_id from ticket04_context);

insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, professional_id, quantity, unit_price, total_price,
  snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount,
  snapshot_commission_rule, snapshot_status
)
select comanda_id, tenant_id, 'servico', professional_id, 1, 100, 100,
  1, 100, 100, 0, 100, 30, 50, 'professional', 'confirmed'
from ticket04_context;

grant select on ticket04_context to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket04_context), true);
set local role authenticated;

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket04_context),
    10,
    'pix',
    'ticket04 parcial',
    timezone('utc', now()),
    (select tenant_id from public.users where id = (select auth.uid()))
  )$$,
  'accepts a valid partial commission payout'
);
select is(
  (select count(*) from public.commission_payouts where created_by = (select auth.uid())),
  1::bigint,
  'partial payout creates one record'
);
select is(
  (select sum(amount) from public.commission_payouts where created_by = (select auth.uid())),
  10::numeric,
  'partial payout stores the requested amount'
);

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket04_context),
    coalesce((
      select (entry->>'pending_sum')::numeric
      from json_array_elements(
        public.get_tenant_financial_metrics(
          '2000-01-01T00:00:00Z'::timestamptz,
          '2100-01-01T00:00:00Z'::timestamptz,
          (select tenant_id from public.users where id = (select auth.uid()))
        )->'commissions_by_professional'
      ) entry
      where entry->>'professional_id' = (select professional_id::text from ticket04_context)
    ), 0),
    'transfer',
    'ticket04 total',
    timezone('utc', now()),
    (select tenant_id from public.users where id = (select auth.uid()))
  )$$,
  'accepts an exact payout of the remaining commission balance'
);
select is(
  (select count(*) from public.commission_payouts where created_by = (select auth.uid())),
  2::bigint,
  'partial and exact payouts create two records'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket04_context),
    0.01,
    'pix',
    'ticket04 excesso',
    timezone('utc', now()),
    (select tenant_id from public.users where id = (select auth.uid()))
  )$$,
  'P0001',
  'O valor informado excede o saldo pendente de comissao.',
  'rejects a payout above the pending balance'
);
select is(
  (select count(*) from public.commission_payouts where created_by = (select auth.uid())),
  2::bigint,
  'excess payout creates no record'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket04_context),
    1,
    'invalid_method',
    'ticket04 método inválido',
    timezone('utc', now()),
    (select tenant_id from public.users where id = (select auth.uid()))
  )$$,
  'P0001',
  'Metodo de pagamento invalido.',
  'rejects an unknown payment method'
);
select is(
  (select count(*) from public.commission_payouts where created_by = (select auth.uid())),
  2::bigint,
  'invalid payment method creates no record'
);

reset role;
update public.professionals
set is_active = false
where id = (
  select p.id
  from public.professionals p
  join public.users u on u.tenant_id = p.tenant_id
  where u.id = (select current_setting('request.jwt.claim.sub')::uuid)
  order by p.id
  limit 1
);
set local role authenticated;

select throws_ok(
  $$select public.register_commission_payout(
    (select p.id from public.professionals p where p.is_active = false order by p.id limit 1),
    1,
    'pix',
    'ticket04 profissional inativo',
    timezone('utc', now()),
    (select tenant_id from public.users where id = (select auth.uid()))
  )$$,
  'P0001',
  'Profissional nao encontrado ou inativo.',
  'rejects payout for an inactive professional'
);

reset role;
select is(
  (select count(*) from public.commission_payouts where created_by = (select current_setting('request.jwt.claim.sub')::uuid)),
  2::bigint,
  'inactive professional payout creates no record'
);

select * from finish(true);
rollback;
