begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

create temporary table ticket10_context (
  user_id uuid not null,
  tenant_id uuid not null,
  cash_session_id uuid not null,
  product_id uuid not null,
  comanda_id uuid not null,
  service_id uuid not null,
  professional_id uuid not null
) on commit drop;

insert into ticket10_context (
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
grant select on ticket10_context to authenticated;

select ok((select count(*) from ticket10_context) = 1, 'encontra contexto isolado para obrigacoes');
select has_table('public', 'commission_obligations', 'tabela de obrigacoes existe');
select has_function(
  'public',
  'create_commission_obligations_from_closed_comanda',
  array[]::text[],
  'funcao do trigger de obrigacoes existe'
);
select has_trigger(
  'public',
  'comandas',
  'trg_create_commission_obligations',
  'trigger de obrigacoes existe'
);

reset role;
delete from public.professional_services
where tenant_id = (select tenant_id from ticket10_context)
  and service_id = (select service_id from ticket10_context)
  and professional_id = (select professional_id from ticket10_context);
update public.services
set commission_percentage = 20
where id = (select service_id from ticket10_context);
update public.professionals
set commission_percentage = 30
where id = (select professional_id from ticket10_context);
insert into public.products (
  id, tenant_id, name, price, cost_price, stock_quantity, commission_percentage, product_type
)
select product_id, tenant_id, 'Ticket 10 Produto', 30, 4, 5, 10, 'retail'
from ticket10_context;
insert into public.comandas (
  id, tenant_id, status, total_amount, discount_amount, tip_amount
)
select comanda_id, tenant_id, 'aberta', 0, 0, 0
from ticket10_context;

select set_config('request.jwt.claim.sub', (select user_id::text from ticket10_context), false);
set local role authenticated;

select lives_ok(
  $$select public.settle_comanda(
    (select comanda_id from ticket10_context),
    (select tenant_id from ticket10_context),
    null,
    null,
    0,
    0,
    (select cash_session_id from ticket10_context),
    jsonb_build_array(
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket10_context),'professional_id',(select professional_id from ticket10_context),'quantity',1,'unit_price',50),
      jsonb_build_object('item_type','produto','product_id',(select product_id from ticket10_context),'professional_id',(select professional_id from ticket10_context),'quantity',2,'unit_price',30),
      jsonb_build_object('item_type','servico','service_id',(select service_id from ticket10_context),'quantity',1,'unit_price',10)
    ),
    '[{"payment_method":"pix","amount":120}]'::jsonb
  )$$,
  'finaliza a comanda e gera obrigacoes na mesma transacao'
);
select is(
  (select status from public.comandas where id = (select comanda_id from ticket10_context)),
  'fechada',
  'comanda fica fechada'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context)),
  2::bigint,
  'gera uma obrigacao por item com profissional e comissao'
);
select is(
  (select sum(amount) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context)),
  16::numeric,
  'registra os valores snapshotados de servico e produto'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context) and status = 'open' and settled_amount = 0),
  2::bigint,
  'novas obrigacoes iniciam abertas e sem quitacao'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context) and commission_rule = 'none'),
  0::bigint,
  'nao cria obrigacao para item sem profissional elegivel'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context) and professional_id = (select professional_id from ticket10_context) and amount = 10),
  1::bigint,
  'vincula a obrigacao de servico ao profissional correto'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context) and professional_id = (select professional_id from ticket10_context) and amount = 6),
  1::bigint,
  'vincula a obrigacao de produto ao profissional correto'
);
select ok(
  (select bool_and(comanda_item_id is not null) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context)),
  'mantem o vinculo auditavel com cada item'
);
select ok(
  (select bool_and(tenant_id = (select tenant_id from ticket10_context)) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context)),
  'mantem o isolamento por tenant'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context)),
  2::bigint,
  'nao duplica obrigacoes durante a finalizacao'
);

select lives_ok(
  $$update public.comandas set status = 'fechada' where id = (select comanda_id from ticket10_context)$$,
  'uma atualizacao idempotente nao recria obrigacoes'
);
select is(
  (select count(*) from public.commission_obligations where comanda_id = (select comanda_id from ticket10_context)),
  2::bigint,
  'repeticao nao duplica obrigacoes'
);

reset role;
select is(
  (select relrowsecurity from pg_class where oid = 'public.commission_obligations'::regclass),
  true,
  'RLS permanece habilitado'
);
select is(
  (select count(*) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'commission_obligations' and grantee = 'authenticated' and privilege_type = 'SELECT'),
  1::bigint,
  'authenticated possui apenas leitura direta'
);

select * from finish(true);
rollback;




