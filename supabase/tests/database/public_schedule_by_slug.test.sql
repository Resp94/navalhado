begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function('public','get_public_schedule_by_slug',array['text','date','uuid','uuid'],'public schedule function exists');
select ok(has_function_privilege('anon','public.get_public_schedule_by_slug(text,date,uuid,uuid)','EXECUTE'),'anonymous visitors can query the public schedule');
select ok((select p.prosecdef from pg_proc p where p.oid='public.get_public_schedule_by_slug(text,date,uuid,uuid)'::regprocedure),'public schedule uses a security definer boundary');

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes)
values(
  '59000000-0000-0000-0000-000000000001',
  'Schedule Test',
  'schedule-test@test.local',
  '92999990004',
  'schedule-test',
  '{"monday":{"active":true,"start":"09:00","end":"12:00"}}'::jsonb,
  'America/Manaus',
  30,
  0
);

insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values('59000000-0000-0000-0000-000000000011','59000000-0000-0000-0000-000000000001','Serviço de 60',40,60,'Cabelo',true,1);

insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values('59000000-0000-0000-0000-000000000021','59000000-0000-0000-0000-000000000001','Profissional Schedule','92999990005',0,true,'{}');

insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled)
values('59000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000021','59000000-0000-0000-0000-000000000011',true);

select is((select count(*)::integer from public.get_public_schedule_by_slug('schedule-test','2040-01-02','59000000-0000-0000-0000-000000000011',null)),5,'grade uses tenant interval and service duration');
select is((select count(*)::integer from public.get_public_schedule_by_slug('schedule-test','2040-01-02','59000000-0000-0000-0000-000000000011',null) where available),5,'qualified professional makes base slots available');

insert into public.blocked_slots(tenant_id,professional_id,start_time,end_time,reason)
values('59000000-0000-0000-0000-000000000001','59000000-0000-0000-0000-000000000021','2040-01-02 10:00:00-04','2040-01-02 11:00:00-04','Teste');

select is((select count(*)::integer from public.get_public_schedule_by_slug('schedule-test','2040-01-02','59000000-0000-0000-0000-000000000011',null) where available),3,'blocked interval changes availability without removing grid slots');
select ok(not (select available from public.get_public_schedule_by_slug('schedule-test','2040-01-02','59000000-0000-0000-0000-000000000011',null) where slot_time='10:00'),'blocked slot remains visible as unavailable');

select * from finish();
rollback;
