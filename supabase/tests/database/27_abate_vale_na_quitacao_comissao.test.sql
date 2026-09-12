begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Ticket 06 da spec 034: abate de vale (debito) na Quitacao de Comissao.
-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
--
-- A obrigacao de comissao precisa nascer do trigger real (comanda aberta ->
-- settle_comanda fecha -> trg_create_commission_obligations dispara), nao de um
-- insert direto com status='fechada': esse atalho cai no caminho "legado" de
-- comanda_itens sem obrigacao vinculada, que nao e o que este ticket testa.
create temporary table ticket27_context (
  gerente_id uuid not null, tenant_id uuid not null,
  professional_id uuid not null, service_id uuid not null, cash_session_id uuid not null,
  comanda_id uuid not null, comanda2_id uuid not null,
  vale_a_id uuid, vale_b_id uuid, payout_id uuid
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket27_ctx__', '__ticket27_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket27_gerente__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket27', '11988880040', 20, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Ticket27', 500, 'corte', true
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket27_context (gerente_id, tenant_id, professional_id, service_id, cash_session_id, comanda_id, comanda2_id)
select au.id, t.id, prof.id, svc.id, cs.id, gen_random_uuid(), gen_random_uuid()
from t, au, prof, svc, cs;

update public.users
set tenant_id = (select tenant_id from ticket27_context), role = 'gerente', is_active = true
where id = (select gerente_id from ticket27_context);

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, tenant_id, 'aberta', 0, 0, 0
from ticket27_context
union all
select comanda2_id, tenant_id, 'aberta', 0, 0, 0
from ticket27_context;

grant select, update on ticket27_context to authenticated;

select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket27_context), true);
set local role authenticated;

-- Fecha a comanda de verdade: item de R$500 com profissional a 20% de comissao
-- gera uma obrigacao rastreada de R$100 -- a "conta" que a quitacao com abate
-- vai fechar exatamente mais abaixo.
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_id from ticket27_context), (select tenant_id from ticket27_context),
    null, null, 0, 0, (select cash_session_id from ticket27_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket27_context),'professional_id',(select professional_id from ticket27_context),'quantity',1,'unit_price',500)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',500))
  )$$,
  'fecha a comanda e gera a obrigacao de comissao rastreada de R$100'
);

select is(
  (public.get_professional_commission_balance(
    (select professional_id from ticket27_context), null, null, (select tenant_id from ticket27_context)
  )->>'advances_open_amount')::numeric,
  0::numeric,
  'sem vale lancado, saldo de vale em aberto e zero'
);

-- Dois vales, A mais antigo que B (FIFO consome A primeiro).
select lives_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket27_context), 20, 'Vale A (mais antigo)', 'pix',
    (select tenant_id from ticket27_context)
  )$$,
  'lanca o vale A'
);
select lives_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket27_context), 15, 'Vale B (mais novo)', 'pix',
    (select tenant_id from ticket27_context)
  )$$,
  'lanca o vale B'
);

update ticket27_context set
  vale_a_id = (select id from public.professional_account_entries where reason = 'Vale A (mais antigo)'),
  vale_b_id = (select id from public.professional_account_entries where reason = 'Vale B (mais novo)');

-- now() fica congelado no inicio da transacao: forca created_at distintos para
-- garantir a ordem FIFO independente de quando cada insert ocorreu na transacao.
reset role;
update public.professional_account_entries
set created_at = created_at - interval '1 minute'
where id = (select vale_a_id from ticket27_context);
select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket27_context), true);
set local role authenticated;

select is(
  (public.get_professional_commission_balance(
    (select professional_id from ticket27_context), null, null, (select tenant_id from ticket27_context)
  )->>'advances_open_amount')::numeric,
  35::numeric,
  'saldo de vale em aberto soma os dois vales lancados'
);
select is(
  (public.get_professional_commission_balance(
    (select professional_id from ticket27_context), null, null, (select tenant_id from ticket27_context)
  )->>'credits_open_amount')::numeric,
  0::numeric,
  'sem gorjeta lancada, saldo de credito em aberto e zero'
);
select is(
  (public.get_professional_commission_balance(
    (select professional_id from ticket27_context), null, null, (select tenant_id from ticket27_context)
  )->>'suggested_net_amount')::numeric,
  65::numeric,
  'liquido sugerido e a comissao aberta (100) menos o vale aberto (35)'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket27_context), 10, 'pix', 'tentativa com credito', now(),
    (select tenant_id from ticket27_context), null, 0, 5
  )$$,
  'P0001',
  'Pagamento de credito de gorjeta ainda nao esta disponivel.',
  'recusa credito diferente de zero (ainda nao liberado -- ticket 07)'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket27_context), 10, 'pix', 'abate maior que o vale', now(),
    (select tenant_id from ticket27_context), null, 36, 0
  )$$,
  'P0001',
  'O valor do abate excede o saldo de vales em aberto do profissional.',
  'recusa abate maior que o saldo de vale em aberto do profissional'
);

