begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '08600000-0000-0000-0000-000000000001',
  'Free Choice Professional Start Grid',
  'free-choice-professional-grid@test.local',
  '92999990801',
  'free-choice-professional-grid-test',
  '{"monday":{"active":true,"open":"09:00","close":"23:00"}}'::jsonb,
  'America/Manaus',
  40,
  0,
  true
);

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values(
  '08600000-0000-0000-0000-000000000011',
  '08600000-0000-0000-0000-000000000001',
  'Serviço com início profissional no modo livre',
  60,
  60,
  'Cabelo',
  true,
  1
);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values(
  '08600000-0000-0000-0000-000000000021',
  '08600000-0000-0000-0000-000000000001',
  'Profissional que inicia às dez',
  '92999990802',
  0,
  true,
  '{"monday":{"active":true,"start":"10:00","end":"19:00","break_start":"13:00","break_end":"15:00"}}'
);

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled)
values(
  '08600000-0000-0000-0000-000000000001',
  '08600000-0000-0000-0000-000000000021',
  '08600000-0000-0000-0000-000000000011',
  true
);

-- Agendamento criado na cadência antiga: ele bloqueia 10:00, mas não pode
-- deslocar a grade profissional para 10:20.
insert into public.appointments(
  tenant_id, professional_id, service_id, start_time, end_time,
  status, payment_status, is_fitting, origin
)
values(
  '08600000-0000-0000-0000-000000000001',
  '08600000-0000-0000-0000-000000000021',
  '08600000-0000-0000-0000-000000000011',
  '2040-01-02 10:00:00-04',
  '2040-01-02 10:30:00-04',
  'confirmed',
  'pending',
  false,
  'manual'
);

select ok(exists(
  select 1
  from public.get_available_slots(
    '08600000-0000-0000-0000-000000000001',
    null,
    '08600000-0000-0000-0000-000000000011',
    '2040-01-02'
  )
  where slot_time = '10:40'
), 'free-choice availability keeps the 40-minute cadence from the professional start');

select ok(not exists(
  select 1
  from public.get_available_slots(
    '08600000-0000-0000-0000-000000000001',
    null,
    '08600000-0000-0000-0000-000000000011',
    '2040-01-02'
  )
  where slot_time = '10:20'
), 'free-choice availability does not create a slot from the old tenant cadence');

select ok(exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )
  where slot_time = '10:00' and available is false
), 'the historical appointment blocks the professional start without moving the grid');

select ok(exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )
  where slot_time = '10:40' and available is true
), 'public free-choice schedule exposes the first available slot after the old appointment');

select ok(not exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )
  where slot_time = '10:20'
), 'public free-choice schedule does not expose the old tenant-cadence slot');

select ok(exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )
  where slot_time = '15:00' and available is true
), 'free-choice schedule resumes at the configured break return time');

select ok(exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )
  where slot_time = '15:40' and available is true
), 'free-choice schedule keeps the configured cadence after the break');

select ok(exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )
  where slot_time = '18:00' and available is true
), 'free-choice schedule keeps the last valid start whose service ends at professional closing');

select ok(not exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )
  where slot_time < '10:00' or slot_time > '18:20'
), 'free-choice schedule stays inside the professional effective window');

select is(
  (select min(slot_time) from public.get_public_schedule_by_slug(
    'free-choice-professional-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000011',
    null
  )),
  '10:00',
  'free-choice schedule begins at the professional effective start');

select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '08600000-0000-0000-0000-000000000101',
  'Free Choice Nine Oclock Grid',
  'free-choice-nine-grid@test.local',
  '92999990901',
  'free-choice-nine-grid-test',
  '{"monday":{"active":true,"open":"08:00","close":"18:00"}}'::jsonb,
  'America/Manaus',
  40,
  0,
  true
);

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values(
  '08600000-0000-0000-0000-000000000111',
  '08600000-0000-0000-0000-000000000101',
  'Serviço com início às nove',
  40,
  30,
  'Cabelo',
  true,
  1
);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values(
  '08600000-0000-0000-0000-000000000121',
  '08600000-0000-0000-0000-000000000101',
  'Profissional que inicia às nove',
  '92999990902',
  0,
  true,
  '{"monday":{"active":true,"start":"09:00","end":"17:00"}}'
);

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled)
values(
  '08600000-0000-0000-0000-000000000101',
  '08600000-0000-0000-0000-000000000121',
  '08600000-0000-0000-0000-000000000111',
  true
);

select ok(exists(
  select 1
  from public.get_available_slots(
    '08600000-0000-0000-0000-000000000101',
    null,
    '08600000-0000-0000-0000-000000000111',
    '2040-01-02'
  )
  where slot_time = '09:00'
), 'free-choice availability starts at 09:00 when the professional starts at 09:00');

select ok(not exists(
  select 1
  from public.get_available_slots(
    '08600000-0000-0000-0000-000000000101',
    null,
    '08600000-0000-0000-0000-000000000111',
    '2040-01-02'
  )
  where slot_time = '09:20'
), 'a professional starting at 09:00 does not create a 09:20 slot from an 08:00 tenant opening');

select ok(exists(
  select 1
  from public.get_public_schedule_by_slug(
    'free-choice-nine-grid-test',
    '2040-01-02',
    '08600000-0000-0000-0000-000000000111',
    null
  )
  where slot_time = '09:00' and available is true
), 'public free-choice schedule reflects the professional 09:00 start');

select * from finish();
rollback;
