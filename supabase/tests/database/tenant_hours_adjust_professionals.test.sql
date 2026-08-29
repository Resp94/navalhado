begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '08100000-0000-0000-0000-000000000001',
  'Tenant ajuste de escala',
  'tenant-hours-adjust@test.local',
  '92999990801',
  'tenant-hours-adjust',
  '{"segunda":{"active":true,"open":"08:00","close":"20:00"}}'::jsonb,
  'America/Manaus',
  30,
  0,
  true
);

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values(
  '08100000-0000-0000-0000-000000000011',
  '08100000-0000-0000-0000-000000000001',
  'Serviço de ajuste',
  40,
  30,
  'Cabelo',
  true,
  1
);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values(
  '08100000-0000-0000-0000-000000000021',
  '08100000-0000-0000-0000-000000000001',
  'Profissional ajustável',
  '92999990802',
  0,
  true,
  '{"monday":{"active":true,"start":"08:00","end":"20:00","break_start":"12:00","break_end":"13:00"}}'
);

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled)
values(
  '08100000-0000-0000-0000-000000000001',
  '08100000-0000-0000-0000-000000000021',
  '08100000-0000-0000-0000-000000000011',
  true
);

select lives_ok($sql$
  update public.tenants
  set business_hours = jsonb_build_object(
    'segunda', jsonb_build_object('active', true, 'open', '10:00', 'close', '17:00')
  )
  where id = '08100000-0000-0000-0000-000000000001';
$sql$, 'tenant hours update adjusts a professional schedule');

select is(
  (select weekly_schedule -> 'monday' ->> 'start' from public.professionals where id = '08100000-0000-0000-0000-000000000021'),
  '10:00',
  'professional start is adjusted to tenant opening'
);

select is(
  (select weekly_schedule -> 'monday' ->> 'end' from public.professionals where id = '08100000-0000-0000-0000-000000000021'),
  '17:00',
  'professional end is adjusted to tenant closing'
);

select is(
  (select weekly_schedule -> 'monday' ->> 'break_start' from public.professionals where id = '08100000-0000-0000-0000-000000000021'),
  '12:00',
  'break inside the new schedule is preserved'
);

select ok(exists(
  select 1 from public.get_available_slots(
    '08100000-0000-0000-0000-000000000001',
    '08100000-0000-0000-0000-000000000021',
    '08100000-0000-0000-0000-000000000011',
    '2040-01-02'
  ) where slot_time = '10:00'
), 'slots start at the adjusted tenant opening');

select ok(not exists(
  select 1 from public.get_available_slots(
    '08100000-0000-0000-0000-000000000001',
    '08100000-0000-0000-0000-000000000021',
    '08100000-0000-0000-0000-000000000011',
    '2040-01-02'
  ) where slot_time < '10:00' or slot_time >= '17:00'
), 'slots stay inside the adjusted tenant boundaries');

select throws_ok($sql$
  update public.professionals
  set weekly_schedule = '{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb
  where id = '08100000-0000-0000-0000-000000000021';
$sql$, '22023', NULL, 'manual professional schedules outside tenant hours remain rejected');

select * from finish();
rollback;
