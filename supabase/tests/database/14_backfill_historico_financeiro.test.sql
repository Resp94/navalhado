begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temporary table ticket14_context (user_id uuid, tenant_id uuid, service_id uuid, professional_id uuid, comanda_id uuid, item_id uuid) on commit drop;
insert into ticket14_context
select u.id, u.tenant_id, s.id, p.id, gen_random_uuid(), gen_random_uuid()
from public.users u
join public.services s on s.tenant_id=u.tenant_id and coalesce(s.is_active,true) and s.deleted_at is null
join public.professionals p on p.tenant_id=u.tenant_id and p.is_active and p.deleted_at is null
where u.is_active and u.role='gerente'
order by u.id,s.id,p.id limit 1;
grant select on ticket14_context to authenticated;

select ok((select count(*) from ticket14_context)=1, 'encontra tenant para backfill');
select has_function('public','backfill_financial_history',array['uuid','integer'],'procedimento de backfill existe');

reset role;
insert into public.comandas(id,tenant_id,status,total_amount,discount_amount,tip_amount,closed_at)
select comanda_id,tenant_id,'fechada',50,0,0,timezone('utc',now()) from ticket14_context;
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


