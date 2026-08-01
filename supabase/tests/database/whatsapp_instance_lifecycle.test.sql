begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into public.tenants(id, name, email, phone) values
  ('20000000-0000-0000-0000-000000000003', 'Tenant WhatsApp', 'whatsapp-lifecycle@test.local', '92999991003');

insert into public.whatsapp_instances(
  id,
  tenant_id,
  instance_name,
  provider,
  instance_token,
  status
) values (
  '30000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003',
  'nav_whatsapp_lifecycle_test',
  'uazapi',
  'test-instance-token',
  'disconnected'
);

create temp table http_queue_baseline on commit drop as
select count(*)::bigint as request_count
from net.http_request_queue;

update public.whatsapp_instances
set status = 'connecting'
where id = '30000000-0000-0000-0000-000000000003';

select is(
  (select count(*)::bigint from net.http_request_queue),
  (select request_count from http_queue_baseline),
  'connecting update does not enqueue a duplicate Edge Function invocation'
);

select * from finish();
rollback;
