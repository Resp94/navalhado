begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '07200000-0000-0000-0000-000000000001',
  'Professional Start Grid Restart',
  'professional-start-grid@test.local',
  '92999990601',
  'professional-start-grid-test',
  '{"quarta":{"active":true,"open":"08:00","close":"20:00"}}'::jsonb,
  'America/Manaus',
  40,
  0,
  true
);

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values(
  '07200000-0000-0000-0000-000000000011',
  '07200000-0000-0000-0000-000000000001',
  'Serviço com início profissional',
  40,
  30,
  'Cabelo',
  true,
  1
);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values(
  '07200000-0000-0000-0000-000000000021',
  '07200000-0000-0000-0000-000000000001',
  'Profissional com início às nove',
  '92999990602',
  0,
  true,
  '{"wednesday":{"active":true,"start":"09:00","end":"18:00","break_start":"12:00","break_end":"13:00"}}'
);

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled)
values(
  '07200000-0000-0000-0000-000000000001',
  '07200000-0000-0000-0000-000000000021',
  '07200000-0000-0000-0000-000000000011',
  true
);

select ok(exists(
  select 1
  from public.get_available_slots(
    '07200000-0000-0000-0000-000000000001',
    '07200000-0000-0000-0000-000000000021',
    '07200000-0000-0000-0000-000000000011',
    '2040-01-04'
  )
  where slot_time = '09:00'
), 'available slots restart at the professional start time on Wednesday');

select ok(not exists(
  select 1
  from public.get_available_slots(
    '07200000-0000-0000-0000-000000000001',
    '07200000-0000-0000-0000-000000000021',
    '07200000-0000-0000-0000-000000000011',
    '2040-01-04'
  )
  where slot_time = '09:20'
), 'available slots do not inherit a broken tenant cadence before the professional start');

select ok(exists(
  select 1
  from public.get_public_schedule_by_slug(
    'professional-start-grid-test',
    '2040-01-04',
    '07200000-0000-0000-0000-000000000011',
    '07200000-0000-0000-0000-000000000021'
  )
  where slot_time = '09:00' and available is true
), 'public schedule exposes the professional start time on Wednesday');

select ok(not exists(
  select 1
  from public.get_public_schedule_by_slug(
    'professional-start-grid-test',
    '2040-01-04',
    '07200000-0000-0000-0000-000000000011',
    '07200000-0000-0000-0000-000000000021'
  )
  where slot_time = '09:20' and available is true
), 'public schedule does not expose a broken tenant cadence before the professional start');

select is((
  select count(*)::integer
  from public.get_public_schedule_by_slug(
    'professional-start-grid-test',
    '2040-01-04',
    '07200000-0000-0000-0000-000000000011',
    '07200000-0000-0000-0000-000000000021'
  )
  where slot_time = '13:00'
), 1, 'public schedule returns the afternoon slot only once');

select is((
  select count(*)::integer
  from public.get_public_schedule_by_slug(
    'professional-start-grid-test',
    '2040-01-04',
    '07200000-0000-0000-0000-000000000011',
    '07200000-0000-0000-0000-000000000021'
  )
), 12, 'public schedule contains only the professional grid for Wednesday');

select * from finish();
rollback;
