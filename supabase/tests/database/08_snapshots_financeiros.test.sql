begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create temporary table ticket08_context (
  user_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  product_id uuid not null,
  comanda_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null
) on commit drop;

insert into ticket08_context (
  user_id, tenant_id, cash_session_id, product_id, comanda_id, service_id, professional_id
)
select
  u.id,
  u.tenant_id,
  cs.id,
  gen_random_uuid(),
  gen_random_uuid(),
  pair.service_id,
  pair.professional_id
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
grant select on ticket08_context to authenticated;

select ok((select count(*) from ticket08_context) = 1, 'encontra contexto com gerente, caixa, serviço e profissional elegíveis');
select has_function(
  'public',
  'settle_comanda',
  array['uuid', 'uuid', 'uuid', 'uuid', 'numeric', 'numeric', 'uuid', 'jsonb', 'jsonb'],
  'RPC de finalização continua disponível'
);
select has_function(
  'public',
  'reopen_comanda',
  array['uuid', 'uuid'],
  'RPC de reabertura continua disponível'
);

reset role;
delete from public.professional_services
where tenant_id = (select tenant_id from ticket08_context)
  and service_id = (select service_id from ticket08_context)
  and professional_id = (select professional_id from ticket08_context);
update public.services
set commission_percentage = 20
where id = (select service_id from ticket08_context);
update public.professionals
set commission_percentage = 30
where id = (select professional_id from ticket08_context);
insert into public.products (
  id, tenant_id, name, price, cost_price, stock_quantity, commission_percentage, product_type
)
select product_id, tenant_id, 'Ticket 08 Produto', 30, 4, 5, 10, 'retail'
from ticket08_context;
insert into public.comandas (
  id, tenant_id, status, total_amount, discount_amount, tip_amount
)
select comanda_id, tenant_id, 'aberta', 0, 0, 0
from ticket08_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket08_context), false);
set local role authenticated;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_id from ticket08_context),
    (select tenant_id from ticket08_context),
    null,
    null,
    12,
    5,
    (select cash_session_id from ticket08_context),
    jsonb_build_array(
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket08_context),'professional_id',(select professional_id from ticket08_context),'quantity',1,'unit_price',50),
      jsonb_build_object('item_type','produto','product_id',(select product_id from ticket08_context),'professional_id',(select professional_id from ticket08_context),'quantity',2,'unit_price',30),
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket08_context),'quantity',1,'unit_price',10)
    ),
    '[{"payment_method":"pix","amount":113}]'::jsonb
  )$$,
  'finaliza a comanda com snapshots financeiros'
);
select is(
  (select status from public.comandas where id = (select comanda_id from ticket08_context)),
  'fechada',
  'fecha a comanda'
);
select is(
  (select sum(snapshot_quantity) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context)),
  4::bigint,
  'preserva a quantidade de cada item'
);
select is(
  (select sum(snapshot_gross_amount) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context)),
  120::numeric,
  'preserva o bruto dos itens'
);
select is(
  (select sum(snapshot_discount_amount) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context)),
  12::numeric,
  'rateia todo o desconto entre os itens'
);
select is(
  (select sum(snapshot_net_amount) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context)),
  108::numeric,
  'preserva o líquido dos itens'
);
select is(
  (select total_amount from public.comandas where id = (select comanda_id from ticket08_context)),
  113::numeric,
  'mantém a gorjeta separada no total da comanda'
);
select is(
  (select tip_amount from public.comandas where id = (select comanda_id from ticket08_context)),
  5::numeric,
  'preserva a gorjeta fora do rateio de itens'
);
select is(
  (select snapshot_discount_amount from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_gross_amount = 50),
  5::numeric,
  'rateia o desconto proporcionalmente no primeiro item'
);
select is(
  (select snapshot_discount_amount from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_gross_amount = 60),
  6::numeric,
  'rateia o desconto proporcionalmente no segundo item'
);
select is(
  (select snapshot_discount_amount from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_gross_amount = 10),
  1::numeric,
  'entrega o residual de centavos de forma determinística'
);
select is(
  (select snapshot_unit_cost from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and item_type = 'produto'),
  4::numeric,
  'captura o custo unitário do produto'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and item_type = 'servico' and snapshot_unit_cost is null),
  2::bigint,
  'mantém custo nulo para serviços'
);
select is(
  (select sum(snapshot_commission_amount) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context)),
  16::numeric,
  'calcula comissão pelo bruto apenas para itens com profissional'
);
select is(
  (select snapshot_commission_percentage from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and item_type = 'produto'),
  10::numeric,
  'captura o percentual de comissão do produto'
);
select is(
  (select snapshot_commission_percentage from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and item_type = 'servico' and professional_id is not null),
  20::numeric,
  'preserva a precedência do percentual do serviço'
);
select is(
  (select snapshot_commission_amount from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and professional_id is null),
  0::numeric,
  'não inventa comissão sem profissional'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_commission_rule = 'service'),
  1::bigint,
  'registra a origem da regra de serviço'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_commission_rule = 'product'),
  1::bigint,
  'registra a origem da regra de produto'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_commission_rule = 'none'),
  1::bigint,
  'registra ausência de regra quando não há profissional'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_status = 'confirmed'),
  3::bigint,
  'marca todos os snapshots finalizados como confirmados'
);

reset role;
update public.products
set cost_price = 99, commission_percentage = 99
where id = (select product_id from ticket08_context);
update public.services
set commission_percentage = 99
where id = (select service_id from ticket08_context);
update public.professionals
set commission_percentage = 99
where id = (select professional_id from ticket08_context);
set local role authenticated;

select is(
  (select snapshot_unit_cost from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and item_type = 'produto'),
  4::numeric,
  'alterações cadastrais não mudam o custo capturado'
);
select is(
  (select snapshot_commission_percentage from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and item_type = 'servico' and professional_id is not null),
  20::numeric,
  'alterações cadastrais não mudam a comissão capturada'
);
select ok(
  (select count(*) from public.comanda_itens where snapshot_status is null) >= 1,
  'registros legados continuam legíveis com campos nulos'
);

select lives_ok(
  $$select public.reopen_comanda(
    (select comanda_id from ticket08_context),
    (select tenant_id from ticket08_context)
  )$$,
  'reabre a comanda e revoga os snapshots ativos'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_status = 'reverted'),
  3::bigint,
  'marca snapshots revertidos na reabertura'
);
select is(
  (select count(*) from public.comanda_itens where comanda_id = (select comanda_id from ticket08_context) and snapshot_status = 'confirmed'),
  0::bigint,
  'não deixa snapshot confirmado vinculado a venda reaberta'
);
select is(
  (select stock_quantity from public.products where id = (select product_id from ticket08_context)),
  5,
  'a reabertura continua restaurando o estoque'
);

reset role;
select * from finish(true);
rollback;
