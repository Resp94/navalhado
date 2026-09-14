begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Spec 036 (Contas a Pagar). Ticket 15: Baixa pela gaveta, seu estorno e o
-- pagamento de conta no extrato impresso, migration
-- 20260914160000_baixa_pela_gaveta_estorno_e_extrato_impresso.sql.

create temporary table ticket30_context (
  tenant_a_id uuid not null,
  tenant_b_id uuid not null,
  gerente_a_id uuid not null,
  gerente_b_id uuid not null,
  categoria_id uuid not null,
  session_a_id uuid not null,
  session_b_id uuid not null
) on commit drop;

with ta as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket30_tenant_a__', '__ticket30_tenant_a__@teste.com', '11999999401', 'America/Sao_Paulo')
  returning id
), tb as (
  insert into public.tenants (name, email, phone, timezone)
  values ('__ticket30_tenant_b__', '__ticket30_tenant_b__@teste.com', '11999999402', 'America/Sao_Paulo')
  returning id
), au_gerente_a as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket30_gerente_a__@teste.com') returning id
), au_gerente_b as (
  insert into auth.users (id, email) values (gen_random_uuid(), '__ticket30_gerente_b__@teste.com') returning id
), cat as (
  insert into public.financial_categories (tenant_id, nature, name)
  select ta.id, 'expense', 'Ticket30 Categoria' from ta returning id
), cs_a as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select ta.id, au_gerente_a.id, 100, 'open' from ta, au_gerente_a
  returning id
), cs_b as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select tb.id, au_gerente_b.id, 100, 'open' from tb, au_gerente_b
  returning id
)
insert into ticket30_context (tenant_a_id, tenant_b_id, gerente_a_id, gerente_b_id, categoria_id, session_a_id, session_b_id)
select ta.id, tb.id, au_gerente_a.id, au_gerente_b.id, cat.id, cs_a.id, cs_b.id
from ta, tb, au_gerente_a, au_gerente_b, cat, cs_a, cs_b;

update public.users set tenant_id = (select tenant_a_id from ticket30_context), role = 'gerente', is_active = true where id = (select gerente_a_id from ticket30_context);
update public.users set tenant_id = (select tenant_b_id from ticket30_context), role = 'gerente', is_active = true where id = (select gerente_b_id from ticket30_context);
grant select on ticket30_context to authenticated;

select has_function(
  'public', 'settle_payable',
  array['uuid', 'numeric', 'date', 'text', 'numeric', 'numeric', 'text', 'uuid', 'uuid'],
  'public.settle_payable(...) existe (assinatura inalterada)'
);
select ok(
  pg_get_constraintdef((select oid from pg_constraint where conname = 'cash_movements_type_check')) ilike '%baixa_conta_pagar%',
  'cash_movements_type_check aceita o tipo baixa_conta_pagar'
);

select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket30_context), true);
set local role authenticated;

-- Conta de 100, para exercitar Baixa parcial pela gaveta e o limite exato do disponivel.
create temporary table ticket30_payable (id uuid) on commit drop;
grant select, insert on ticket30_payable to authenticated;
insert into ticket30_payable (id)
select id from public.create_payable('Ticket30 Entregador', (select categoria_id from ticket30_context), 100, current_date);

create temporary table ticket30_settlement (
  id uuid, source text, payment_date date, cash_movement_id uuid
) on commit drop;
grant select, insert on ticket30_settlement to authenticated;
insert into ticket30_settlement (id, source, payment_date, cash_movement_id)
select id, source, payment_date, cash_movement_id from public.settle_payable(
  (select id from ticket30_payable), 60, null, 'cash', 0, 0, 'gaveta', (select session_a_id from ticket30_context)
);