-- Abate parcial FIFO: 25 de abate drena o vale A (20) inteiro e 5 do vale B (15),
-- deixando o vale B parcialmente pago. payout (75) + abate (25) = 100 = a obrigacao inteira.
select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket27_context), 75, 'pix', 'quitacao com abate parcial', now(),
    (select tenant_id from ticket27_context), null, 25, 0
  )$$,
  'aceita quitacao com abate parcial que fecha exatamente a obrigacao'
);

update ticket27_context set payout_id = (
  select id from public.commission_payouts where notes = 'quitacao com abate parcial'
);

select is(
  (select status from public.commission_obligations where comanda_id = (select comanda_id from ticket27_context)),
  'paid',
  'a obrigacao de comissao fica totalmente quitada (dinheiro + abate)'
);
select is(
  (select settled_amount from public.commission_obligations where comanda_id = (select comanda_id from ticket27_context)),
  100::numeric,
  'o valor quitado da obrigacao e o total reconciliado (75 + 25)'
);
select is(
  (select status from public.professional_account_entries where id = (select vale_a_id from ticket27_context)),
  'settled',
  'o vale mais antigo (A) e totalmente quitado primeiro (FIFO)'
);
select is(
  (select settled_amount from public.professional_account_entries where id = (select vale_a_id from ticket27_context)),
  20::numeric,
  'o vale A e quitado no valor integral'
);
select is(
  (select status from public.professional_account_entries where id = (select vale_b_id from ticket27_context)),
  'partially_paid',
  'o vale mais novo (B) fica parcialmente quitado com o restante do abate'
);
select is(
  (select settled_amount from public.professional_account_entries where id = (select vale_b_id from ticket27_context)),
  5::numeric,
  'o vale B recebe apenas o que sobrou do abate (25 - 20)'
);
select is(
  (select count(*)::integer from public.professional_advance_allocations where payout_id = (select payout_id from ticket27_context)),
  2,
  'a quitacao gera rateio para os dois vales tocados'
);
select is(
  (select sum(amount) from public.professional_advance_allocations where payout_id = (select payout_id from ticket27_context)),
  25::numeric,
  'o rateio soma exatamente o valor abatido'
);
select is(
  (select advance_amount from public.commission_payouts where id = (select payout_id from ticket27_context)),
  25::numeric,
  'a quitacao registra o valor abatido para auditoria'
);

-- Segunda obrigacao (R$15, profissional a 20% sobre R$75) isolada da primeira
-- (ja totalmente quitada acima): garante que o novo abate tentado a seguir
-- esbarre no limite do saldo de vale (10 restante), nao no limite generico de
-- comissao pendente (que aqui comporta os 15 solicitados).
select lives_ok(
  $$select public.settle_comanda(
    (select comanda2_id from ticket27_context), (select tenant_id from ticket27_context),
    null, null, 0, 0, (select cash_session_id from ticket27_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket27_context),'professional_id',(select professional_id from ticket27_context),'quantity',1,'unit_price',75)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',75))
  )$$,
  'fecha a segunda comanda e gera uma obrigacao independente de R$15'
);

select throws_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket27_context), 4, 'pix', 'novo abate excede o restante', now(),
    (select tenant_id from ticket27_context), null, 11, 0
  )$$,
  'P0001',
  'O valor do abate excede o saldo de vales em aberto do profissional.',
  'apos o abate parcial, recusa novo abate maior que o saldo restante (10) mesmo com comissao pendente suficiente (15)'
);

