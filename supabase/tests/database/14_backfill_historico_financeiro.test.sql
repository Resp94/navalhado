begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temporary table ticket14_context (user_id uuid, tenant_id uuid, service_id uuid, professional_id uuid, comanda_id uuid, item_id uuid) on commit drop;

-- Contexto sintetico: nao depende de linhas preexistentes do DEV.
with t as (
  insert into public.tenants (name, email, phone)
  values ('__ticket14_ctx__', '__ticket14_ctx__@teste.com', '11999999999')
  returning id
), au as (
  insert into auth.users (id, email)
  values (gen_random_uuid(), '__ticket14_ctx__auth@teste.com')
  returning id
), prof as (
  insert into public.professionals (tenant_id, name, phone, commission_percentage, is_active)
  select t.id, 'Profissional Ticket14', '11988880014', 20, true
  from t
  returning id, tenant_id
), svc as (
  insert into public.services (tenant_id, name, price, category, is_active)
  select t.id, 'Servico Ticket14', 50, 'corte', true
  from t
  returning id, tenant_id
)
insert into ticket14_context
select au.id, t.id, svc.id, prof.id, gen_random_uuid(), gen_random_uuid()
from t, au, prof, svc;

update public.users
set tenant_id = (select tenant_id from ticket14_context), role = 'gerente', is_active = true
where id = (select user_id from ticket14_context);

grant select on ticket14_context to authenticated;

select ok((select count(*) from ticket14_context)=1, 'encontra tenant para backfill');
select has_function('public','backfill_financial_history',array['uuid','integer'],'procedimento de backfill existe');

-- Total zero evita o gatilho de consistencia entre total e soma dos pagamentos:
-- o total da comanda nao e verificado por nenhuma asserção deste arquivo.
reset role;
insert into public.comandas(id,tenant_id,status,total_amount,discount_amount,tip_amount,closed_at)
select comanda_id,tenant_id,'fechada',0,0,0,timezone('utc',now()) from ticket14_context;
insert into public.comanda_itens(id,comanda_id,tenant_id,item_type,service_id,professional_id,quantity,unit_price,total_price)
select item_id,comanda_id,tenant_id,'servico',service_id,professional_id,1,50,50 from ticket14_context;
select set_config('request.jwt.claim.sub',(select user_id::text from ticket14_context),false);
set local role authenticated;

select is(
  public.backfill_financial_history((select tenant_id from ticket14_context),500)->>'estimated_updated',
  '1',
  'preenche somente o item historico recuperavel'
);
select is((select snapshot_status from public.comanda_itens where id=(select item_id from ticket14_context)),'estimated','marca o snapshot como estimativa');
select is((select snapshot_data_quality from public.comanda_itens where id=(select item_id from ticket14_context)),'estimated','classifica a qualidade do dado');
select is((select snapshot_gross_amount from public.comanda_itens where id=(select item_id from ticket14_context)),50::numeric,'deriva bruto de fonte historica identificavel');
select is((select snapshot_net_amount from public.comanda_itens where id=(select item_id from ticket14_context)),50::numeric,'deriva liquido sem desconto');
select is((select count(*) from public.commission_obligations where comanda_id=(select comanda_id from ticket14_context)),0::bigint,'nao cria obrigacao para estimativa');
select is(
  public.backfill_financial_history((select tenant_id from ticket14_context),500)->>'estimated_updated',
  '0',
  'repeticao do backfill e idempotente'
);
select is((select snapshot_status from public.comanda_itens where id=(select item_id from ticket14_context)),'estimated','repeticao preserva classificacao');
select is((select count(*) from public.comanda_itens where snapshot_status='confirmed' and id=(select item_id from ticket14_context)),0::bigint,'estimativa nunca vira confirmada');
select is((select count(*) from public.comanda_itens where id=(select item_id from ticket14_context) and snapshot_data_quality='estimated'),1::bigint,'mantem leitura explicita da estimativa');

select * from finish(true);
rollback;


