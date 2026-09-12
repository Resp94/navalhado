begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
create temporary table ticket19_context (
  user_id uuid not null, tenant_id uuid not null, professional_id uuid not null,
  comanda_id uuid not null, cash_session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket19_ctx__', '__ticket19_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket19_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket19', '11988880019', 30, true
  from t
  returning id, tenant_id
), com as (
  insert into public.comandas (tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
  select t.id, 'fechada', 0, 0, 0, timezone('utc'::text, now())
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 100, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket19_context (user_id, tenant_id, professional_id, comanda_id, cash_session_id)
select au.id, t.id, prof.id, com.id, cs.id
from t, au, prof, com, cs;

update public.users
set tenant_id = (select tenant_id from ticket19_context), role = 'gerente', is_active = true
where id = (select user_id from ticket19_context);

insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, professional_id, quantity, unit_price, total_price,
  snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount,
  snapshot_commission_rule, snapshot_status
)
select comanda_id, tenant_id, 'servico', professional_id, 1, 200, 200,
  1, 200, 200, 0, 200, 30, 60, 'professional', 'confirmed'
from ticket19_context;

grant select on ticket19_context to authenticated;

select has_function(
  'public', 'register_commission_payout',
  array['uuid','numeric','text','text','timestamp with time zone','uuid','uuid'],
  'RPC de quitacao aceita sessao de caixa'
);

select set_config('request.jwt.claim.sub', (select user_id::text from ticket19_context), true);
set local role authenticated;

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket19_context), 10, 'cash', 'sem sessao', now(),
    (select tenant_id from ticket19_context), null
  )$$,
  '22023',
  'Informe a sessao de caixa para quitacao em dinheiro.',
  'exige sessao de caixa para quitacao em dinheiro'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket19_context), 10, 'pix', 'sessao indevida', now(),
    (select tenant_id from ticket19_context), (select cash_session_id from ticket19_context)
  )$$,
  '22023',
  'Sessao de caixa so pode ser informada para quitacao em dinheiro.',
  'rejeita sessao de caixa para metodo nao-dinheiro'
);

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket19_context), 25, 'cash', 'Repasse em dinheiro', now(),
    (select tenant_id from ticket19_context), (select cash_session_id from ticket19_context)
  )$$,
  'aceita quitacao em dinheiro com sessao aberta'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id = (select cash_session_id from ticket19_context) and type = 'repasse_comissao'),
  1::bigint,
  'gera movimentacao de caixa do tipo repasse de comissao'
);
select is(
  (select amount from public.cash_movements where cash_session_id = (select cash_session_id from ticket19_context) and type = 'repasse_comissao'),
  25::numeric,
  'movimentacao reflete o valor exato do repasse'
);
select is(
  (select cp.cash_session_id from public.commission_payouts cp
   join public.cash_movements cm on cm.payout_id = cp.id
   where cm.type = 'repasse_comissao' and cm.cash_session_id = (select cash_session_id from ticket19_context)),
  (select cash_session_id from ticket19_context),
  'quitacao guarda o vinculo com a sessao em que foi paga'
);

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket19_context), 15, 'pix', 'Repasse em pix', now(),
    (select tenant_id from ticket19_context), null
  )$$,
  'aceita quitacao em pix sem sessao de caixa'
);
select is(
  (select count(*) from public.cash_movements where type = 'repasse_comissao' and payout_id in (select id from public.commission_payouts where payment_method = 'pix' and professional_id = (select professional_id from ticket19_context))),
  0::bigint,
  'quitacao em pix nao gera movimentacao de caixa'
);

reset role;
update public.cash_sessions set status = 'closed' where tenant_id = (select tenant_id from ticket19_context) and status = 'open';
insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
select tenant_id, user_id, 0, 'closed' from ticket19_context;
set local role authenticated;

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket19_context), 5, 'cash', 'sessao fechada', now(),
    (select tenant_id from ticket19_context),
    (select id from public.cash_sessions where tenant_id = (select tenant_id from ticket19_context) and status = 'closed' order by created_at desc limit 1)
  )$$,
  'P0001',
  'A sessao de caixa informada nao esta aberta ou nao pertence a unidade.',
  'rejeita quitacao em dinheiro com sessao encerrada'
);

reset role;
insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
select tenant_id, user_id, 0, 'open' from ticket19_context;
insert into public.comanda_pagamentos (comanda_id, tenant_id, cash_session_id, payment_method, amount, change_amount)
select comanda_id, tenant_id,
  (select id from public.cash_sessions where tenant_id = ticket19_context.tenant_id and status = 'open' order by created_at desc limit 1),
  'cash', 200, 0
from ticket19_context;
update public.comandas set status='fechada' where id = (select comanda_id from ticket19_context);
set local role authenticated;

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket19_context), 20, 'cash', 'Repasse antes do fechamento', now(),
    (select tenant_id from ticket19_context),
    (select id from public.cash_sessions where tenant_id = (select tenant_id from ticket19_context) and status = 'open' order by created_at desc limit 1)
  )$$,
  'quitacao em dinheiro registrada antes do fechamento do turno'
);

select lives_ok(
  $$select public.close_cash_session(
    (select id from public.cash_sessions where tenant_id = (select tenant_id from ticket19_context) and status = 'open' order by created_at desc limit 1),
    (select tenant_id from ticket19_context),
    180,
    'Fechamento com repasse de comissao'
  )$$,
  'fecha o turno apos o repasse em dinheiro'
);
select is(
  (select expected_amount from public.cash_sessions where tenant_id = (select tenant_id from ticket19_context) and calculation_version = 'cash_expected_v2' order by closed_at desc limit 1),
  180::numeric,
  'valor esperado desconta o repasse de comissao em dinheiro'
);
select is(
  (select difference_amount from public.cash_sessions where tenant_id = (select tenant_id from ticket19_context) and calculation_version = 'cash_expected_v2' order by closed_at desc limit 1),
  0::numeric,
  'a conferencia bate quando o repasse ja foi descontado'
);

reset role;
select * from finish(true);
rollback;
