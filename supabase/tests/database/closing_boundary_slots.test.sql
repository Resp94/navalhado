begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '07500000-0000-0000-0000-000000000001',
  'Closing Boundary Slots',
  'closing-boundary@test.local',
  '92999990701',
  'closing-boundary-test',
  '{"quarta":{"active":true,"open":"09:00","close":"18:00"}}'::jsonb,
  'America/Manaus',
  40,
  0,
  true
);

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values(
  '07500000-0000-0000-0000-000000000011',
  '07500000-0000-0000-0000-000000000001',
  'Serviço que ultrapassa o fechamento',
  40,
  30,
  'Cabelo',
  true,
  1
);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values(
  '07500000-0000-0000-0000-000000000021',
  '07500000-0000-0000-0000-000000000001',
  'Profissional do fechamento',
  '92999990702',
  0,
  true,
  '{"wednesday":{"active":true,"start":"09:00","end":"18:00","break_start":null,"break_end":null}}'
);

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled)
values(
  '07500000-0000-0000-0000-000000000001',
  '07500000-0000-0000-0000-000000000021',
  '07500000-0000-0000-0000-000000000011',
  true
);

select ok(exists(
  select 1 from public.get_available_slots(
    '07500000-0000-0000-0000-000000000001',
    '07500000-0000-0000-0000-000000000021',
    '07500000-0000-0000-0000-000000000011',
    '2040-01-04'
  ) where slot_time = '17:00'
), 'available slots include the last grid start whose service ends at closing');

select ok(not exists(
  select 1 from public.get_available_slots(
    '07500000-0000-0000-0000-000000000001',
    '07500000-0000-0000-0000-000000000021',
    '07500000-0000-0000-0000-000000000011',
    '2040-01-04'
  ) where slot_time = '17:40'
), 'available slots reject a service that would cross the closing time');

select ok(not exists(
  select 1 from public.get_available_slots(
    '07500000-0000-0000-0000-000000000001',
    '07500000-0000-0000-0000-000000000021',
    '07500000-0000-0000-0000-000000000011',
    '2040-01-04'
  ) where slot_time > '18:00'
), 'available slots never start after the tenant closing time');

select ok(exists(
  select 1 from public.get_public_schedule_by_slug(
    'closing-boundary-test',
    '2040-01-04',
    '07500000-0000-0000-0000-000000000011',
    '07500000-0000-0000-0000-000000000021'
  ) where slot_time = '17:00' and available is true
), 'public schedule includes the last grid start whose service ends at closing');

select ok(not exists(
  select 1 from public.get_public_schedule_by_slug(
    'closing-boundary-test',
    '2040-01-04',
    '07500000-0000-0000-0000-000000000011',
    '07500000-0000-0000-0000-000000000021'
  ) where slot_time = '17:40' and available is true
), 'public schedule marks a crossing slot unavailable');

select ok(not exists(
  select 1 from public.get_public_schedule_by_slug(
    'closing-boundary-test',
    '2040-01-04',
    '07500000-0000-0000-0000-000000000011',
    '07500000-0000-0000-0000-000000000021'
  ) where slot_time > '18:00' and available is true
), 'public schedule never exposes a slot after closing');

select throws_ok($sql$
  insert into public.professionals(
    id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule
  ) values(
    '07500000-0000-0000-0000-000000000022',
    '07500000-0000-0000-0000-000000000001',
    'Profissional fora do expediente',
    '92999990703',
    0,
    true,
    '{"wednesday":{"active":true,"start":"08:00","end":"19:00"}}'
  );
$sql$, '22023', NULL, 'professional schedule outside tenant hours is rejected');

select lives_ok($sql$
  insert into public.professionals(
    id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule
  ) values(
    '07500000-0000-0000-0000-000000000023',
    '07500000-0000-0000-0000-000000000001',
    'Profissional dentro do expediente',
    '92999990704',
    0,
    true,
    '{"wednesday":{"active":true,"start":"09:00","end":"18:00"}}'
  );
$sql$, 'a professional schedule within tenant hours is accepted');

select throws_ok($sql$
  insert into public.appointments(
    tenant_id, professional_id, service_id, start_time, end_time,
    status, payment_status, is_fitting, origin
  ) values(
    '07500000-0000-0000-0000-000000000001',
    '07500000-0000-0000-0000-000000000021',
    '07500000-0000-0000-0000-000000000011',
    '2040-01-04 17:40:00-04',
    '2040-01-04 18:10:00-04',
    'confirmed', 'pending', false, 'manual'
  );
$sql$, '22023', NULL, 'appointments reject a normal service that ends after closing');

select throws_ok($sql$
  insert into public.appointments(
    tenant_id, professional_id, service_id, start_time, end_time,
    status, payment_status, is_fitting, origin
  ) values(
    '07500000-0000-0000-0000-000000000001',
    '07500000-0000-0000-0000-000000000021',
    '07500000-0000-0000-0000-000000000011',
    '2040-01-04 18:00:00-04',
    '2040-01-04 18:30:00-04',
    'confirmed', 'pending', false, 'manual'
  );
$sql$, '22023', NULL, 'appointments starting at closing are rejected');

select lives_ok($sql$
  update public.tenants
  set business_hours = jsonb_build_object(
    'quarta', jsonb_build_object('active', true, 'open', '09:00', 'close', '17:00')
  )
  where id = '07500000-0000-0000-0000-000000000001';
$sql$, 'tenant closing adjusts the existing professional schedule');

select is(
  (
    select weekly_schedule -> 'wednesday' ->> 'end'
    from public.professionals
    where id = '07500000-0000-0000-0000-000000000021'
  ),
  '17:00',
  'professional closing is adjusted to the new tenant closing'
);

select throws_ok($sql$
  insert into public.appointments(
    tenant_id, professional_id, service_id, start_time, end_time,
    status, payment_status, is_fitting, origin
  ) values(
    '07500000-0000-0000-0000-000000000001',
    '07500000-0000-0000-0000-000000000021',
    '07500000-0000-0000-0000-000000000011',
    '2040-01-04 18:00:00-04',
    '2040-01-04 18:30:00-04',
    'canceled', 'pending', false, 'manual'
  );
  update public.appointments
  set status = 'confirmed'
  where tenant_id = '07500000-0000-0000-0000-000000000001'
    and start_time = '2040-01-04 18:00:00-04';
$sql$, '22023', NULL, 'reactivating a canceled appointment revalidates the closing boundary');

select throws_ok($sql$
  update public.professionals
  set weekly_schedule = '{"wednesday":{"active":false,"start":"09:00","end":"18:00"}}'::jsonb
  where id = '07500000-0000-0000-0000-000000000021';
  insert into public.appointments(
    tenant_id, professional_id, service_id, start_time, end_time,
    status, payment_status, is_fitting, origin
  ) values(
    '07500000-0000-0000-0000-000000000001',
    '07500000-0000-0000-0000-000000000021',
    '07500000-0000-0000-0000-000000000011',
    '2040-01-04 17:40:00-04',
    '2040-01-04 18:10:00-04',
    'confirmed', 'pending', false, 'manual'
  );
$sql$, '22023', NULL, 'appointments reject an explicitly inactive professional day');

select * from finish();
rollback;
