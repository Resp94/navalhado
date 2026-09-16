begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- Ticket 04 da spec 034: Conta do Profissional com gorjeta como credito.
-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
create temporary table ticket26_context (
  gerente_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null,
  professional_user_id uuid not null,
  outro_professional_id uuid not null,
  outro_professional_user_id uuid not null,
  comanda_a_id uuid not null,
  comanda_b_id uuid not null,
  comanda_c_id uuid not null,
  comanda_d_id uuid not null
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket26_ctx__', '__ticket26_ctx__@teste.com', '11999999999')
  returning id
), au_gerente as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket26_gerente__auth@teste.com')
  returning id
), au_prof as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket26_prof__auth@teste.com')
  returning id
), au_outro as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket26_outro__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, user_id, name, phone, commission_percentage, is_active)
  select t.id, au_prof.id, 'Profissional Ticket26', '11988880026', 30, true
  from t, au_prof
  returning id, tenant_id
), outro_prof as (
  insert into public.professionals (tenant_id, user_id, name, phone, commission_percentage, is_active)
  select t.id, au_outro.id, 'Outro Profissional Ticket26', '11988880027', 30, true
  from t, au_outro
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Ticket26', 50, 'corte', true
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au_gerente.id, 0, 'open'
  from t, au_gerente
  returning id, tenant_id
)
insert into ticket26_context (
  gerente_id, tenant_id, cash_session_id, service_id,
  professional_id, professional_user_id, outro_professional_id, outro_professional_user_id,
  comanda_a_id, comanda_b_id, comanda_c_id, comanda_d_id
)
select au_gerente.id, t.id, cs.id, svc.id,
  prof.id, au_prof.id, outro_prof.id, au_outro.id,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from t, au_gerente, au_prof, au_outro, prof, outro_prof, svc, cs;

update public.users
set tenant_id = (select tenant_id from ticket26_context), role = 'gerente', is_active = true
where id = (select gerente_id from ticket26_context);
update public.users
set tenant_id = (select tenant_id from ticket26_context), role = 'barbeiro', is_active = true
where id = (select professional_user_id from ticket26_context);
update public.users
set tenant_id = (select tenant_id from ticket26_context), role = 'barbeiro', is_active = true
where id = (select outro_professional_user_id from ticket26_context);

grant select on ticket26_context to authenticated;

select ok((select count(*) from ticket26_context) = 1, 'encontra contexto sintetico completo');
select has_table('public', 'professional_account_entries', 'tabela da Conta do Profissional existe');

reset role;

-- Comanda A: fecha com gorjeta e profissional atribuido -> credito deve nascer.
-- A atribuicao (ticket 04) e parametro do proprio settle_comanda, nao pre-escrita
-- na comanda aberta: por isso as linhas abaixo nao tocam tip_professional_id.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_a_id, tenant_id, 'aberta', 0, 0, 0
from ticket26_context;
insert into public.comanda_itens (comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price)
select comanda_a_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50
from ticket26_context;

-- Comanda B: gorjeta > 0 mas sem profissional atribuido -> nenhum credito (estado aceito, sem atribuicao).
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_b_id, tenant_id, 'aberta', 0, 0, 0
from ticket26_context;
insert into public.comanda_itens (comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price)
select comanda_b_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50
from ticket26_context;

-- Comanda C: profissional atribuido mas gorjeta zero -> nenhum credito.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_c_id, tenant_id, 'aberta', 0, 0, 0
from ticket26_context;
insert into public.comanda_itens (comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price)
select comanda_c_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50
from ticket26_context;

