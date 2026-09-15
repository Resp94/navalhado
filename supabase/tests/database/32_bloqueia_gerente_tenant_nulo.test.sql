begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Auditoria de seguranca (2026-09-13): varias RPCs financeiras SECURITY DEFINER
-- usam "v_user_tenant <> p_tenant_id" para bloquear gerente/barbeiro fora da
-- propria unidade. Em SQL, "NULL <> qualquer coisa" e NULL, nao true -- entao
-- um usuario com role 'gerente' e public.users.tenant_id NULL (registro mal
-- configurado, mas possivel pois a coluna e nullable) passa direto por essa
-- guarda para QUALQUER tenant informado no parametro. Este teste reproduz a
-- falha: cria um gerente com tenant_id nulo e confirma que ele NAO consegue
-- agir sobre um tenant alheio. Antes da correcao (troca por "is distinct
-- from"), estas asserções falham -- algumas porque a RPC nem lanca excecao
-- (a operacao indevida e concluida), outras porque lanca uma excecao diferente
-- da esperada por ter avancado alem da guarda de tenant.
create temporary table ticket28_context (
  attacker_id uuid not null, tenant_v uuid not null,
  professional_v uuid not null, product_v uuid not null,
  session_v uuid not null, comanda_v uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket28_victim__', '__ticket28_victim__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket28_attacker__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket28', '11988880050', 20, true
  from t
  returning id
), prod as (
  insert into public.products (tenant_id, name, price, stock_quantity)
  select t.id, 'Produto Ticket28', 50, 20
  from t
  returning id
), cs as (
  insert into public.cash_sessions (
    tenant_id, opened_by, closed_by, opened_at, closed_at,
    initial_amount, closing_amount, expected_amount, difference_amount,
    cash_received_amount, pix_received_amount, card_received_amount, other_received_amount,
    payment_count, supplies_amount, withdrawals_amount, calculation_version, status, notes
  )
  select t.id, au.id, au.id,
    timezone('utc'::text, now()) - interval '2 hours',
    timezone('utc'::text, now()) - interval '1 hour',
    100, 150, 150, 0, 100, 0, 0, 0, 1, 0, 0, 'cash_expected_v2', 'closed', 'Fechamento original'
  from t, au
  returning id
), com as (
  insert into public.comandas (tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
  select t.id, 'fechada', 0, 0, 0, timezone('utc'::text, now())
  from t
  returning id
)
insert into ticket28_context (attacker_id, tenant_v, professional_v, product_v, session_v, comanda_v)
select au.id, t.id, prof.id, prod.id, cs.id, com.id
from t, au, prof, prod, cs, com;

-- Usuario com role de gestao mas SEM tenant (o precondicao do bug: um gerente
-- mal cadastrado, sem unidade vinculada).
update public.users
set tenant_id = null, role = 'gerente', is_active = true
where id = (select attacker_id from ticket28_context);

select is(
  (select tenant_id from public.users where id = (select attacker_id from ticket28_context)),
  null::uuid,
  'pre-condicao: gerente atacante fica com tenant_id nulo'
);

grant select on ticket28_context to authenticated;

select set_config('request.jwt.claim.sub', (select attacker_id::text from ticket28_context), true);
set local role authenticated;

select throws_ok(
  $$select public.adjust_product_stock((select product_v from ticket28_context), 'entry_manual', 1, 10, 'ajuste indevido cross-tenant')$$,
  'P0001', 'Acesso negado para este tenant.',
  'adjust_product_stock recusa gerente sem tenant agindo em produto de outro tenant'
);

select throws_ok(
  $$select public.backfill_financial_history((select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'backfill_financial_history recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.cancel_comanda_appointment(null, null, (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'cancel_comanda_appointment recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.close_cash_session((select session_v from ticket28_context), (select tenant_v from ticket28_context), 0)$$,
  '42501', 'Acesso negado para a unidade solicitada.',
  'close_cash_session recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.get_cash_session_statement((select session_v from ticket28_context), (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para a unidade solicitada.',
  'get_cash_session_statement recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.get_daily_financial_summary(current_date, current_date, 'America/Sao_Paulo', (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para a unidade solicitada.',
  'get_daily_financial_summary recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.get_professional_account_statement((select professional_v from ticket28_context), (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'get_professional_account_statement recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.get_professional_commission_balance((select professional_v from ticket28_context), null, null, (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'get_professional_commission_balance recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.get_tenant_current_commission_balance((select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'get_tenant_current_commission_balance recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.get_tenant_financial_metrics(now() - interval '1 day', now(), (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para a unidade solicitada.',
  'get_tenant_financial_metrics recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.register_cash_session_adjustment((select session_v from ticket28_context), (select tenant_v from ticket28_context), 5, 'ajuste indevido cross-tenant')$$,
  '42501', 'Acesso negado para esta unidade.',
  'register_cash_session_adjustment recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.register_commission_payout((select professional_v from ticket28_context), 10, 'pix', 'quitacao indevida cross-tenant', now(), (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'register_commission_payout recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.register_professional_advance((select professional_v from ticket28_context), 10, 'vale indevido cross-tenant', 'pix', (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'register_professional_advance recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.reopen_cash_session((select session_v from ticket28_context), (select tenant_v from ticket28_context), 'reabertura indevida cross-tenant')$$,
  '42501', 'Acesso negado para esta unidade.',
  'reopen_cash_session recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.reopen_comanda((select comanda_v from ticket28_context), (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'reopen_comanda recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.reverse_commission_payout(gen_random_uuid(), (select tenant_v from ticket28_context), 'estorno indevido cross-tenant')$$,
  '42501', 'Acesso negado para esta unidade.',
  'reverse_commission_payout recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.reverse_professional_advance(gen_random_uuid(), (select tenant_v from ticket28_context), 'estorno indevido cross-tenant')$$,
  '42501', 'Acesso negado para esta unidade.',
  'reverse_professional_advance recusa gerente sem tenant agindo em unidade alheia'
);

select throws_ok(
  $$select public.settle_comanda(p_tenant_id => (select tenant_v from ticket28_context))$$,
  '42501', 'Acesso negado para esta unidade.',
  'settle_comanda recusa gerente sem tenant agindo em unidade alheia'
);

reset role;
select * from finish(true);
rollback;