select is(
  (select source from ticket30_settlement), 'gaveta',
  'Baixa pela gaveta registra a origem gaveta'
);
select is(
  (select payment_date from ticket30_settlement), current_date,
  'a data do pagamento pela gaveta e o dia de negocio corrente, definida pelo servidor'
);
select ok(
  (select cash_movement_id from ticket30_settlement) is not null,
  'a Baixa pela gaveta grava o vinculo com o movimento de caixa'
);
select is(
  (select type from public.cash_movements where id = (select cash_movement_id from ticket30_settlement)),
  'baixa_conta_pagar',
  'o movimento criado tem o tipo baixa_conta_pagar'
);
select is(
  (select direction from public.cash_movements where id = (select cash_movement_id from ticket30_settlement)),
  'saida',
  'o movimento de pagamento de conta tem sentido de saida'
);
select is(
  (select payable_settlement_id from public.cash_movements where id = (select cash_movement_id from ticket30_settlement)),
  (select id from ticket30_settlement),
  'o movimento aponta de volta para a Baixa que o originou (vinculo bidirecional)'
);
select is(
  (select amount from public.cash_movements where id = (select cash_movement_id from ticket30_settlement)),
  60::numeric,
  'o valor do movimento e o valor pago da Baixa'
);

-- Aceita no limite exato do disponivel (100 - 60 = 40 restantes).
create temporary table ticket30_settlement2 (id uuid, cash_movement_id uuid) on commit drop;
grant select, insert on ticket30_settlement2 to authenticated;
insert into ticket30_settlement2 (id, cash_movement_id)
select id, cash_movement_id from public.settle_payable(
  (select id from ticket30_payable), 40, null, 'cash', 0, 0, 'gaveta', (select session_a_id from ticket30_context)
);
select ok(
  (select cash_movement_id from ticket30_settlement2) is not null,
  'Baixa pela gaveta aceita exatamente no limite do disponivel'
);
select is(
  (select status from public.payables where id = (select id from ticket30_payable)),
  'paid',
  'a conta fica paga apos as duas Baixas pela gaveta somarem o total'
);

-- Indice unico em cada ponta do vinculo bidirecional: uma Baixa nao pode
-- reivindicar a mesma saida de gaveta que outra, e um movimento nao pode ser
-- reivindicado por duas Baixas.
select ok(
  (select indexdef from pg_indexes where indexname = 'idx_payable_settlements_cash_movement_id') ilike 'CREATE UNIQUE INDEX%',
  'idx_payable_settlements_cash_movement_id e um indice unico'
);
select ok(
  (select indexdef from pg_indexes where indexname = 'idx_cash_movements_payable_settlement_unique') ilike 'CREATE UNIQUE INDEX%',
  'idx_cash_movements_payable_settlement_unique e um indice unico'
);

reset role;

-- Recusada acima do disponivel: sobrou zero na gaveta apos as duas Baixas de cima.
select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket30_context), true);
set local role authenticated;

create temporary table ticket30_payable2 (id uuid) on commit drop;
grant select, insert on ticket30_payable2 to authenticated;
insert into ticket30_payable2 (id)
select id from public.create_payable('Ticket30 Excede', (select categoria_id from ticket30_context), 10, current_date);

select throws_ok(
  format(
    $$select * from public.settle_payable('%s'::uuid, 10, null, 'cash', 0, 0, 'gaveta', '%s'::uuid)$$,
    (select id from ticket30_payable2),
    (select session_a_id from ticket30_context)
  ),
  'P0001',
  'O valor pago excede o saldo disponível na gaveta do turno.',
  'Baixa pela gaveta e recusada acima do disponivel'
);

-- Recusada com forma diferente de dinheiro.
select throws_ok(
  format(
    $$select * from public.settle_payable('%s'::uuid, 5, null, 'pix', 0, 0, 'gaveta', '%s'::uuid)$$,
    (select id from ticket30_payable2),
    (select session_a_id from ticket30_context)
  ),
  '22023',
  'Baixa pela gaveta só aceita a forma de pagamento dinheiro.',
  'Baixa pela gaveta recusa forma de pagamento diferente de dinheiro'
);

-- Recusada com sessao de outro tenant.
select throws_ok(
  format(
    $$select * from public.settle_payable('%s'::uuid, 5, null, 'cash', 0, 0, 'gaveta', '%s'::uuid)$$,
    (select id from ticket30_payable2),
    (select session_b_id from ticket30_context)
  ),
  'P0001',
  'A sessão de caixa informada não está aberta ou não pertence à unidade.',
  'Baixa pela gaveta recusa sessao de caixa de outro tenant'
);

