begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
create temporary table ticket21_context (
  user_id uuid not null, tenant_id uuid not null, professional_id uuid not null,
  comanda_id uuid not null, item_one_id uuid not null, item_two_id uuid not null,
  cash_session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket21_ctx__', '__ticket21_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket21_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket21', '11988880021', 20, true
  from t
  returning id, tenant_id
), com as (
  insert into public.comandas (tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
  select t.id, 'fechada', 0, 0, 0, timezone('utc'::text, now())
  from t
  returning id, tenant_id
), cs as (
  -- Fundo de troco cobre as quitacoes em dinheiro deste teste (12 e depois
  -- 16, apos o estorno da primeira liberar o valor): sem isso a validacao
  -- de saldo de gaveta (correcao pos-QA) recusaria os repasses.
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 20, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket21_context (user_id, tenant_id, professional_id, comanda_id, item_one_id, item_two_id, cash_session_id)
select au.id, t.id, prof.id, com.id, gen_random_uuid(), gen_random_uuid(), cs.id
from t, au, prof, com, cs;

update public.users
set tenant_id = (select tenant_id from ticket21_context), role = 'gerente', is_active = true
where id = (select user_id from ticket21_context);

-- Datas explicitas garantem a ordem deterministica de alocacao (created_at, id).
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, professional_id, quantity, unit_price, total_price,
  snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount,
  snapshot_commission_rule, snapshot_status
)
select item_one_id, comanda_id, tenant_id, 'servico', professional_id, 1, 50, 50, 1, 50, 50, 0, 50, 20, 10, 'professional', 'confirmed'
from ticket21_context
union all
select item_two_id, comanda_id, tenant_id, 'servico', professional_id, 1, 30, 30, 1, 30, 30, 0, 30, 20, 6, 'professional', 'confirmed'
from ticket21_context;

insert into public.commission_obligations (tenant_id, professional_id, comanda_id, comanda_item_id, amount, commission_rule, created_by, created_at)
select tenant_id, professional_id, comanda_id, item_one_id, 10, 'professional', user_id, timezone('utc'::text, now()) - interval '2 minutes' from ticket21_context
union all
select tenant_id, professional_id, comanda_id, item_two_id, 6, 'professional', user_id, timezone('utc'::text, now()) - interval '1 minute' from ticket21_context;

grant select on ticket21_context to authenticated;

select has_function('public', 'reverse_commission_payout', array['uuid','uuid','text'], 'RPC de estorno de quitacao existe');

select set_config('request.jwt.claim.sub', (select user_id::text from ticket21_context), true);
set local role authenticated;

-- Quitacao parcial em dinheiro (paga a primeira obrigacao inteira e parte da segunda).
select lives_ok(
  $$select public.register_commission_payout((select professional_id from ticket21_context), 12, 'cash', 'Ticket21 quitacao', now(), (select tenant_id from ticket21_context), (select cash_session_id from ticket21_context))$$,
  'registra quitacao em dinheiro para estornar depois'
);

select throws_ok(
  $$select public.reverse_commission_payout(
    (select id from public.commission_payouts where professional_id = (select professional_id from ticket21_context) limit 1),
    (select tenant_id from ticket21_context), 'x'
  )$$,
  '22023', 'Informe uma justificativa com pelo menos cinco caracteres.', 'exige justificativa minima para estornar'
);

select lives_ok(
  $$select public.reverse_commission_payout(
    (select id from public.commission_payouts where professional_id = (select professional_id from ticket21_context) limit 1),
    (select tenant_id from ticket21_context), 'Quitacao registrada por engano'
  )$$,
  'estorna a quitacao com sucesso'
);

select is(
  (select settled_amount from public.commission_obligations where comanda_item_id = (select item_one_id from ticket21_context)),
  0::numeric,
  'devolve o saldo exato da primeira obrigacao'
);
select is(
  (select status from public.commission_obligations where comanda_item_id = (select item_one_id from ticket21_context)),
  'open',
  'primeira obrigacao volta a aberta'
);
select is(
  (select settled_amount from public.commission_obligations where comanda_item_id = (select item_two_id from ticket21_context)),
  0::numeric,
  'devolve o saldo exato da segunda obrigacao'
);
select is(
  (select status from public.commission_obligations where comanda_item_id = (select item_two_id from ticket21_context)),
  'open',
  'segunda obrigacao volta a aberta'
);
select is(
  (select count(*) from public.commission_payouts where professional_id = (select professional_id from ticket21_context) and reversed_at is not null),
  1::bigint,
  'marca a quitacao como estornada sem apaga-la'
);
select is(
  (select count(*) from public.cash_movements where payout_id = (select id from public.commission_payouts where professional_id = (select professional_id from ticket21_context) limit 1) and reversed_at is not null),
  1::bigint,
  'marca a movimentacao de caixa como estornada'
);
select is(
  (public.get_professional_commission_balance((select professional_id from ticket21_context), now() - interval '1 hour', now() + interval '1 hour', (select tenant_id from ticket21_context))->>'current_open_balance')::numeric,
  16::numeric,
  'o saldo pendente volta ao total antes da quitacao'
);
select is(
  (public.get_professional_commission_balance((select professional_id from ticket21_context), now() - interval '1 hour', now() + interval '1 hour', (select tenant_id from ticket21_context))->>'paid_commission')::numeric,
  0::numeric,
  'quitacao estornada deixa de contar como paga'
);

select throws_ok(
  $$select public.reverse_commission_payout(
    (select id from public.commission_payouts where professional_id = (select professional_id from ticket21_context) limit 1),
    (select tenant_id from ticket21_context), 'Segunda tentativa'
  )$$,
  'P0001', 'Esta quitacao ja foi estornada.', 'rejeita estorno duplicado'
);

-- Quitacao paga integralmente de novo, depois o turno e encerrado: o estorno deve exigir reabertura.
select lives_ok(
  $$select public.register_commission_payout((select professional_id from ticket21_context), 16, 'cash', 'Ticket21 segunda quitacao', now(), (select tenant_id from ticket21_context), (select cash_session_id from ticket21_context))$$,
  'registra segunda quitacao total em dinheiro'
);

reset role;
update public.cash_sessions set status = 'closed', closed_by = (select user_id from ticket21_context), closed_at = timezone('utc'::text, now())
where id = (select cash_session_id from ticket21_context);
set local role authenticated;

select throws_ok(
  $$select public.reverse_commission_payout(
    (select id from public.commission_payouts where professional_id = (select professional_id from ticket21_context) and reversed_at is null limit 1),
    (select tenant_id from ticket21_context), 'Turno ja fechado'
  )$$,
  'P0001',
  'A sessao de caixa do repasse esta encerrada; reabra o turno antes de estornar.',
  'bloqueia estorno em dinheiro com turno encerrado'
);

reset role;
select is(
  (select count(*) from public.commission_payouts where professional_id = (select professional_id from ticket21_context) and reversed_at is not null),
  1::bigint,
  'estorno bloqueado nao altera quitacoes existentes'
);

-- Reabrindo o turno, o estorno pode prosseguir.
set local role authenticated;
select lives_ok(
  $$select public.reopen_cash_session((select cash_session_id from ticket21_context), (select tenant_id from ticket21_context), 'Reabertura para permitir estorno')$$,
  'reabre o turno para permitir o estorno'
);
select lives_ok(
  $$select public.reverse_commission_payout(
    (select id from public.commission_payouts where professional_id = (select professional_id from ticket21_context) and reversed_at is null limit 1),
    (select tenant_id from ticket21_context), 'Turno reaberto, estorno concluido'
  )$$,
  'estorna a quitacao apos reabertura do turno'
);
select is(
  (select count(*) from public.commission_payouts where professional_id = (select professional_id from ticket21_context) and reversed_at is not null),
  2::bigint,
  'ambas as quitacoes ficam estornadas ao final'
);

reset role;
select * from finish(true);
rollback;
