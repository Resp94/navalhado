begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

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

-- Ticket 03 da spec 034: vale de profissional (cash_movements.type = 'vale_profissional')
-- reduz o valor esperado na gaveta da mesma forma que repasse de comissão, ou o fechamento
-- ficaria com o valor esperado superestimado (reproduzindo o defeito corrigido para
-- repasse_comissao pela migration 20260912060000).
reset role;
update public.cash_sessions
set status = 'open', closed_by = null, closed_at = null,
    closing_amount = null, expected_amount = null, difference_amount = null
where id = (select session_id from ticket07_context);
insert into public.cash_movements (
  tenant_id, cash_session_id, type, amount, reason, performed_by
)
select tenant_id, session_id, 'vale_profissional', 40, 'Vale de teste (ticket 03)', user_id
from ticket07_context;
set local role authenticated;
select lives_ok(
  $$select public.close_cash_session(
    (select session_id from ticket07_context),
    (select tenant_id from ticket07_context),
    330,
    'Fechamento com vale de profissional'
  )$$,
  'aceita fechamento com vale de profissional registrado no turno'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  330::numeric,
  'vale de profissional reduz o valor esperado no mesmo montante do valor lançado'
);
select is(
  (select difference_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  0::numeric,
  'fechamento bate exatamente quando o vale é considerado no cálculo do valor esperado'
);

-- Ticket 01 da spec 036: apuração única do valor esperado da gaveta.
-- Sessão com todos os tipos de movimento, incluindo repasse e vale estornados.
-- Cálculo à mão: fundo 100 + dinheiro 250 + suprimento 50 - sangria 30
--   - vale ativo 40 - repasse ativo 25 = 305. Repasse estornado (60) e vale
--   estornado (70) não saem da gaveta.
reset role;
update public.cash_sessions
set status = 'open', closed_by = null, closed_at = null,
    closing_amount = null, expected_amount = null, difference_amount = null
where id = (select session_id from ticket07_context);
insert into public.cash_movements (
  tenant_id, cash_session_id, type, amount, reason, performed_by,
  reversed_at, reversed_by, reversal_reason
)
select tenant_id, session_id, 'repasse_comissao', 25, 'Repasse ativo (ticket 01/036)', user_id,
  null, null, null
from ticket07_context
union all
select tenant_id, session_id, 'repasse_comissao', 60, 'Repasse estornado (ticket 01/036)', user_id,
  timezone('utc'::text, now()), user_id, 'Estorno de teste'
from ticket07_context
union all
select tenant_id, session_id, 'vale_profissional', 70, 'Vale estornado (ticket 01/036)', user_id,
  timezone('utc'::text, now()), user_id, 'Estorno de teste'
from ticket07_context;

create temporary table ticket07_preview (payload jsonb) on commit drop;
grant select, insert on ticket07_preview to authenticated;

select has_function(
  'public',
  'get_cash_session_expected_amount',
  array['uuid', 'uuid'],
  'contrato de leitura da prévia da gaveta existe'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'compute_cash_session_expected_amount'
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'apuração única vive no schema privado sem execução para anônimo e autenticado'
);

set local role authenticated;
select lives_ok(
  $$insert into ticket07_preview (payload)
    select public.get_cash_session_expected_amount(
      (select session_id from ticket07_context),
      (select tenant_id from ticket07_context)
    )$$,
  'contrato de leitura da prévia responde para a sessão aberta'
);
select is(
  (select (payload->>'expected_amount')::numeric from ticket07_preview),
  305::numeric,
  'prévia devolve o valor esperado calculado à mão com todos os tipos de movimento'
);
select is(
  (select payload->'movements_by_type' from ticket07_preview),
  '[
    {"type": "repasse_comissao", "direction": "saida", "amount": 25},
    {"type": "sangria", "direction": "saida", "amount": 30},
    {"type": "suprimento", "direction": "entrada", "amount": 50},
    {"type": "vale_profissional", "direction": "saida", "amount": 40}
  ]'::jsonb,
  'prévia detalha por tipo só os movimentos não estornados, com o sentido de cada tipo'
);
select throws_ok(
  $$select public.get_cash_session_expected_amount(
    (select session_id from ticket07_context),
    gen_random_uuid()
  )$$,
  '42501',
  'Acesso negado para a unidade solicitada.',
  'prévia recusa gerente consultando outra unidade'
);

select lives_ok(
  $$select public.close_cash_session(
    (select session_id from ticket07_context),
    (select tenant_id from ticket07_context),
    305,
    'Fechamento com todos os tipos de movimento'
  )$$,
  'fecha sessão com todos os tipos de movimento, incluindo repasse e vale estornados'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  305::numeric,
  'fechamento persiste o valor esperado calculado à mão'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select session_id from ticket07_context)),
  (select (payload->>'expected_amount')::numeric from ticket07_preview),
  'prévia devolveu exatamente o valor que o fechamento persistiu em seguida'
);
select is(
  (select calculation_version from public.cash_sessions where id = (select session_id from ticket07_context)),
  'cash_expected_v3',
  'versão de cálculo gravada no fechamento permanece a atual'
);
select throws_ok(
  $$select public.get_cash_session_expected_amount(
    (select session_id from ticket07_context),
    (select tenant_id from ticket07_context)
  )$$,
  'P0001',
  'A sessão de caixa não está aberta ou não existe.',
  'prévia recusa sessão já fechada, que mostra a fotografia persistida'
);

-- Todo tipo aceito pela restrição de tipo precisa declarar sentido. A sonda
-- insere um movimento de cada tipo numa subtransação desfeita logo em seguida;
-- um tipo sem sentido declarado falha na inserção e volta nulo aqui.
reset role;
create or replace function pg_temp.ticket07_sentido_do_tipo(p_type text)
returns text
language plpgsql
as $probe$
declare
  v_direction text;
begin
  begin
    execute
      'insert into public.cash_movements (tenant_id, cash_session_id, type, amount, reason, performed_by)
       select tenant_id, session_id, $1, 0.01, ''Sonda de sentido'', user_id from ticket07_context
       returning direction'
      into v_direction
      using p_type;
    raise exception using errcode = 'P0099', message = coalesce(v_direction, '');
  exception
    when sqlstate 'P0099' then
      return nullif(sqlerrm, '');
    when not_null_violation or undefined_column then
      return null;
  end;
end;
$probe$;

create temporary table ticket07_accepted_types on commit drop as
select (regexp_matches(pg_get_constraintdef(c.oid), '''([^'']+)''', 'g'))[1] as type
from pg_constraint c
where c.conrelid = 'public.cash_movements'::regclass
  and c.conname = 'cash_movements_type_check';

select ok(
  (select count(*) from ticket07_accepted_types) >= 4,
  'enumera os tipos aceitos pela restrição de tipo de movimento de caixa'
);
select is_empty(
  $$select type from ticket07_accepted_types
    where coalesce(pg_temp.ticket07_sentido_do_tipo(type), '') not in ('entrada', 'saida')$$,
  'todo tipo aceito pela restrição de tipo recebe sentido de entrada ou saída'
);

reset role;
select * from finish(true);
rollback;