select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket26_context), true);
set local role authenticated;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_a_id from ticket26_context), (select tenant_id from ticket26_context),
    null, null, 0, 15, (select cash_session_id from ticket26_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket26_context),'professional_id',(select professional_id from ticket26_context),'quantity',1,'unit_price',50)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',65)),
    (select professional_id from ticket26_context)
  )$$,
  'fecha comanda A com gorjeta e profissional atribuido'
);
select is(
  (select count(*)::integer from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context)),
  1,
  'gera exatamente um credito de gorjeta para a comanda A'
);
select is(
  (select amount from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context)),
  15::numeric,
  'credito registra o valor exato da gorjeta'
);
select is(
  (select professional_id from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context)),
  (select professional_id from ticket26_context),
  'credito atribuido ao profissional correto'
);
select is(
  (select entry_type from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context)),
  'gorjeta',
  'lancamento classificado como gorjeta'
);
select is(
  (select direction from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context)),
  'credit',
  'lancamento de gorjeta e um credito'
);
select is(
  (select status from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context)),
  'open',
  'credito nasce em aberto'
);
select is(
  (select tip_professional_id from public.comandas where id = (select comanda_a_id from ticket26_context)),
  (select professional_id from ticket26_context),
  'settle_comanda persiste a atribuicao no proprio fechamento, nao por escrita separada'
);

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_b_id from ticket26_context), (select tenant_id from ticket26_context),
    null, null, 0, 10, (select cash_session_id from ticket26_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket26_context),'professional_id',(select professional_id from ticket26_context),'quantity',1,'unit_price',50)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',60)),
    null
  )$$,
  'fecha comanda B com gorjeta sem profissional atribuido'
);
select is(
  (select count(*)::integer from public.professional_account_entries where comanda_id = (select comanda_b_id from ticket26_context)),
  0,
  'gorjeta sem atribuicao nao gera credito (estado aceito, sem backfill)'
);

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_c_id from ticket26_context), (select tenant_id from ticket26_context),
    null, null, 0, 0, (select cash_session_id from ticket26_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket26_context),'professional_id',(select professional_id from ticket26_context),'quantity',1,'unit_price',50)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',50)),
    (select professional_id from ticket26_context)
  )$$,
  'fecha comanda C sem gorjeta'
);
select is(
  (select count(*)::integer from public.professional_account_entries where comanda_id = (select comanda_c_id from ticket26_context)),
  0,
  'gorjeta zero nao gera credito'
);

-- Reabertura da comanda A: credito em aberto deve ser estornado.
select lives_ok(
  $$select public.reopen_comanda((select comanda_a_id from ticket26_context), (select tenant_id from ticket26_context))$$,
  'reabre a comanda A com credito de gorjeta ainda em aberto'
);
select is(
  (select status from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context) and reversed_at is not null),
  'reversed',
  'reabertura estorna o credito de gorjeta em aberto'
);

-- Fechar de novo: novo credito nasce sem colidir com o antigo (dedup pelo indice parcial).
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_a_id from ticket26_context), (select tenant_id from ticket26_context),
    null, null, 0, 20, (select cash_session_id from ticket26_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket26_context),'professional_id',(select professional_id from ticket26_context),'quantity',1,'unit_price',50)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',70)),
    (select professional_id from ticket26_context)
  )$$,
  'fecha a comanda A novamente apos a reabertura'
);
select is(
  (select count(*)::integer from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context)),
  2,
  'existem duas linhas para a comanda A: a estornada e a nova'
);
select is(
  (select count(*)::integer from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context) and reversed_at is null),
  1,
  'apenas uma linha permanece em aberto (indice parcial nao colide)'
);
select is(
  (select amount from public.professional_account_entries where comanda_id = (select comanda_a_id from ticket26_context) and reversed_at is null),
  20::numeric,
  'a linha nova reflete o valor do fechamento mais recente'
);

reset role;

-- Comanda D: simula quitacao (ticket 07 ainda nao existe) marcando o credito como
-- liquidado diretamente, para provar que reopen_comanda recusa reabrir gorjeta ja quitada.
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda_d_id, tenant_id, 'aberta', 0, 0, 0
from ticket26_context;
insert into public.comanda_itens (comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price)
select comanda_d_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50
from ticket26_context;

set local role authenticated;
select lives_ok(
  $$select public.settle_comanda(
    (select comanda_d_id from ticket26_context), (select tenant_id from ticket26_context),
    null, null, 0, 12, (select cash_session_id from ticket26_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket26_context),'professional_id',(select professional_id from ticket26_context),'quantity',1,'unit_price',50)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',62)),
    (select professional_id from ticket26_context)
  )$$,
  'fecha a comanda D com gorjeta'
);

