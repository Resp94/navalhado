begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

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

-- Ticket 03 da spec 034: vale de profissional (cash_movements.type = 'vale_profissional')
-- ja lancado no turno tambem reduz o saldo disponivel para uma quitacao em dinheiro,
-- pelo mesmo motivo que repasse_comissao reduz -- sem isso, o vale sairia da gaveta
-- sem ser descontado do calculo de disponibilidade da quitacao seguinte.
reset role;
create temporary table ticket25b_context (
  user_id uuid not null, tenant_id uuid not null, professional_id uuid not null,
  comanda_id uuid not null, cash_session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket25b_ctx__', '__ticket25b_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket25b_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket25b', '11988880026', 30, true
  from t
  returning id, tenant_id
), com as (
  insert into public.comandas (tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
  select t.id, 'fechada', 0, 0, 0, timezone('utc'::text, now())
  from t
  returning id, tenant_id
), cs as (
  -- Fundo de troco de R$20 e um vale de profissional de R$15 ja lancado no turno:
  -- saldo disponivel na gaveta = R$5.
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 20, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket25b_context (user_id, tenant_id, professional_id, comanda_id, cash_session_id)
select au.id, t.id, prof.id, com.id, cs.id
from t, au, prof, com, cs;

update public.users
set tenant_id = (select tenant_id from ticket25b_context), role = 'gerente', is_active = true
where id = (select user_id from ticket25b_context);

insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, professional_id, quantity, unit_price, total_price,
  snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount,
  snapshot_net_amount, snapshot_commission_percentage, snapshot_commission_amount,
  snapshot_commission_rule, snapshot_status
)
select comanda_id, tenant_id, 'servico', professional_id, 1, 500, 500,
  1, 500, 500, 0, 500, 30, 150, 'professional', 'confirmed'
from ticket25b_context;

insert into public.cash_movements (
  tenant_id, cash_session_id, type, amount, reason, performed_by
)
select tenant_id, cash_session_id, 'vale_profissional', 15, 'Vale ja lancado no turno', user_id
from ticket25b_context;

grant select on ticket25b_context to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket25b_context), true);
set local role authenticated;

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket25b_context), 6, 'cash', 'excede a gaveta com vale considerado', now(),
    (select tenant_id from ticket25b_context), (select cash_session_id from ticket25b_context)
  )$$,
  'P0001',
  'O valor do repasse em dinheiro excede o saldo disponivel na gaveta do turno.',
  'recusa repasse em dinheiro que ignora o vale ja descontado da gaveta'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id = (select cash_session_id from ticket25b_context) and type = 'repasse_comissao'),
  0::bigint,
  'repasse recusado nao gera movimentacao de caixa'
);
select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket25b_context), 5, 'cash', 'exatamente o saldo apos o vale', now(),
    (select tenant_id from ticket25b_context), (select cash_session_id from ticket25b_context)
  )$$,
  'aceita repasse em dinheiro igual ao saldo disponivel apos descontar o vale'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id = (select cash_session_id from ticket25b_context) and type = 'repasse_comissao'),
  1::bigint,
  'repasse aceito no limite correto gera a movimentacao de caixa'
);

-- Ticket 01 da spec 036: com a apuracao unica da gaveta, o disponivel visto
-- pelo vale continua descontando repasses e vales, e so os nao estornados.
-- Gaveta agora: fundo 20 - vale 15 - repasse 5 = 0.
select throws_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket25b_context), 0.01, 'Vale com a gaveta esgotada', 'cash',
    (select tenant_id from ticket25b_context), (select cash_session_id from ticket25b_context)
  )$$,
  'P0001',
  'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.',
  'vale em dinheiro ve o disponivel descontando o repasse e o vale ja lancados'
);

-- Estornar o repasse de 5 devolve o valor a gaveta: disponivel = 20 - 15 = 5.
select lives_ok(
  $$select public.reverse_commission_payout(
    (select id from public.commission_payouts where tenant_id = (select tenant_id from ticket25b_context) and reversed_at is null limit 1),
    (select tenant_id from ticket25b_context), 'Repasse estornado para liberar a gaveta'
  )$$,
  'estorna o repasse em dinheiro com o turno aberto'
);
select throws_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket25b_context), 5.01, 'Vale acima do disponivel', 'cash',
    (select tenant_id from ticket25b_context), (select cash_session_id from ticket25b_context)
  )$$,
  'P0001',
  'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.',
  'vale em dinheiro continua descontando o vale ja lancado depois do estorno do repasse'
);
select lives_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket25b_context), 5, 'Vale no limite do disponivel', 'cash',
    (select tenant_id from ticket25b_context), (select cash_session_id from ticket25b_context)
  )$$,
  'vale em dinheiro aceito no limite, sem descontar o repasse estornado'
);
select lives_ok(
  $$select public.close_cash_session(
    (select cash_session_id from ticket25b_context),
    (select tenant_id from ticket25b_context),
    0,
    'Fechamento com repasse estornado e vales ativos'
  )$$,
  'fecha o turno depois do vale no limite do disponivel'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select cash_session_id from ticket25b_context)),
  0::numeric,
  'valor esperado zero: 20 de fundo - 15 de vale - 5 de vale, repasse estornado nao conta'
);

reset role;

