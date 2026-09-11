begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select set_config(
  'request.jwt.claim.sub',
  (
    select u.id::text
    from public.users u
    join public.professionals p on p.tenant_id = u.tenant_id
    where u.is_active
      and u.role = 'gerente'
      and p.is_active
      and p.deleted_at is null
      and exists (
        select 1
        from public.comanda_itens ci
        join public.comandas c on c.id = ci.comanda_id
        where ci.professional_id = p.id
          and c.status in ('fechada', 'closed')
      )
    order by u.id
    limit 1
  ),
  true
);
set local role authenticated;

select lives_ok(
  $$select public.register_commission_payout(
    (select p.id from public.professionals p join public.users u on u.tenant_id = p.tenant_id where u.id = (select auth.uid()) and p.is_active and p.deleted_at is null and exists (select 1 from public.comanda_itens ci join public.comandas c on c.id = ci.comanda_id where ci.professional_id = p.id and c.status in ('fechada', 'closed')) order by p.id limit 1),
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
    (select p.id from public.professionals p join public.users u on u.tenant_id = p.tenant_id where u.id = (select auth.uid()) and p.is_active and p.deleted_at is null and exists (select 1 from public.comanda_itens ci join public.comandas c on c.id = ci.comanda_id where ci.professional_id = p.id and c.status in ('fechada', 'closed')) order by p.id limit 1),
    coalesce((
      select (entry->>'pending_sum')::numeric
      from json_array_elements(
        public.get_tenant_financial_metrics(
          '2000-01-01T00:00:00Z'::timestamptz,
          '2100-01-01T00:00:00Z'::timestamptz,
          (select tenant_id from public.users where id = (select auth.uid()))
        )->'commissions_by_professional'
      ) entry
      where entry->>'professional_id' = (select p.id::text from public.professionals p join public.users u on u.tenant_id = p.tenant_id where u.id = (select auth.uid()) and p.is_active and p.deleted_at is null and exists (select 1 from public.comanda_itens ci join public.comandas c on c.id = ci.comanda_id where ci.professional_id = p.id and c.status in ('fechada', 'closed')) order by p.id limit 1)
    ), 0),
    'cash',
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
    (select p.id from public.professionals p join public.users u on u.tenant_id = p.tenant_id where u.id = (select auth.uid()) and p.is_active and p.deleted_at is null and exists (select 1 from public.comanda_itens ci join public.comandas c on c.id = ci.comanda_id where ci.professional_id = p.id and c.status in ('fechada', 'closed')) order by p.id limit 1),
    0.01,
    'pix',
    'ticket04 excesso',
    timezone('utc', now()),
    (select tenant_id from public.users where id = (select auth.uid()))
  )$$,
  'P0001',
  'O valor informado excede o saldo pendente de comissão.',
  'rejects a payout above the pending balance'
);
select is(
  (select count(*) from public.commission_payouts where created_by = (select auth.uid())),
  2::bigint,
  'excess payout creates no record'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select p.id from public.professionals p join public.users u on u.tenant_id = p.tenant_id where u.id = (select auth.uid()) and p.is_active and p.deleted_at is null and exists (select 1 from public.comanda_itens ci join public.comandas c on c.id = ci.comanda_id where ci.professional_id = p.id and c.status in ('fechada', 'closed')) order by p.id limit 1),
    1,
    'invalid_method',
    'ticket04 método inválido',
    timezone('utc', now()),
    (select tenant_id from public.users where id = (select auth.uid()))
  )$$,
  'P0001',
  'Método de pagamento inválido.',
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
  'Profissional não encontrado ou inativo.',
  'rejects payout for an inactive professional'
);

reset role;
select is(
  (select count(*) from public.commission_payouts where created_by = (select current_setting('request.jwt.claim.sub')::uuid)),
  2::bigint,
  'inactive professional payout creates no record'
);

select * from finish();
rollback;
