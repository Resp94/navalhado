begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select has_function(
  'private',
  'cleanup_orphan_provisional_customers',
  array[]::text[],
  'private cleanup routine exists'
);
select ok(
  not has_function_privilege('anon', 'private.cleanup_orphan_provisional_customers()', 'EXECUTE'),
  'anonymous clients cannot execute cleanup routine'
);
select ok(
  not has_function_privilege('authenticated', 'private.cleanup_orphan_provisional_customers()', 'EXECUTE'),
  'authenticated clients cannot execute cleanup routine'
);
select ok(
  has_function_privilege('service_role', 'private.cleanup_orphan_provisional_customers()', 'EXECUTE'),
  'service role can execute cleanup routine'
);
select ok(
  (select p.prosecdef from pg_proc p where p.oid='private.cleanup_orphan_provisional_customers()'::regprocedure),
  'cleanup routine uses a security definer boundary'
);
select is(
  (select p.proconfig from pg_proc p where p.oid='private.cleanup_orphan_provisional_customers()'::regprocedure),
  array['search_path=""'],
  'cleanup routine pins an empty search path'
);

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes)
values ('69000000-0000-0000-0000-000000000001','Cleanup Test','cleanup-test@test.local','92999990101','cleanup-test','{}'::jsonb,'America/Manaus',30,0);

insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values ('69000000-0000-0000-0000-000000000011','69000000-0000-0000-0000-000000000001','Serviço de limpeza',40,60,'Teste',true,1);

insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values ('69000000-0000-0000-0000-000000000021','69000000-0000-0000-0000-000000000001','Profissional de limpeza','92999990102',0,true,'{}'::jsonb);

insert into public.customers(id,tenant_id,name,phone,cadastro_completo)
values
  ('69000000-0000-0000-0000-000000000101','69000000-0000-0000-0000-000000000001','Provisório órfão',null,false),
  ('69000000-0000-0000-0000-000000000102','69000000-0000-0000-0000-000000000001','Provisório com agendamento',null,false),
  ('69000000-0000-0000-0000-000000000103','69000000-0000-0000-0000-000000000001','Provisório com comanda',null,false),
  ('69000000-0000-0000-0000-000000000104','69000000-0000-0000-0000-000000000001','Provisório na espera',null,false),
  ('69000000-0000-0000-0000-000000000105','69000000-0000-0000-0000-000000000001','Provisório auditado',null,false),
  ('69000000-0000-0000-0000-000000000106','69000000-0000-0000-0000-000000000001','Cliente completo','92999990106',true);

insert into public.appointments(
  id,tenant_id,customer_id,professional_id,service_id,start_time,end_time,status,payment_status
)
values (
  '69000000-0000-0000-0000-000000000201',
  '69000000-0000-0000-0000-000000000001',
  '69000000-0000-0000-0000-000000000102',
  '69000000-0000-0000-0000-000000000021',
  '69000000-0000-0000-0000-000000000011',
  '2040-01-02 09:00:00-04',
  '2040-01-02 10:00:00-04',
  'confirmed',
  'pending'
);

insert into public.comandas(id,tenant_id,customer_id)
values ('69000000-0000-0000-0000-000000000301','69000000-0000-0000-0000-000000000001','69000000-0000-0000-0000-000000000103');

insert into public.waiting_list(id,tenant_id,customer_id,name,phone)
values ('69000000-0000-0000-0000-000000000401','69000000-0000-0000-0000-000000000001','69000000-0000-0000-0000-000000000104','Provisório na espera','92999990104');

insert into public.audit_logs(id,tenant_id,action,resource,details)
values (
  '69000000-0000-0000-0000-000000000501',
  '69000000-0000-0000-0000-000000000001',
  'customer_reviewed',
  'customer',
  jsonb_build_object('customer_id','69000000-0000-0000-0000-000000000105')
);

select is(private.cleanup_orphan_provisional_customers(),1,'only the unreferenced provisional customer is removed');
select ok(not exists(select 1 from public.customers where id='69000000-0000-0000-0000-000000000101'),'orphan provisional customer is deleted');
select ok(exists(select 1 from public.customers where id='69000000-0000-0000-0000-000000000102'),'appointment customer is preserved');
select ok(exists(select 1 from public.customers where id='69000000-0000-0000-0000-000000000103'),'comanda customer is preserved');
select ok(exists(select 1 from public.customers where id='69000000-0000-0000-0000-000000000104'),'waiting-list customer is preserved');
select ok(exists(select 1 from public.customers where id='69000000-0000-0000-0000-000000000105'),'audited customer is preserved');
select ok(exists(select 1 from public.customers where id='69000000-0000-0000-0000-000000000106'),'complete customer is preserved');
select is((select count(*)::integer from public.appointments where customer_id='69000000-0000-0000-0000-000000000102'),1,'appointment reference remains intact');
select is((select count(*)::integer from public.comandas where customer_id='69000000-0000-0000-0000-000000000103'),1,'comanda reference remains intact');
select is((select count(*)::integer from public.waiting_list where customer_id='69000000-0000-0000-0000-000000000104'),1,'waiting-list reference remains intact');
select is((select count(*)::integer from public.audit_logs where id='69000000-0000-0000-0000-000000000501'),1,'audit record remains intact');

select * from finish();
rollback;
