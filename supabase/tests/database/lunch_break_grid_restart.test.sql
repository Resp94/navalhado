begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.tenants(
  id, name, email, phone, slug, business_hours, timezone,
  slot_interval_minutes, min_booking_lead_time_minutes, onboarding_completed
)
values(
  '70600000-0000-0000-0000-000000000001',
  'Lunch Break Grid Restart',
  'lunch-break-grid@test.local',
  '92999990501',
  'lunch-break-grid-test',
  '{"monday":{"active":true,"start":"08:00","end":"20:00"},"segunda":{"active":true,"open":"08:00","close":"18:00"}}'::jsonb,
  'America/Manaus',
  40,
  0,
  true
);

insert into public.services(id, tenant_id, name, price, duration_minutes, category, is_active, display_order)
values('70600000-0000-0000-0000-000000000011','70600000-0000-0000-0000-000000000001','Serviço com intervalo',40,30,'Cabelo',true,1);

insert into public.professionals(id, tenant_id, name, phone, commission_percentage, is_active, weekly_schedule)
values('70600000-0000-0000-0000-000000000021','70600000-0000-0000-0000-000000000001','Profissional com intervalo','92999990502',0,true,'{"monday":{"active":true,"start":"08:00","end":"18:00","break_start":"13:00","break_end":"15:00"}}');

insert into public.professional_services(tenant_id, professional_id, service_id, is_enabled)
values('70600000-0000-0000-0000-000000000001','70600000-0000-0000-0000-000000000021','70600000-0000-0000-0000-000000000011',true);

select ok(exists(
  select 1 from public.get_available_slots('70600000-0000-0000-0000-000000000001','70600000-0000-0000-0000-000000000021','70600000-0000-0000-0000-000000000011','2040-01-02')
  where slot_time = '15:00'
), 'available slots restart at the end of the lunch break');
select ok(not exists(
  select 1 from public.get_available_slots('70600000-0000-0000-0000-000000000001','70600000-0000-0000-0000-000000000021','70600000-0000-0000-0000-000000000011','2040-01-02')
  where slot_time = '15:20'
), 'available slots do not resume on a broken cadence after lunch');
select ok(exists(
  select 1 from public.get_public_schedule_by_slug('lunch-break-grid-test','2040-01-02','70600000-0000-0000-0000-000000000011','70600000-0000-0000-0000-000000000021')
  where slot_time = '15:00'
), 'public schedule exposes the exact lunch return slot');
select ok(not exists(
  select 1 from public.get_public_schedule_by_slug('lunch-break-grid-test','2040-01-02','70600000-0000-0000-0000-000000000011','70600000-0000-0000-0000-000000000021')
  where slot_time = '15:20'
), 'public schedule does not expose a broken-cadence slot after lunch');

update public.tenants
set business_hours = jsonb_build_object(
      case extract(dow from current_date)
        when 0 then 'domingo' when 1 then 'segunda' when 2 then 'terca'
        when 3 then 'quarta' when 4 then 'quinta' when 5 then 'sexta'
        when 6 then 'sabado'
      end,
      jsonb_build_object('active', true, 'open', '08:00', 'close', '18:00')
    ),
    min_booking_lead_time_minutes = 10080
where id = '70600000-0000-0000-0000-000000000001';

update public.professionals
set weekly_schedule = jsonb_build_object(
      case extract(dow from current_date)
        when 0 then 'sunday' when 1 then 'monday' when 2 then 'tuesday'
        when 3 then 'wednesday' when 4 then 'thursday' when 5 then 'friday'
        when 6 then 'saturday'
      end,
      jsonb_build_object(
        'active', true,
        'start', '08:00',
        'end', '18:00',
        'break_start', '13:00',
        'break_end', '15:00'
      )
    )
where id = '70600000-0000-0000-0000-000000000021';

select is(
  (select count(*)::integer from public.get_available_slots('70600000-0000-0000-0000-000000000001','70600000-0000-0000-0000-000000000021', '70600000-0000-0000-0000-000000000011', current_date)),
  0,
  'the configured minimum booking lead time still filters the restarted afternoon grid'
);

select * from finish();
rollback;
