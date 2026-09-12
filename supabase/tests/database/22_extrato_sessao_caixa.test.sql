begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
create temporary table ticket22_context (
  user_id uuid not null, other_user_id uuid not null, tenant_id uuid not null, session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket22_ctx__', '__ticket22_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket22_ctx__auth@teste.com')
  returning id
), au2 as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket22_ctx__auth2@teste.com')
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
insert into ticket22_context (user_id, other_user_id, tenant_id, session_id)
select au.id, au2.id, t.id, cs.id
from t, au, au2, cs;

update public.users
set tenant_id = (select tenant_id from ticket22_context), role = 'gerente', is_active = true
where id = (select user_id from ticket22_context);

update public.users
set tenant_id = (select tenant_id from ticket22_context), role = 'barbeiro', is_active = true
where id = (select other_user_id from ticket22_context);

grant select on ticket22_context to authenticated;

select has_function(
  'public', 'get_cash_session_statement', array['uuid','uuid'],
  'RPC de extrato do caixa existe'
);

select set_config('request.jwt.claim.sub', (select user_id::text from ticket22_context), true);
set local role authenticated;

-- Ajustes posteriores registrados pelo fluxo ja existente.
select lives_ok(
  $$select public.register_cash_session_adjustment((select session_id from ticket22_context), (select tenant_id from ticket22_context), 5, 'Diferenca encontrada na conferencia')$$,
  'registra primeiro ajuste posterior'
);
select lives_ok(
  $$select public.register_cash_session_adjustment((select session_id from ticket22_context), (select tenant_id from ticket22_context), -2, 'Correcao do ajuste anterior')$$,
  'registra segundo ajuste posterior'
);

reset role;
insert into public.cash_movements (tenant_id, cash_session_id, type, amount, reason, performed_by)
select tenant_id, session_id, 'repasse_comissao', 20, 'Repasse de comissao do turno', user_id
from ticket22_context;
set local role authenticated;

select is(
  (select (public.get_cash_session_statement(
    (select session_id from ticket22_context), (select tenant_id from ticket22_context)
  ) -> 'session' ->> 'status')),
  'closed',
  'extrato traz a fotografia do fechamento corrente'
);
select is(
  (select jsonb_array_length(public.get_cash_session_statement(
    (select session_id from ticket22_context), (select tenant_id from ticket22_context)
  ) -> 'adjustments')),
  2,
  'lista os dois ajustes posteriores'
);
select is(
  (select (public.get_cash_session_statement(
    (select session_id from ticket22_context), (select tenant_id from ticket22_context)
  ) ->> 'adjusted_difference_amount')::numeric),
  3::numeric,
  'divergencia ajustada acumulada soma a divergencia original e os ajustes (0 + 5 - 2)'
);
select is(
  (select jsonb_array_length(public.get_cash_session_statement(
    (select session_id from ticket22_context), (select tenant_id from ticket22_context)
  ) -> 'movements')),
  1,
  'lista as movimentacoes do turno, incluindo o repasse de comissao'
);
select is(
  (select (public.get_cash_session_statement(
    (select session_id from ticket22_context), (select tenant_id from ticket22_context)
  ) -> 'movements' -> 0 ->> 'type')),
  'repasse_comissao',
  'movimentacao de repasse de comissao aparece no extrato'
);
select is(
  (select jsonb_array_length(public.get_cash_session_statement(
    (select session_id from ticket22_context), (select tenant_id from ticket22_context)
  ) -> 'reopenings')),
  0,
  'nenhuma reabertura ainda'
);

select throws_ok(
  $$select public.get_cash_session_statement(null, (select tenant_id from ticket22_context))$$,
  '22023',
  'Sessão e unidade são obrigatórias.',
  'exige sessao informada'
);

select throws_ok(
  $$select public.get_cash_session_statement((select session_id from ticket22_context), gen_random_uuid())$$,
  '42501',
  'Acesso negado para a unidade solicitada.',
  'recusa unidade diferente da do gerente'
);

-- Reabre a sessao e confirma que o historico de reabertura passa a aparecer.
reset role;
select set_config('request.jwt.claim.sub', (select user_id::text from ticket22_context), true);
set local role authenticated;
select lives_ok(
  $$select public.reopen_cash_session((select session_id from ticket22_context), (select tenant_id from ticket22_context), 'Necessario corrigir lancamento')$$,
  'reabre a sessao para o teste de extrato'
);
select is(
  (select jsonb_array_length(public.get_cash_session_statement(
    (select session_id from ticket22_context), (select tenant_id from ticket22_context)
  ) -> 'reopenings')),
  1,
  'extrato passa a listar a reabertura apos reabrir o turno'
);

reset role;
select set_config('request.jwt.claim.sub', (select other_user_id::text from ticket22_context), true);
set local role authenticated;
select throws_ok(
  $$select public.get_cash_session_statement((select session_id from ticket22_context), (select tenant_id from ticket22_context))$$,
  '42501',
  'Acesso negado. Apenas gerentes e proprietários podem consultar o extrato do caixa.',
  'recusa papel nao autorizado'
);

reset role;
select is(
  (select has_function_privilege('anon', 'public.get_cash_session_statement(uuid,uuid)', 'execute')),
  false,
  'anon nao pode executar o extrato do caixa'
);

select * from finish(true);
rollback;
