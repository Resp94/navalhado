-- Remove a persistência legada do provedor anterior sem alterar os dados de domínio.
-- As migrações históricas permanecem intactas para reconstrução do ambiente.

create or replace view public.view_tenants_management as
select
  t.id as tenant_id,
  t.name as tenant_name,
  t.email as tenant_email,
  t.phone as tenant_phone,
  t.logo_url as tenant_logo_url,
  t.created_at as tenant_created_at,
  p.name as plan_name,
  p.price as plan_price,
  sub.status as subscription_status,
  sub.end_date as subscription_end_date,
  inst.status as whatsapp_status
from public.tenants t
left join public.tenant_subscriptions sub on sub.tenant_id = t.id and sub.status != 'canceled'
left join public.plans p on p.id = sub.plan_id
left join public.whatsapp_instances inst on inst.tenant_id = t.id;

do $$
begin
  if to_regclass('public.evolution_api_instances') is not null then
    execute 'drop trigger if exists trg_evolution_api_instance on public.evolution_api_instances';
  end if;
end
$$;
drop function if exists public.fn_evolution_api_instance_trigger();
drop table if exists public.evolution_api_instances;
