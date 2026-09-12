begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

create temporary table ticket11_context (
  user_id uuid not null,
  tenant_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  comanda_id uuid not null,
  item_one_id uuid not null,
  item_two_id uuid not null
) on commit drop;

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket11_ctx__', '__ticket11_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket11_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket11', '11988880011', 20, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Ticket11', 50, 'corte', true
  from t
  returning id, tenant_id
)
insert into ticket11_context (
  user_id, tenant_id, professional_id, service_id, comanda_id, item_one_id, item_two_id
)
select au.id, t.id, prof.id, svc.id, gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from t, au, prof, svc;

update public.users
set tenant_id = (select tenant_id from ticket11_context), role = 'gerente', is_active = true
where id = (select user_id from ticket11_context);

grant select on ticket11_context to authenticated;

select ok((select count(*) from ticket11_context) = 1, 'encontra contexto para quitacoes');
select has_table('public', 'commission_payout_allocations', 'tabela de alocacoes existe');
select has_function(
  'public',
  'register_commission_payout',
  array['uuid', 'numeric', 'text', 'text', 'timestamp with time zone', 'uuid'],
  'RPC de quitacao preserva a assinatura atual'
);
select has_function(
  'public',
  'get_professional_commission_balance',
  array['uuid', 'timestamp with time zone', 'timestamp with time zone', 'uuid'],
  'contrato de saldo atual e periodos existe'
);
select ok(
  pg_get_functiondef('public.register_commission_payout(uuid,numeric,text,text,timestamptz,uuid)'::regprocedure) like '%for update%',
  'RPC bloqueia as obrigacoes para evitar sobrequitacao concorrente'
);

reset role;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select comanda_id, tenant_id, 'fechada', 80, 0, 0, timezone('utc'::text, now())
from ticket11_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id,
  quantity, unit_price, total_price, snapshot_quantity, snapshot_unit_price,
  snapshot_gross_amount, snapshot_discount_amount, snapshot_net_amount,
  snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule, snapshot_status
)
select item_one_id, comanda_id, tenant_id, 'servico', service_id, professional_id,
  1, 50, 50, 1, 50, 50, 0, 50, 20, 10, 'service', 'confirmed'
from ticket11_context
union all
select item_two_id, comanda_id, tenant_id, 'servico', service_id, professional_id,
  1, 30, 30, 1, 30, 30, 0, 30, 20, 6, 'service', 'confirmed'
from ticket11_context;
-- Datas explicitas e distintas: garante que a alocacao por ordem de criacao
-- (created_at, id) trate a primeira obrigacao antes da segunda de forma deterministica.
insert into public.commission_obligations (
  tenant_id, professional_id, comanda_id, comanda_item_id, amount, commission_rule, created_by, created_at
)
select tenant_id, professional_id, comanda_id, item_one_id, 10, 'service', user_id, timezone('utc'::text, now()) - interval '2 minutes' from ticket11_context
union all
select tenant_id, professional_id, comanda_id, item_two_id, 6, 'service', user_id, timezone('utc'::text, now()) - interval '1 minute' from ticket11_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket11_context), false);
set local role authenticated;

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket11_context), 4, 'pix', 'Ticket 11 parcial', now(), (select tenant_id from ticket11_context)
  )$$,
  'registra quitacao parcial'
);
select is(
  (select settled_amount from public.commission_obligations where comanda_item_id = (select item_one_id from ticket11_context)),
  4::numeric,
  'aplica o pagamento parcial na primeira obrigacao'
);
select is(
  (select status from public.commission_obligations where comanda_item_id = (select item_one_id from ticket11_context)),
  'partially_paid',
  'marca a obrigacao parcial corretamente'
);
select is(
  (select count(*) from public.commission_payout_allocations a join public.commission_obligations o on o.id = a.obligation_id where o.comanda_item_id = (select item_one_id from ticket11_context)),
  1::bigint,
  'mantem o vinculo entre quitao parcial e obrigacao'
);

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket11_context), 8, 'pix', 'Ticket 11 multipla', now(), (select tenant_id from ticket11_context)
  )$$,
  'registra quitacao de varias obrigacoes'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket11_context) and status = 'paid'),
  1::bigint,
  'liquida a primeira obrigacao e inicia a segunda'
);
select is(
  (select sum(a.amount) from public.commission_payout_allocations a join public.commission_obligations o on o.id = a.obligation_id where o.comanda_id = (select comanda_id from ticket11_context)),
  12::numeric,
  'reconcilia todas as alocacoes com o saldo gerado'
);
select is(
  (select count(*) from public.commission_payout_allocations a join public.commission_obligations o on o.id = a.obligation_id where o.comanda_id = (select comanda_id from ticket11_context) and a.amount = 6),
  1::bigint,
  'aloca o restante da primeira obrigacao antes da segunda'
);
select is(
  (select count(*) from public.commission_payout_allocations a join public.commission_obligations o on o.id = a.obligation_id where o.comanda_id = (select comanda_id from ticket11_context) and a.amount = 2),
  1::bigint,
  'aloca o residual na segunda obrigacao'
);
select is(
  (public.get_professional_commission_balance((select professional_id from ticket11_context), now() - interval '1 hour', now() + interval '1 hour', (select tenant_id from ticket11_context))->>'current_open_balance')::numeric,
  4::numeric,
  'retorna o saldo atual independente do filtro visual'
);
select is(
  (public.get_professional_commission_balance((select professional_id from ticket11_context), now() - interval '1 hour', now() + interval '1 hour', (select tenant_id from ticket11_context))->>'generated_commission')::numeric,
  16::numeric,
  'separa a comissao gerada no periodo'
);
select is(
  (public.get_professional_commission_balance((select professional_id from ticket11_context), now() - interval '1 hour', now() + interval '1 hour', (select tenant_id from ticket11_context))->>'paid_commission')::numeric,
  12::numeric,
  'separa os pagamentos realizados no periodo'
);
select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket11_context), 5, 'pix', 'Ticket 11 excesso', now(), (select tenant_id from ticket11_context)
  )$$,
  'P0001',
  'O valor informado excede o saldo pendente de comissao.',
  'rejeita valor acima do saldo aberto'
);
select is(
  (select count(*) from public.commission_payouts where notes in ('Ticket 11 parcial', 'Ticket 11 multipla')),
  2::bigint,
  'rejeicao nao cria pagamento parcial'
);

reset role;
select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'commission_payout_allocations' and grantee = 'authenticated' and privilege_type = 'SELECT'),
  1::bigint,
  'authenticated possui apenas leitura das alocacoes'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.commission_payout_allocations'::regclass),
  true,
  'RLS permanece habilitado nas alocacoes'
);
select * from finish(true);
rollback;




