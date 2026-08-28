begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select has_function('public','get_available_slots',array['uuid','uuid','uuid','date','uuid'],'canonical availability function exists');

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes)
values(
  '61000000-0000-0000-0000-000000000001',
  'Availability Test',
  'availability-test@test.local',
  '92999990006',
  'availability-test',
  '{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb,
  'America/Manaus',
  30,
  0
);

insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values('61000000-0000-0000-0000-000000000011','61000000-0000-0000-0000-000000000001','Serviço com restrições',40,60,'Cabelo',true,1);

insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values
  ('61000000-0000-0000-0000-000000000021','61000000-0000-0000-0000-000000000001','Profissional com agenda','92999990007',0,true,
    '{"monday":{"start":"09:00","end":"17:00","break_start":"12:00","break_end":"13:00"}}'::jsonb),
  ('61000000-0000-0000-0000-000000000022','61000000-0000-0000-0000-000000000001','Profissional sem agenda','92999990008',0,true,'{}'::jsonb);

insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled,custom_duration_minutes)
values
  ('61000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000021','61000000-0000-0000-0000-000000000011',true,60),
  ('61000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000022','61000000-0000-0000-0000-000000000011',true,60);

select is((select count(*)::integer from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000021',
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null)),12,'individual schedule and duration define the candidate slots');

select ok(not exists (select 1 from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000021',
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null) where slot_time in ('12:00','12:30')), 'break does not produce available slots');

select is((select count(*)::integer from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000022',
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null)),0,'professional without a day agenda is unavailable');

select is((select count(*)::integer from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  null,
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null)),12,'free choice only uses qualified professionals with an agenda');

insert into public.appointments(id,tenant_id,professional_id,service_id,start_time,end_time,status,payment_status,origin)
values('61000000-0000-0000-0000-000000000031','61000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000021','61000000-0000-0000-0000-000000000011','2040-01-02 10:00:00-04','2040-01-02 11:00:00-04','confirmed','pending','online');

select ok(not (select exists(select 1 from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000021',
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null) where slot_time='10:00')), 'active appointment blocks the overlapping slot');

insert into public.blocked_slots(id,tenant_id,professional_id,start_time,end_time,reason)
values('61000000-0000-0000-0000-000000000041','61000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000021','2040-01-02 14:00:00-04','2040-01-02 15:00:00-04','Teste');

select ok(not (select exists(select 1 from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000021',
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null) where slot_time='14:00')), 'professional block blocks the overlapping slot');

select ok((select exists(select 1 from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000021',
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null) where slot_time='09:00')), 'unaffected slots remain available');

update public.professional_services
set is_enabled = false
where professional_id = '61000000-0000-0000-0000-000000000021';

select is((select count(*)::integer from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  null,
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null)),0,'disabled service link is unavailable in free choice');

select ok(not (select exists(select 1 from public.get_available_slots(
  '61000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000021',
  '61000000-0000-0000-0000-000000000011',
  '2040-01-02', null) where slot_time='09:00')), 'disabled service link is unavailable for selected professional');

select * from finish();
rollback;
