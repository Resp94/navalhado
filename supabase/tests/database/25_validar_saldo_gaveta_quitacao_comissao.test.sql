begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
-- Reproduz o achado de QA manual: quitacao de comissao em dinheiro sem
-- validar o saldo da gaveta permitia deixar expected_amount negativo no
-- fechamento do turno, violando cash_sessions_expected_amount_check e
-- travando o fechamento de caixa.
create temporary table ticket25_context (
  user_id uuid not null, tenant_id uuid not null, professional_id uuid not null,
  comanda_id uuid not null, cash_session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket25_ctx__', '__ticket25_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket25_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket25', '11988880025', 30, true
  from t
  returning id, tenant_id
), com as (
  insert into public.comandas (tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
  select t.id, 'fechada', 0, 0, 0, timezone('utc'::text, now())
  from t
  returning id, tenant_id
), cs as (
  -- Fundo de troco de apenas R$10 e nenhuma entrada em dinheiro no turno:
  -- saldo disponivel na gaveta = R$10.
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 10, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket25_context (user_id, tenant_id, professional_id, comanda_id, cash_session_id)
select au.id, t.id, prof.id, com.id, cs.id
from t, au, prof, com, cs;

update public.users
set tenant_id = (select tenant_id from ticket25_context), role = 'gerente', is_active = true
where id = (select user_id from ticket25_context);

-- Obrigacao de comissao aberta bem maior que a gaveta, para isolar a
-- validacao de saldo de caixa da validacao de saldo de comissao.
insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, professional_id, quantity, unit_price, total_price,
  snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount,
  snapshot_commission_rule, snapshot_status
)
select comanda_id, tenant_id, 'servico', professional_id, 1, 500, 500,
  1, 500, 500, 0, 500, 30, 150, 'professional', 'confirmed'
from ticket25_context;

grant select on ticket25_context to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket25_context), true);
set local role authenticated;

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket25_context), 22.50, 'cash', 'excede a gaveta', now(),
    (select tenant_id from ticket25_context), (select cash_session_id from ticket25_context)
  )$$,
  'P0001',
  'O valor do repasse em dinheiro excede o saldo disponivel na gaveta do turno.',
  'recusa repasse em dinheiro maior que o saldo disponivel na gaveta'
);
select is(
  (select count(*) from public.commission_payouts where tenant_id = (select tenant_id from ticket25_context)),
  0::bigint,
  'repasse recusado nao persiste linha de quitacao'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id = (select cash_session_id from ticket25_context)),
  0::bigint,
  'repasse recusado nao gera movimentacao de caixa'
);

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket25_context), 10, 'cash', 'exatamente o saldo da gaveta', now(),
    (select tenant_id from ticket25_context), (select cash_session_id from ticket25_context)
  )$$,
  'aceita repasse em dinheiro igual ao saldo disponivel na gaveta'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id = (select cash_session_id from ticket25_context) and type = 'repasse_comissao'),
  1::bigint,
  'repasse aceito gera a movimentacao de caixa'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket25_context), 0.01, 'cash', 'gaveta ja esgotada', now(),
    (select tenant_id from ticket25_context), (select cash_session_id from ticket25_context)
  )$$,
  'P0001',
  'O valor do repasse em dinheiro excede o saldo disponivel na gaveta do turno.',
  'recusa novo repasse depois que a gaveta ja foi esgotada'
);

-- Fechamento do turno agora sucede: expected_amount nao fica negativo
-- porque o repasse foi limitado ao saldo real da gaveta.
select lives_ok(
  $$select public.close_cash_session(
    (select cash_session_id from ticket25_context),
    (select tenant_id from ticket25_context),
    0,
    'Fechamento apos repasse dentro do saldo da gaveta'
  )$$,
  'fecha o turno normalmente quando o repasse respeitou o saldo da gaveta'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select cash_session_id from ticket25_context)),
  0::numeric,
  'valor esperado nao fica negativo (10 de fundo - 10 de repasse = 0)'
);

reset role;
select * from finish(true);
rollback;