-- Ticket 03 da spec 036: sangria por RPC (register_cash_movement) tambem
-- recusa valor acima do disponivel na gaveta, pelo mesmo motivo que a
-- quitacao de comissao e o vale -- deixar expected_amount negativo trava o
-- fechamento do turno (cash_sessions_expected_amount_check).
create temporary table ticket36_03_context (
  user_id uuid not null, tenant_id uuid not null, cash_session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket36_03_ctx__', '__ticket36_03_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket36_03_ctx__auth@teste.com')
  returning id
), cs as (
  -- Fundo de troco de R$30 e nenhuma outra entrada: saldo disponivel = R$30.
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 30, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket36_03_context (user_id, tenant_id, cash_session_id)
select au.id, t.id, cs.id
from t, au, cs;

update public.users
set tenant_id = (select tenant_id from ticket36_03_context), role = 'gerente', is_active = true
where id = (select user_id from ticket36_03_context);

grant select on ticket36_03_context to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket36_03_context), true);
set local role authenticated;

select throws_ok(
  $$select public.register_cash_movement(
    (select cash_session_id from ticket36_03_context), (select tenant_id from ticket36_03_context),
    'sangria', 30.01, 'sangria acima do disponivel'
  )$$,
  'P0001',
  'O valor da sangria excede o saldo disponível na gaveta do turno.',
  'recusa sangria maior que o saldo disponivel na gaveta'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id = (select cash_session_id from ticket36_03_context)),
  0::bigint,
  'sangria recusada nao persiste movimentacao'
);

select lives_ok(
  $$select public.register_cash_movement(
    (select cash_session_id from ticket36_03_context), (select tenant_id from ticket36_03_context),
    'sangria', 30, 'sangria exatamente no disponivel'
  )$$,
  'aceita sangria igual ao saldo disponivel na gaveta'
);
select is(
  (select count(*) from public.cash_movements where cash_session_id = (select cash_session_id from ticket36_03_context) and type = 'sangria'),
  1::bigint,
  'sangria aceita gera a movimentacao de caixa, com autor da sessao autenticada'
);

-- Turno fecha normalmente: expected_amount nao fica negativo (30 de fundo -
-- 30 de sangria = 0), a mesma prova que 25 ja faz para repasse e vale.
select lives_ok(
  $$select public.close_cash_session(
    (select cash_session_id from ticket36_03_context),
    (select tenant_id from ticket36_03_context),
    0,
    'Fechamento apos sangria no limite do saldo da gaveta'
  )$$,
  'fecha o turno normalmente quando a sangria respeitou o saldo da gaveta'
);
select is(
  (select expected_amount from public.cash_sessions where id = (select cash_session_id from ticket36_03_context)),
  0::numeric,
  'valor esperado zero: 30 de fundo - 30 de sangria'
);

reset role;

-- Ticket 15 da spec 036: pagamento de conta pela gaveta e um movimento de
-- saida como qualquer outro para a apuracao unica do ticket 01/036 -- reduz o
-- disponivel visto por sangria e vale, sem nenhuma mudanca nessas RPCs.
create temporary table ticket36_15_context (
  user_id uuid not null, tenant_id uuid not null, categoria_id uuid not null,
  cash_session_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket36_15_ctx__', '__ticket36_15_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket36_15_ctx__auth@teste.com')
  returning id
), cat as (
  insert into public.financial_categories (tenant_id, nature, name)
  select t.id, 'expense', 'Ticket36_15 Categoria' from t returning id
), cs as (
  -- Fundo de troco de R$50: saldo disponivel inicial = R$50.
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 50, 'open'
  from t, au
  returning id
)
insert into ticket36_15_context (user_id, tenant_id, categoria_id, cash_session_id)
select au.id, t.id, cat.id, cs.id
from t, au, cat, cs;

update public.users
set tenant_id = (select tenant_id from ticket36_15_context), role = 'gerente', is_active = true
where id = (select user_id from ticket36_15_context);

grant select on ticket36_15_context to authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket36_15_context), true);
set local role authenticated;

-- Baixa de conta pela gaveta consome 20 do fundo: disponivel passa a 30.
create temporary table ticket36_15_payable (id uuid) on commit drop;
grant select, insert on ticket36_15_payable to authenticated;
insert into ticket36_15_payable (id)
select id from public.create_payable(
  'Ticket36_15 Entregador', (select categoria_id from ticket36_15_context), 20, current_date
);
select public.settle_payable(
  (select id from ticket36_15_payable), 20, null, 'cash', 0, 0, 'gaveta',
  (select cash_session_id from ticket36_15_context)
);

select throws_ok(
  $$select public.register_cash_movement(
    (select cash_session_id from ticket36_15_context), (select tenant_id from ticket36_15_context),
    'sangria', 30.01, 'sangria acima do disponivel apos pagamento de conta'
  )$$,
  'P0001',
  'O valor da sangria excede o saldo disponível na gaveta do turno.',
  'pagamento de conta pela gaveta reduz o disponivel visto pela sangria'
);
select lives_ok(
  $$select public.register_cash_movement(
    (select cash_session_id from ticket36_15_context), (select tenant_id from ticket36_15_context),
    'sangria', 30, 'sangria exatamente no disponivel apos pagamento de conta'
  )$$,
  'aceita sangria igual ao disponivel apos descontar o pagamento de conta pela gaveta (50 - 20 - 30 = 0)'
);

reset role;
select * from finish(true);
rollback;