-- Estorno: devolve tanto a obrigacao quanto os dois vales ao estado aberto.
select lives_ok(
  $$select public.reverse_commission_payout(
    (select payout_id from ticket27_context), (select tenant_id from ticket27_context), 'Quitacao lancada por engano'
  )$$,
  'estorna a quitacao com abate'
);
select is(
  (select status from public.commission_obligations where comanda_id = (select comanda_id from ticket27_context)),
  'open',
  'estorno devolve a obrigacao de comissao ao estado aberto'
);
select is(
  (select status from public.professional_account_entries where id = (select vale_a_id from ticket27_context)),
  'open',
  'estorno devolve o vale A ao estado aberto'
);
select is(
  (select settled_amount from public.professional_account_entries where id = (select vale_b_id from ticket27_context)),
  0::numeric,
  'estorno zera o valor quitado do vale B'
);

-- Ordem de lock fixa: no codigo da funcao, a alocacao de vales (professional_advance_allocations)
-- aparece depois da alocacao de obrigacoes (commission_payout_allocations).
select ok(
  (
    select position(
      'insert into public.professional_advance_allocations' in pg_get_functiondef(
        'public.register_commission_payout(uuid,numeric,text,text,timestamp with time zone,uuid,uuid,numeric,numeric)'::regprocedure
      )
    )
  ) > (
    select position(
      'insert into public.commission_payout_allocations' in pg_get_functiondef(
        'public.register_commission_payout(uuid,numeric,text,text,timestamp with time zone,uuid,uuid,numeric,numeric)'::regprocedure
      )
    )
  ),
  'ordem de lock fixa: alocacao de vales aparece depois da alocacao de obrigacoes no codigo da funcao'
);

reset role;

-- Fronteira de arredondamento: obrigacao e vale com centavos que nao se dividem
-- exatamente; o liquido sugerido deve ser identico ao liquido liquidado.
-- Item de R$333,40 com profissional a 10% de comissao gera obrigacao de R$33,34
-- exatos; vale de R$10,01 deixa liquido sugerido de R$23,33.
create temporary table ticket27b_context (
  gerente_id uuid not null, tenant_id uuid not null,
  professional_id uuid not null, service_id uuid not null, cash_session_id uuid not null,
  comanda_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket27b_ctx__', '__ticket27b_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket27b_gerente__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket27b', '11988880041', 10, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Ticket27b', 333.4, 'corte', true
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 0, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket27b_context (gerente_id, tenant_id, professional_id, service_id, cash_session_id, comanda_id)
select au.id, t.id, prof.id, svc.id, cs.id, gen_random_uuid()
from t, au, prof, svc, cs;

update public.users
set tenant_id = (select tenant_id from ticket27b_context), role = 'gerente', is_active = true
where id = (select gerente_id from ticket27b_context);

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_id, tenant_id, 'aberta', 0, 0, 0
from ticket27b_context;

grant select on ticket27b_context to authenticated;

select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket27b_context), true);
set local role authenticated;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_id from ticket27b_context), (select tenant_id from ticket27b_context),
    null, null, 0, 0, (select cash_session_id from ticket27b_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket27b_context),'professional_id',(select professional_id from ticket27b_context),'quantity',1,'unit_price',333.4)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',333.4))
  )$$,
  'fecha a comanda e gera a obrigacao fracionada de R$33,34'
);

select lives_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket27b_context), 10.01, 'Vale para teste de arredondamento', 'pix',
    (select tenant_id from ticket27b_context)
  )$$,
  'lanca vale fracionado para o teste de arredondamento'
);

select is(
  (public.get_professional_commission_balance(
    (select professional_id from ticket27b_context), null, null, (select tenant_id from ticket27b_context)
  )->>'suggested_net_amount')::numeric,
  23.33::numeric,
  'liquido sugerido e exatamente 33.34 - 10.01 = 23.33'
);

select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket27b_context), 23.33, 'pix', 'quitacao no liquido sugerido exato', now(),
    (select tenant_id from ticket27b_context), null, 10.01, 0
  )$$,
  'liquido sugerido liquidado sem residuo de arredondamento'
);
select is(
  (select settled_amount from public.commission_obligations where comanda_id = (select comanda_id from ticket27b_context)),
  33.34::numeric,
  'a obrigacao fecha exatamente, sem sobra nem falta por arredondamento'
);

reset role;
select * from finish(true);
rollback;
