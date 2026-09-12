begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
create temporary table ticket20_context (
  user_id uuid not null, tenant_id uuid not null, closed_session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket20_ctx__', '__ticket20_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket20_ctx__auth@teste.com')
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
  returning id, tenant_id
)
insert into ticket20_context (user_id, tenant_id, closed_session_id)
select au.id, t.id, cs.id
from t, au, cs;

update public.users
set tenant_id = (select tenant_id from ticket20_context), role = 'gerente', is_active = true
where id = (select user_id from ticket20_context);

grant select on ticket20_context to authenticated;

select has_function(
  'public', 'reopen_cash_session', array['uuid','uuid','text'],
  'RPC de reabertura de caixa existe'
);
select has_table('public', 'cash_session_reopenings', 'tabela de reaberturas existe');

select set_config('request.jwt.claim.sub', (select user_id::text from ticket20_context), true);
set local role authenticated;

select throws_ok(
  $$select public.reopen_cash_session((select closed_session_id from ticket20_context), (select tenant_id from ticket20_context), 'x')$$,
  '22023',
  'Informe uma justificativa com pelo menos cinco caracteres.',
  'exige justificativa com pelo menos cinco caracteres'
);

select lives_ok(
  $$select public.reopen_cash_session((select closed_session_id from ticket20_context), (select tenant_id from ticket20_context), 'Contagem incorreta na conferencia')$$,
  'reabre a sessao de caixa fechada'
);
select is(
  (select status from public.cash_sessions where id = (select closed_session_id from ticket20_context)),
  'open',
  'sessao volta a ficar aberta'
);
select is(
  (select closing_amount from public.cash_sessions where id = (select closed_session_id from ticket20_context)),
  null,
  'limpa o valor de fechamento para nao somar sobre o anterior'
);
select is(
  (select count(*) from public.cash_session_reopenings where cash_session_id = (select closed_session_id from ticket20_context)),
  1::bigint,
  'registra uma reabertura auditavel'
);
select is(
  (select original_expected_amount from public.cash_session_reopenings where cash_session_id = (select closed_session_id from ticket20_context)),
  150::numeric,
  'preserva o valor esperado original do fechamento'
);
select is(
  (select original_difference_amount from public.cash_session_reopenings where cash_session_id = (select closed_session_id from ticket20_context)),
  0::numeric,
  'preserva a divergencia original do fechamento'
);
select ok(
  (select reopened_by is not null and reopened_at is not null from public.cash_session_reopenings where cash_session_id = (select closed_session_id from ticket20_context)),
  'registra autor e instante da reabertura'
);

-- Sangria/suprimento voltam a ser aceitos no turno reaberto.
select lives_ok(
  $$insert into public.cash_movements (tenant_id, cash_session_id, type, amount, reason, performed_by)
    select tenant_id, closed_session_id, 'sangria', 10, 'teste pos-reabertura', user_id from ticket20_context$$,
  'aceita nova movimentacao no turno reaberto'
);

select throws_ok(
  $$select public.reopen_cash_session((select closed_session_id from ticket20_context), (select tenant_id from ticket20_context), 'Segunda tentativa')$$,
  'P0001',
  'A sessao de caixa nao esta fechada ou nao existe.',
  'rejeita reabertura de sessao ja aberta'
);

reset role;
update public.cash_sessions
set status = 'closed', closing_amount = 5, expected_amount = 5, difference_amount = 0,
    closed_by = (select user_id from ticket20_context), closed_at = timezone('utc'::text, now())
where id = (select closed_session_id from ticket20_context);
insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
select tenant_id, user_id, 0, 'open' from ticket20_context;
set local role authenticated;

select throws_ok(
  $$select public.reopen_cash_session((select closed_session_id from ticket20_context), (select tenant_id from ticket20_context), 'Ja existe outro aberto')$$,
  'P0001',
  'Ja existe uma sessao de caixa aberta para esta unidade.',
  'rejeita reabertura enquanto outro turno esta aberto'
);

reset role;
select is(
  (select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='cash_session_reopenings' and grantee='authenticated' and privilege_type='SELECT'),
  1::bigint,
  'authenticated possui somente leitura direta das reaberturas'
);
select is(
  (select count(*) from information_schema.role_table_grants where table_schema='public' and table_name='cash_session_reopenings' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')),
  0::bigint,
  'nao permite escrita direta de reaberturas'
);

select * from finish(true);
rollback;