-- Fecha a sessao A e tenta dar Baixa com sessao fechada.
select public.close_cash_session(
  (select session_a_id from ticket30_context), (select tenant_a_id from ticket30_context), 40, 'Fechamento ticket 30'
);
select is(
  (select calculation_version from public.cash_sessions where id = (select session_a_id from ticket30_context)),
  'cash_expected_v4',
  'o fechamento grava a versao de calculo nova'
);
select throws_ok(
  format(
    $$select * from public.settle_payable('%s'::uuid, 5, null, 'cash', 0, 0, 'gaveta', '%s'::uuid)$$,
    (select id from ticket30_payable2),
    (select session_a_id from ticket30_context)
  ),
  'P0001',
  'A sessão de caixa informada não está aberta ou não pertence à unidade.',
  'Baixa pela gaveta recusa sessao de caixa fechada'
);

-- Estorno recusado com sessao fechada.
select throws_ok(
  format(
    $$select * from public.reverse_payable_settlement('%s'::uuid, 'Estorno com sessao fechada')$$,
    (select id from ticket30_settlement)
  ),
  'P0001',
  'A sessão de caixa da Baixa está encerrada; reabra o turno antes de estornar.',
  'estorno de Baixa pela gaveta e recusado com a sessao do movimento fechada'
);

reset role;

-- Reabre o turno (RPC do ticket de reabertura, ja existente).
select set_config('request.jwt.claim.sub', (select gerente_a_id::text from ticket30_context), true);
set local role authenticated;

select public.reopen_cash_session(
  (select session_a_id from ticket30_context), (select tenant_a_id from ticket30_context), 'Reabertura para o ticket 30'
);
select is(
  (select status from public.cash_sessions where id = (select session_a_id from ticket30_context)),
  'open',
  'a sessao volta a ficar aberta apos a reabertura'
);

-- Estorno aceito apos a reabertura: devolve o valor a gaveta e marca o movimento.
select public.reverse_payable_settlement((select id from ticket30_settlement), 'Estorno de teste apos reabertura');
select ok(
  (select reversed_at from public.cash_movements where id = (select cash_movement_id from ticket30_settlement)) is not null,
  'o movimento de caixa e marcado como estornado'
);
select is(
  (select reversal_reason from public.cash_movements where id = (select cash_movement_id from ticket30_settlement)),
  'Estorno de teste apos reabertura',
  'o movimento estornado recebe o mesmo motivo do estorno da Baixa'
);
select is(
  (select status from public.payables where id = (select id from ticket30_payable)),
  'partially_paid',
  'a conta volta a ficar parcialmente paga apos o estorno de uma das duas Baixas'
);

-- Extrato mostra a descricao da conta no movimento de pagamento.
select is(
  (
    select m->>'payable_description'
    from jsonb_array_elements(
      (public.get_cash_session_statement((select session_a_id from ticket30_context), (select tenant_a_id from ticket30_context)))->'movements'
    ) m
    where (m->>'id')::uuid = (select cash_movement_id from ticket30_settlement2)
  ),
  'Ticket30 Entregador',
  'o extrato devolve a descricao da Conta a Pagar no movimento de pagamento'
);
select is(
  (
    select m->>'type'
    from jsonb_array_elements(
      (public.get_cash_session_statement((select session_a_id from ticket30_context), (select tenant_a_id from ticket30_context)))->'movements'
    ) m
    where (m->>'id')::uuid = (select cash_movement_id from ticket30_settlement2)
  ),
  'baixa_conta_pagar',
  'o extrato devolve o tipo baixa_conta_pagar no movimento'
);

reset role;

select set_config('request.jwt.claim.sub', (select gerente_b_id::text from ticket30_context), true);
set local role authenticated;

select throws_ok(
  format(
    $$select * from public.settle_payable('%s'::uuid, 5, null, 'cash', 0, 0, 'gaveta', '%s'::uuid, '%s'::uuid)$$,
    (select id from ticket30_payable2),
    (select session_a_id from ticket30_context),
    (select tenant_a_id from ticket30_context)
  ),
  '42501',
  'Acesso negado para esta unidade.',
  'gestor de outro tenant nao da Baixa pela gaveta informando o tenant A explicitamente'
);

reset role;

select * from finish(true);
rollback;
