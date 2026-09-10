begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

create temporary table ticket09_context (
  user_id uuid not null,
  tenant_id uuid not null,
  product_id uuid not null,
  comanda_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null
) on commit drop;

insert into ticket09_context (
  user_id, tenant_id, product_id, comanda_id, service_id, professional_id, start_at, end_at
)
select
  u.id,
  u.tenant_id,
  gen_random_uuid(),
  gen_random_uuid(),
  pair.service_id,
  pair.professional_id,
  timezone('utc'::text, now()) + interval '10 minutes',
  timezone('utc'::text, now()) + interval '20 minutes'
from public.users u
join public.cash_sessions cs
  on cs.tenant_id = u.tenant_id
 and cs.status = 'open'
cross join lateral (
  select s.id as service_id, p.id as professional_id
  from public.services s
  join public.professionals p
    on p.tenant_id = s.tenant_id
   and p.is_active = true
   and p.deleted_at is null
  where s.tenant_id = u.tenant_id
    and coalesce(s.is_active, true) = true
    and s.deleted_at is null
  order by s.id, p.id
  limit 1
) pair
where u.is_active
  and u.role = 'gerente'
order by u.id
limit 1;
grant select on ticket09_context to authenticated;

select ok((select count(*) from ticket09_context) = 1, 'encontra contexto isolado para a metrica historica');
select has_function(
  'public',
  'get_tenant_financial_metrics',
  array['timestamp with time zone', 'timestamp with time zone', 'uuid'],
  'RPC de metricas financeiras existe'
);

reset role;
delete from public.professional_services
where tenant_id = (select tenant_id from ticket09_context)
  and service_id = (select service_id from ticket09_context)
  and professional_id = (select professional_id from ticket09_context);
update public.services
set commission_percentage = 20, price = 50
where id = (select service_id from ticket09_context);
update public.professionals
set commission_percentage = 30
where id = (select professional_id from ticket09_context);
insert into public.products (
  id, tenant_id, name, price, cost_price, stock_quantity, commission_percentage, product_type
)
select product_id, tenant_id, 'Ticket 09 Produto', 30, 4, 5, 10, 'retail'
from ticket09_context;
insert into public.comandas (
  id, tenant_id, status, total_amount, discount_amount, tip_amount, closed_at
)
select
  comanda_id, tenant_id, 'fechada', 113, 12, 5, start_at + interval '5 minutes'
from ticket09_context;
insert into public.comanda_itens (
  comanda_id, tenant_id, item_type, service_id, product_id, professional_id,
  quantity, unit_price, total_price,
  snapshot_quantity, snapshot_unit_price, snapshot_gross_amount,
  snapshot_discount_amount, snapshot_net_amount, snapshot_unit_cost,
  snapshot_commission_percentage, snapshot_commission_amount,
  snapshot_commission_rule, snapshot_status
)
select comanda_id, tenant_id, 'servico', service_id, null, professional_id,
  1, 50, 50, 1, 50, 50, 5, 45, null, 20, 10, 'service', 'confirmed'
from ticket09_context
union all
select comanda_id, tenant_id, 'produto', null, product_id, professional_id,
  2, 30, 60, 2, 30, 60, 6, 54, 4, 10, 6, 'product', 'confirmed'
from ticket09_context
union all
select comanda_id, tenant_id, 'servico', service_id, null, null,
  1, 10, 10, 1, 10, 10, 1, 9, null, 0, 0, 'none', 'confirmed'
from ticket09_context;
insert into public.comanda_pagamentos (
  comanda_id, tenant_id, payment_method, amount, change_amount
)
select comanda_id, tenant_id, 'pix', 113, 0
from ticket09_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket09_context), false);
set local role authenticated;

select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'services_revenue')::numeric,
  54::numeric,
  'usa o liquido snapshotado na receita de servicos'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'products_revenue')::numeric,
  54::numeric,
  'usa o liquido snapshotado na receita de produtos'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'products_count')::integer,
  2,
  'usa a quantidade preservada no snapshot'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'products_cost')::numeric,
  8::numeric,
  'usa o CMV preservado no snapshot'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'total_commission')::numeric,
  16::numeric,
  'usa a comissao preservada no snapshot'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'net_revenue')::numeric,
  89::numeric,
  'reconcilia o resultado liquido com snapshot, comissao e CMV'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'discounts_total')::numeric,
  12::numeric,
  'retorna o desconto consolidado da comanda'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'tips_total')::numeric,
  5::numeric,
  'retorna a gorjeta separada'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'operational_revenue')::numeric,
  108::numeric,
  'retorna a receita operacional liquida dos itens'
);
select is(
  public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'historical_data_quality',
  'confirmed',
  'classifica o periodo como historico confirmado'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'snapshot_comandas_count')::integer,
  1,
  'contabiliza a comanda com snapshot completo'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'legacy_comandas_count')::integer,
  0,
  'nao classifica comanda snapshotada como legado'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->'revenue_by_method'->>'pix')::numeric,
  113::numeric,
  'preserva o recebimento por metodo'
);

reset role;
update public.products
set price = 999, cost_price = 99, commission_percentage = 99
where id = (select product_id from ticket09_context);
update public.services
set price = 999, commission_percentage = 99
where id = (select service_id from ticket09_context);
update public.professionals
set commission_percentage = 99
where id = (select professional_id from ticket09_context);
set local role authenticated;

select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'products_cost')::numeric,
  8::numeric,
  'alterar o custo cadastral nao muda o CMV historico'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'total_commission')::numeric,
  16::numeric,
  'alterar percentuais cadastrais nao muda a comissao historica'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'services_revenue')::numeric,
  54::numeric,
  'alterar o preco cadastral nao muda a receita historica'
);
select is(
  public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'historical_data_quality',
  'confirmed',
  'a qualidade historica permanece confirmada apos alteracoes cadastrais'
);
select is(
  (public.get_tenant_financial_metrics((select start_at from ticket09_context), (select end_at from ticket09_context), (select tenant_id from ticket09_context))->>'snapshot_comandas_count')::integer,
  1,
  'o periodo continua apontando a mesma comanda snapshotada'
);

reset role;
select * from finish(true);
rollback;


