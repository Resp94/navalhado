begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '70200000-0000-0000-0000-000000000001',
  'Business Hours Precedence',
  'business-hours-precedence@test.local',
  '92999990401',
  'business-hours-precedence-test',
  '{"friday":{"active":true,"start":"08:00","end":"20:00"},"sexta":{"active":true,"open":"09:00","close":"18:00"}}'::jsonb,
  'America/Manaus',
  30,
  0,
  true
);

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values('70200000-0000-0000-0000-000000000011','70200000-0000-0000-0000-000000000001','Serviço de sexta',40,60,'Cabelo',true,1);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values('70200000-0000-0000-0000-000000000021','70200000-0000-0000-0000-000000000001','Profissional de sexta','92999990402',0,true,'{"friday":{"active":true,"start":"09:00","end":"18:00"}}');

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled)
values('70200000-0000-0000-0000-000000000001','70200000-0000-0000-0000-000000000021','70200000-0000-0000-0000-000000000011',true);

insert into public.appointments(
  id, tenant_id, professional_id, service_id, start_time, end_time,
  status, payment_status, origin
)
values(
  '70200000-0000-0000-0000-000000000031',
  '70200000-0000-0000-0000-000000000001',
  '70200000-0000-0000-0000-000000000021',
  '70200000-0000-0000-0000-000000000011',
  '2040-01-06 13:00:00-04',
  '2040-01-06 14:00:00-04',
  'confirmed',
  'pending',
  'online'
);

select is(
  (select count(*)::integer from public.get_public_schedule_by_slug('business-hours-precedence-test','2040-01-06','70200000-0000-0000-0000-000000000011','70200000-0000-0000-0000-000000000021')),
  18,
  'public grid uses the portuguese business-hours window'
);
select is(
  (select min(slot_time) from public.get_public_schedule_by_slug('business-hours-precedence-test','2040-01-06','70200000-0000-0000-0000-000000000011','70200000-0000-0000-0000-000000000021')),
  '09:00',
  'public grid starts at the configured portuguese opening time'
);
select is(
  (select max(slot_time) from public.get_public_schedule_by_slug('business-hours-precedence-test','2040-01-06','70200000-0000-0000-0000-000000000011','70200000-0000-0000-0000-000000000021')),
  '17:30',
  'public grid ends at the last slot fitting the configured portuguese closing time'
);
select is(
  (select count(*)::integer from public.get_available_slots('70200000-0000-0000-0000-000000000001','70200000-0000-0000-0000-000000000021','70200000-0000-0000-0000-000000000011','2040-01-06')),
  15,
  'available slots keep the same canonical business-hours window after the existing appointment is excluded'
);
select ok(
  not exists(
    select 1 from public.get_available_slots('70200000-0000-0000-0000-000000000001','70200000-0000-0000-0000-000000000021','70200000-0000-0000-0000-000000000011','2040-01-06',null)
    where slot_time = '13:00'
  ),
  'an active appointment blocks its slot for a new booking'
);
select ok(
  exists(
    select 1 from public.get_available_slots('70200000-0000-0000-0000-000000000001','70200000-0000-0000-0000-000000000021','70200000-0000-0000-0000-000000000011','2040-01-06','70200000-0000-0000-0000-000000000031')
    where slot_time = '13:00'
  ),
  'the current appointment slot is available during rescheduling'
);

select * from finish();
rollback;