reset role;
update public.professional_account_entries
set settled_amount = amount, status = 'settled'
where comanda_id = (select comanda_d_id from ticket26_context);

set local role authenticated;
select throws_ok(
  $$select public.reopen_comanda((select comanda_d_id from ticket26_context), (select tenant_id from ticket26_context))$$,
  'P0001',
  'A comanda possui gorjeta ja quitada; estorne a quitacao antes de reabrir.',
  'recusa reabrir comanda com gorjeta ja quitada na Conta do Profissional'
);

-- Isolamento de leitura: o profissional le a propria conta e nao a do colega.
select set_config('request.jwt.claim.sub', (select professional_user_id::text from ticket26_context), true);
select is(
  (select count(*)::integer from public.professional_account_entries where tenant_id = (select tenant_id from ticket26_context)),
  3,
  'o profissional dono das gorjetas ve todas as suas linhas (comanda A: reabertura + relancamento, mais comanda D)'
);

select set_config('request.jwt.claim.sub', (select outro_professional_user_id::text from ticket26_context), true);
select is(
  (select count(*)::integer from public.professional_account_entries where tenant_id = (select tenant_id from ticket26_context)),
  0,
  'outro profissional nao ve as gorjetas do colega'
);

-- Escrita direta continua exclusiva de funcoes security definer.
select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket26_context), true);
select throws_ok(
  $$insert into public.professional_account_entries (
    tenant_id, professional_id, entry_type, direction, amount, reason
  ) values (
    (select tenant_id from ticket26_context), (select professional_id from ticket26_context),
    'gorjeta', 'credit', 5, 'Tentativa direta'
  )$$,
  '42501',
  'permission denied for table professional_account_entries',
  'gerente autenticado nao pode inserir diretamente na Conta do Profissional'
);

-- Ticket 05 da spec 034: vale de profissional como debito na Conta do Profissional.
reset role;
create temporary table ticket26v_context (
  gerente_id uuid not null, tenant_id uuid not null,
  professional_id uuid not null, cash_session_id uuid not null,
  entry_id uuid
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket26v_ctx__', '__ticket26v_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket26v_gerente__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket26 Vale', '11988880032', 30, true
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au.id, 100, 'open'
  from t, au
  returning id, tenant_id
)
insert into ticket26v_context (gerente_id, tenant_id, professional_id, cash_session_id)
select au.id, t.id, prof.id, cs.id
from t, au, prof, cs;

update public.users
set tenant_id = (select tenant_id from ticket26v_context), role = 'gerente', is_active = true
where id = (select gerente_id from ticket26v_context);

grant select, update on ticket26v_context to authenticated;

select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket26v_context), true);
set local role authenticated;

select throws_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket26v_context), 10, 'oi', 'cash',
    (select tenant_id from ticket26v_context), (select cash_session_id from ticket26v_context)
  )$$,
  '22023',
  'Informe um motivo com pelo menos cinco caracteres.',
  'recusa vale com motivo curto demais'
);

select throws_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket26v_context), 10, 'Adiantamento combinado', 'pix',
    (select tenant_id from ticket26v_context), (select cash_session_id from ticket26v_context)
  )$$,
  '22023',
  'Sessao de caixa so pode ser informada para vale em dinheiro.',
  'recusa sessao de caixa informada para vale que nao seja em dinheiro'
);

select throws_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket26v_context), 150, 'Adiantamento alto demais', 'cash',
    (select tenant_id from ticket26v_context), (select cash_session_id from ticket26v_context)
  )$$,
  'P0001',
  'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.',
  'recusa vale em dinheiro acima do saldo disponivel na gaveta'
);
select is(
  (select count(*)::integer from public.professional_account_entries where tenant_id = (select tenant_id from ticket26v_context)),
  0,
  'nenhuma das tentativas recusadas persiste lancamento'
);

