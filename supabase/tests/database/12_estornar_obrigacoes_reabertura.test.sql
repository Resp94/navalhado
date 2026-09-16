begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create temporary table ticket12_context (
  user_id uuid not null,
  tenant_id uuid not null,
  professional_id uuid not null,
  service_id uuid not null,
  open_comanda_id uuid not null,
  partial_comanda_id uuid not null,
  paid_comanda_id uuid not null,
  open_item_id uuid not null,
  partial_item_id uuid not null,
  paid_item_id uuid not null
) on commit drop;

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket12_ctx__', '__ticket12_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket12_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket12', '11988880012', 20, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Ticket12', 50, 'corte', true
  from t
  returning id, tenant_id
)
insert into ticket12_context
select au.id, t.id, prof.id, svc.id,
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
from t, au, prof, svc;

update public.users
set tenant_id = (select tenant_id from ticket12_context), role = 'gerente', is_active = true
where id = (select user_id from ticket12_context);

grant select on ticket12_context to authenticated;

select ok((select count(*) from ticket12_context) = 1, 'encontra contexto para estorno de obrigacoes');
select has_function('public', 'reopen_comanda', array['uuid', 'uuid'], 'RPC de reabertura preserva a assinatura');

-- Total zero evita o gatilho de consistencia entre total e soma dos pagamentos:
-- o total da comanda nao e verificado por nenhuma asserção deste arquivo.
reset role;
insert into public.comandas (id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at)
select open_comanda_id, tenant_id, 'fechada', 0, 0, 0, timezone('utc'::text, now()) from ticket12_context
union all
select partial_comanda_id, tenant_id, 'fechada', 0, 0, 0, timezone('utc'::text, now()) from ticket12_context
union all
select paid_comanda_id, tenant_id, 'fechada', 0, 0, 0, timezone('utc'::text, now()) from ticket12_context;
insert into public.comanda_itens (
  id, comanda_id, tenant_id, item_type, service_id, professional_id, quantity, unit_price, total_price,
  snapshot_quantity, snapshot_unit_price, snapshot_gross_amount, snapshot_discount_amount, snapshot_net_amount,
  snapshot_commission_percentage, snapshot_commission_amount, snapshot_commission_rule, snapshot_status
)
select open_item_id, open_comanda_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50, 1, 50, 50, 0, 50, 20, 10, 'service', 'confirmed' from ticket12_context
union all
select partial_item_id, partial_comanda_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50, 1, 50, 50, 0, 50, 20, 10, 'service', 'confirmed' from ticket12_context
union all
select paid_item_id, paid_comanda_id, tenant_id, 'servico', service_id, professional_id, 1, 50, 50, 1, 50, 50, 0, 50, 20, 10, 'service', 'confirmed' from ticket12_context;
insert into public.commission_obligations (tenant_id, professional_id, comanda_id, comanda_item_id, amount, settled_amount, status, commission_rule, created_by)
select tenant_id, professional_id, open_comanda_id, open_item_id, 10, 0, 'open', 'service', user_id from ticket12_context
union all
select tenant_id, professional_id, partial_comanda_id, partial_item_id, 10, 2, 'partially_paid', 'service', user_id from ticket12_context
union all
select tenant_id, professional_id, paid_comanda_id, paid_item_id, 10, 10, 'paid', 'service', user_id from ticket12_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket12_context), false);
set local role authenticated;

select lives_ok(
  $$select public.reopen_comanda((select open_comanda_id from ticket12_context), (select tenant_id from ticket12_context))$$,
  'reabre comanda com obrigacao ainda aberta'
);
select is((select status from public.comandas where id = (select open_comanda_id from ticket12_context)), 'aberta', 'reabre a comanda aberta');
select is((select status from public.commission_obligations where comanda_id = (select open_comanda_id from ticket12_context)), 'reversed', 'estorna a obrigacao aberta sem apaga-la');
select is((select settled_amount from public.commission_obligations where comanda_id = (select open_comanda_id from ticket12_context)), 0::numeric, 'preserva saldo zero no estorno');
select ok((select reversed_at is not null and reversed_by is not null from public.commission_obligations where comanda_id = (select open_comanda_id from ticket12_context)), 'registra autor e instante do estorno');
select is((select snapshot_status from public.comanda_itens where id = (select open_item_id from ticket12_context)), 'reverted', 'revoga o snapshot da comanda reaberta');

select throws_ok(
  $$select public.reopen_comanda((select partial_comanda_id from ticket12_context), (select tenant_id from ticket12_context))$$,
  'P0001',
  'A comanda possui comissao ja quitada; estorne a quitacao antes de reabrir.',
  'bloqueia reabertura com quitacao parcial'
);
select is((select status from public.comandas where id = (select partial_comanda_id from ticket12_context)), 'fechada', 'mantem fechada a comanda parcialmente quitada');
select is((select status from public.commission_obligations where comanda_id = (select partial_comanda_id from ticket12_context)), 'partially_paid', 'nao altera obrigacao parcialmente quitada');

select throws_ok(
  $$select public.reopen_comanda((select paid_comanda_id from ticket12_context), (select tenant_id from ticket12_context))$$,
  'P0001',
  'A comanda possui comissao ja quitada; estorne a quitacao antes de reabrir.',
  'bloqueia reabertura com quitacao total'
);
select is((select status from public.comandas where id = (select paid_comanda_id from ticket12_context)), 'fechada', 'mantem fechada a comanda totalmente quitada');
select is((select status from public.commission_obligations where comanda_id = (select paid_comanda_id from ticket12_context)), 'paid', 'nao altera obrigacao totalmente quitada');

select throws_ok(
  $$select public.reopen_comanda((select open_comanda_id from ticket12_context), (select tenant_id from ticket12_context))$$,
  'P0001',
  'A comanda não está fechada ou não existe.',
  'repeticao nao duplica o estorno'
);
select is((select count(*) from public.commission_obligations where comanda_id = (select open_comanda_id from ticket12_context) and status = 'reversed'), 1::bigint, 'mantem um unico estorno auditavel');

select * from finish(true);
rollback;

