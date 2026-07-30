begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into public.tenants(id, name, email, phone) values
  ('20000000-0000-0000-0000-000000000003', 'Tenant WhatsApp', 'whatsapp-lifecycle@test.local', '92999991003');

insert into public.evolution_api_instances(
  id,
  tenant_id,
  instance_name,
  api_key,
  status
) values (
  '30000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003',
  'nav_whatsapp_lifecycle_test',
  'test-instance-key',
  'disconnected'
);

create temp table http_queue_baseline on commit drop as
select count(*)::bigint as request_count
from net.http_request_queue;

update public.evolution_api_instances
set status = 'pairing'
where id = '30000000-0000-0000-0000-000000000003';

select is(
  (select count(*)::bigint from net.http_request_queue),
  (select request_count from http_queue_baseline),
  'pairing update does not enqueue a duplicate Edge Function invocation'
);

select * from finish();
rollback;
