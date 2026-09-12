begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

create temporary table ticket07_context (
  user_id uuid not null,
  tenant_id uuid not null,
  session_id uuid not null,
  comanda_id uuid not null
) on commit drop;

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket07_ctx__', '__ticket07_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket07_ctx__auth@teste.com')
  returning id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket07_context (user_id, tenant_id, session_id, comanda_id)
select au.id, t.id, cs.id, gen_random_uuid()
from t, au, cs;

update public.users
set tenant_id = (select tenant_id from ticket07_context), role = 'gerente', is_active = true
where id = (select user_id from ticket07_context);

grant select on ticket07_context to authenticated;

select ok((select count(*) from ticket07_context) = 1, 'encontra gerente ativo com sessão aberta');
select has_function(
  'public',
  'close_cash_session',
  array['uuid', 'uuid', 'numeric', 'text'],
  'RPC transacional de fechamento de caixa existe'
);

reset role;
update public.cash_sessions
set initial_amount = 100, status = 'open', closing_amount = null,
    expected_amount = null, difference_amount = null,
    closed_by = null, closed_at = null, notes = 'Ticket 07'
where id = (select session_id from ticket07_context);
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, tenant_id, 'aberta', 410, 0, 0
from ticket07_context;
insert into public.comanda_pagamentos (
  comanda_id, tenant_id, cash_session_id, payment_method, amount, change_amount
)
select comanda_id, tenant_id, session_id, 'cash', 250, 0 from ticket07_context
union all
select comanda_id, tenant_id, session_id, 'pix', 80, 0 from ticket07_context
union all
select comanda_id, tenant_id, session_id, 'credit_card', 70, 0 from ticket07_context
union all
select comanda_id, tenant_id, session_id, 'other', 10, 0 from ticket07_context;
insert into public.cash_movements (
  tenant_id, cash_session_id, type, amount, reason, performed_by
)
select tenant_id, session_id, 'suprimento', 50, 'Suprimento de teste', user_id from ticket07_context
union all
select tenant_id, session_id, 'sangria', 30, 'Sangria de teste', user_id from ticket07_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket07_context), true);
set local role authenticated;

select lives_ok(
  $$select public.close_cash_session(
    (select session_id from ticket07_context),
    (select tenant_id from ticket07_context),
    370,
    'Conferência sem diferença'
  )$$,
  'fecha caixa e calcula a conferência na mesma transação'
);
select is(
  (select status from public.cash_sessions where id = (select session_id from ticket07_context)),
  'closed',
  'sessão é encerrada'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  370::numeric,
  'persiste o valor esperado'
);
select is(
  (select closing_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  370::numeric,
  'persiste o valor contado'
);
select is(
  (select difference_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  0::numeric,
  'persiste diferença zero'
);
select is(
  (select closed_by from public.cash_sessions where id = (select session_id from ticket07_context)),
  (select user_id from ticket07_context),
  'persiste o responsável autenticado pelo servidor'
);
select ok(
  (select closed_at is not null from public.cash_sessions where id = (select session_id from ticket07_context)),
  'persiste o instante do servidor'
);
select is(
  (select sum(amount) from public.comanda_pagamentos where cash_session_id = (select session_id from ticket07_context) and payment_method = 'cash'),
  250::numeric,
  'inclui dinheiro recebido na gaveta'
);
select is(
  (select sum(amount) from public.comanda_pagamentos where cash_session_id = (select session_id from ticket07_context) and payment_method <> 'cash'),
  160::numeric,
  'preserva meios não físicos no resumo financeiro'
);
select is(
  (select sum(amount) from public.cash_movements where cash_session_id = (select session_id from ticket07_context) and type = 'suprimento'),
  50::numeric,
  'inclui suprimentos no cálculo'
);
select is(
  (select sum(amount) from public.cash_movements where cash_session_id = (select session_id from ticket07_context) and type = 'sangria'),
  30::numeric,
  'desconta sangrias no cálculo'
);

select throws_ok(
  $$select public.close_cash_session(
    (select session_id from ticket07_context),
    (select tenant_id from ticket07_context),
    370,
    null
  )$$,
  'P0001',
  'A sessão de caixa não está aberta ou não existe.',
  'rejeita fechamento duplicado'
);
select is(
  (select closing_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  370::numeric,
  'fechamento duplicado não altera a conferência'
);

reset role;
update public.cash_sessions
set status = 'open', closed_by = null, closed_at = null,
    closing_amount = null, expected_amount = null, difference_amount = null
where id = (select session_id from ticket07_context);
set local role authenticated;
select lives_ok(
  $$select public.close_cash_session(
    (select session_id from ticket07_context),
    (select tenant_id from ticket07_context),
    380,
    'Sobra de teste'
  )$$,
  'aceita fechamento com sobra'
);
select is(
  (select difference_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  10::numeric,
  'persiste sobra positiva'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  370::numeric,
  'mantém o valor esperado independente da contagem física'
);
reset role;
update public.cash_sessions
set status = 'open', closed_by = null, closed_at = null,
    closing_amount = null, expected_amount = null, difference_amount = null
where id = (select session_id from ticket07_context);
set local role authenticated;
select lives_ok(
  $$select public.close_cash_session(
    (select session_id from ticket07_context),
    (select tenant_id from ticket07_context),
    360,
    'Quebra de teste'
  )$$,
  'aceita fechamento com quebra'
);
select is(
  (select difference_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  (-10)::numeric,
  'persiste quebra negativa'
);

reset role;
select * from finish(true);
rollback;