select lives_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket26v_context), 30, 'Adiantamento para o corte de cabelo', 'cash',
    (select tenant_id from ticket26v_context), (select cash_session_id from ticket26v_context)
  )$$,
  'aceita vale em dinheiro dentro do saldo disponivel'
);
select is(
  (select entry_type from public.professional_account_entries where tenant_id = (select tenant_id from ticket26v_context)),
  'vale',
  'lancamento classificado como vale'
);
select is(
  (select direction from public.professional_account_entries where tenant_id = (select tenant_id from ticket26v_context)),
  'debit',
  'lancamento de vale e um debito'
);
select is(
  (select count(*)::integer from public.cash_movements where cash_session_id = (select cash_session_id from ticket26v_context) and type = 'vale_profissional'),
  1,
  'gera movimento de caixa do tipo vale_profissional'
);
select ok(
  (select cash_movement_id is not null from public.professional_account_entries where tenant_id = (select tenant_id from ticket26v_context)),
  'lancamento aponta para o movimento de caixa (vinculo bidirecional)'
);
select is(
  (select professional_id from public.cash_movements where cash_session_id = (select cash_session_id from ticket26v_context) and type = 'vale_profissional'),
  (select professional_id from ticket26v_context),
  'movimento de caixa aponta para o profissional correto'
);

select throws_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket26v_context), 71, 'Segundo adiantamento', 'cash',
    (select tenant_id from ticket26v_context), (select cash_session_id from ticket26v_context)
  )$$,
  'P0001',
  'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.',
  'considera o vale ja lancado ao validar novo vale em dinheiro'
);

update ticket26v_context set entry_id = (
  select id from public.professional_account_entries where tenant_id = (select tenant_id from ticket26v_context) limit 1
);

select lives_ok(
  $$select public.reverse_professional_advance(
    (select entry_id from ticket26v_context), (select tenant_id from ticket26v_context), 'Lancado por engano'
  )$$,
  'estorna o vale com justificativa'
);
select is(
  (select status from public.professional_account_entries where id = (select entry_id from ticket26v_context)),
  'reversed',
  'vale estornado muda de estado'
);
select ok(
  (select reversed_at is not null and reversed_by is not null from public.professional_account_entries where id = (select entry_id from ticket26v_context)),
  'registra autor e instante do estorno'
);
select ok(
  (select reversed_at is not null from public.cash_movements where cash_session_id = (select cash_session_id from ticket26v_context) and type = 'vale_profissional'),
  'estorna tambem o movimento de caixa vinculado'
);

select lives_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket26v_context), 71, 'Terceiro adiantamento apos estorno', 'cash',
    (select tenant_id from ticket26v_context), (select cash_session_id from ticket26v_context)
  )$$,
  'vale estornado libera saldo para um novo vale'
);

reset role;

-- Ticket 08 da spec 034: extrato cronologico da Conta do Profissional.
-- Contexto proprio com os tres tipos de lancamento (vale, gorjeta, quitacao)
-- e dois profissionais, para cobrir tanto o conteudo do extrato quanto o
-- isolamento de acesso entre gestor, dono da conta e colega.
create temporary table ticket26e_context (
  gerente_id uuid not null, tenant_id uuid not null,
  service_id uuid not null, cash_session_id uuid not null,
  professional_id uuid not null, professional_user_id uuid not null,
  outro_professional_id uuid not null, outro_professional_user_id uuid not null,
  comanda1_id uuid not null, comanda2_id uuid not null,
  vale_entry_id uuid, gorjeta_entry_id uuid, payout_id uuid,
  statement_gerente jsonb, statement_dono jsonb
) on commit drop;

with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket26e_ctx__', '__ticket26e_ctx__@teste.com', '11999999999')
  returning id
), au_gerente as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket26e_gerente__auth@teste.com')
  returning id
), au_dono as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket26e_dono__auth@teste.com')
  returning id
), au_colega as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket26e_colega__auth@teste.com')
  returning id
), dono as (
  insert into public.professionals (tenant_id, user_id, name, phone, commission_percentage, is_active)
  select t.id, au_dono.id, 'Profissional Extrato', '11988880050', 20, true
  from t, au_dono
  returning id, tenant_id
), colega as (
  insert into public.professionals (tenant_id, user_id, name, phone, commission_percentage, is_active)
  select t.id, au_colega.id, 'Colega do Extrato', '11988880051', 20, true
  from t, au_colega
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Extrato', 100, 'corte', true
  from t
  returning id, tenant_id
), cs as (
  insert into public.cash_sessions (tenant_id, opened_by, initial_amount, status)
  select t.id, au_gerente.id, 0, 'open'
  from t, au_gerente
  returning id, tenant_id
)
insert into ticket26e_context (
  gerente_id, tenant_id, service_id, cash_session_id,
  professional_id, professional_user_id, outro_professional_id, outro_professional_user_id,
  comanda1_id, comanda2_id
)
select au_gerente.id, t.id, svc.id, cs.id,
  dono.id, au_dono.id, colega.id, au_colega.id,
  gen_random_uuid(), gen_random_uuid()
from t, au_gerente, au_dono, au_colega, dono, colega, svc, cs;

update public.users
set tenant_id = (select tenant_id from ticket26e_context), role = 'gerente', is_active = true
where id = (select gerente_id from ticket26e_context);

update public.users
set tenant_id = (select tenant_id from ticket26e_context), role = 'barbeiro', is_active = true
where id = (select professional_user_id from ticket26e_context);

update public.users
set tenant_id = (select tenant_id from ticket26e_context), role = 'barbeiro', is_active = true
where id = (select outro_professional_user_id from ticket26e_context);

insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount)
select comanda1_id, tenant_id, 'aberta', 0, 0, 0 from ticket26e_context
union all
select comanda2_id, tenant_id, 'aberta', 0, 0, 0 from ticket26e_context;

grant select, update on ticket26e_context to authenticated;

select set_config('request.jwt.claim.sub', (select gerente_id::text from ticket26e_context), true);
set local role authenticated;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda1_id from ticket26e_context), (select tenant_id from ticket26e_context),
    null, null, 0, 0, (select cash_session_id from ticket26e_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket26e_context),'professional_id',(select professional_id from ticket26e_context),'quantity',1,'unit_price',100)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',100))
  )$$,
  'fecha comanda base e gera obrigacao de comissao de R$20'
);

select lives_ok(
  $$select public.register_professional_advance(
    (select professional_id from ticket26e_context), 5, 'Vale para o extrato', 'pix',
    (select tenant_id from ticket26e_context)
  )$$,
  'lanca um vale para o profissional'
);

select lives_ok(
  $$select public.settle_comanda(
    (select comanda2_id from ticket26e_context), (select tenant_id from ticket26e_context),
    null, null, 0, 8, (select cash_session_id from ticket26e_context),
    jsonb_build_array(jsonb_build_object('item_type','servico','service_id',(select service_id from ticket26e_context),'professional_id',(select professional_id from ticket26e_context),'quantity',1,'unit_price',100)),
    jsonb_build_array(jsonb_build_object('payment_method','pix','amount',108)),
    (select professional_id from ticket26e_context)
  )$$,
  'fecha segunda comanda com gorjeta de R$8 para o profissional'
);

update ticket26e_context set
  vale_entry_id = (select id from public.professional_account_entries where reason = 'Vale para o extrato'),
  gorjeta_entry_id = (select id from public.professional_account_entries where comanda_id = (select comanda2_id from ticket26e_context));

select lives_ok(
  $$select public.reverse_professional_advance(
    (select vale_entry_id from ticket26e_context), (select tenant_id from ticket26e_context), 'Vale lancado por engano'
  )$$,
  'estorna o vale (deve aparecer estornado no extrato, nao desaparecer)'
);

-- p_paid_at explicito e posterior: garante que a quitacao fica na frente na
-- ordenacao cronologica (mais recente primeiro), sem depender de now()
-- (congelado no inicio da transacao) para distinguir os tres lancamentos.
select lives_ok(
  $$select public.register_commission_payout(
    (select professional_id from ticket26e_context), 28, 'pix', 'Quitacao do extrato',
    now() + interval '2 minutes',
    (select tenant_id from ticket26e_context), null, 0, 8
  )$$,
  'quita a comissao (20) junto com a gorjeta (8) em um unico repasse'
);

update ticket26e_context set payout_id = (
  select id from public.commission_payouts where notes = 'Quitacao do extrato'
);

update ticket26e_context set statement_gerente = (
  select public.get_professional_account_statement(
    (select professional_id from ticket26e_context), (select tenant_id from ticket26e_context)
  )
);

select is(
  jsonb_array_length((select statement_gerente from ticket26e_context)->'entries'),
  3,
  'o extrato do gestor mostra os tres lancamentos: vale, gorjeta e quitacao'
);
select is(
  (select statement_gerente from ticket26e_context)->'entries'->0->>'kind',
  'quitacao',
  'a quitacao (mais recente) aparece primeiro na ordenacao cronologica'
);
select is(
  (
    select entry->>'status'
    from jsonb_array_elements((select statement_gerente from ticket26e_context)->'entries') entry
    where entry->>'kind' = 'vale'
  ),
  'reversed',
  'o vale estornado aparece como estornado, nao e removido do extrato'
);
select is(
  (
    select entry->>'reversal_reason'
    from jsonb_array_elements((select statement_gerente from ticket26e_context)->'entries') entry
    where entry->>'kind' = 'vale'
  ),
  'Vale lancado por engano',
  'o extrato preserva a razao do estorno'
);
select ok(
  (
    select (entry->>'reversed_by') is not null
    from jsonb_array_elements((select statement_gerente from ticket26e_context)->'entries') entry
    where entry->>'kind' = 'vale'
  ),
  'o extrato preserva o autor do estorno'
);
select is(
  (
    select entry->>'status'
    from jsonb_array_elements((select statement_gerente from ticket26e_context)->'entries') entry
    where entry->>'kind' = 'gorjeta'
  ),
  'settled',
  'a gorjeta liquidada pela quitacao aparece como liquidada'
);
select is(
  (
    (select entry from jsonb_array_elements((select statement_gerente from ticket26e_context)->'entries') entry
     where entry->>'kind' = 'quitacao')->>'credit_amount'
  )::numeric,
  8::numeric,
  'a linha de quitacao registra o credito de gorjeta pago'
);
select is(
  ((select statement_gerente from ticket26e_context)->'current_balance'->>'advances_open_amount')::numeric,
  0::numeric,
  'saldo corrente do extrato reflete o vale estornado (aberto zero)'
);
select is(
  ((select statement_gerente from ticket26e_context)->'current_balance'->>'credits_open_amount')::numeric,
  0::numeric,
  'saldo corrente do extrato reflete a gorjeta ja liquidada (aberto zero)'
);

-- O dono da conta le o proprio extrato com o mesmo conteudo do gestor.
reset role;
select set_config('request.jwt.claim.sub', (select professional_user_id::text from ticket26e_context), true);
set local role authenticated;

update ticket26e_context set statement_dono = (
  select public.get_professional_account_statement(
    (select professional_id from ticket26e_context), (select tenant_id from ticket26e_context)
  )
);

select is(
  jsonb_array_length((select statement_dono from ticket26e_context)->'entries'),
  3,
  'o profissional dono da conta ve o proprio extrato completo'
);

-- O colega nao pode ler a conta do outro profissional.
reset role;
select set_config('request.jwt.claim.sub', (select outro_professional_user_id::text from ticket26e_context), true);
set local role authenticated;

select throws_ok(
  $$select public.get_professional_account_statement(
    (select professional_id from ticket26e_context), (select tenant_id from ticket26e_context)
  )$$,
  '42501',
  'Acesso negado para este extrato.',
  'o colega nao consegue ler o extrato de outro profissional'
);

reset role;
select * from finish(true);
rollback;
