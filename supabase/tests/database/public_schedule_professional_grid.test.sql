begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes,onboarding_completed)
values('59000000-0000-0000-0000-000000000101','Professional Grid Test','professional-grid@test.local','92999990101','professional-grid-test','{"monday":{"active":true,"start":"08:00","end":"18:00"}}'::jsonb,'America/Manaus',30,0,true);

insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values('59000000-0000-0000-0000-000000000111','59000000-0000-0000-0000-000000000101','Servico com grade profissional',40,60,'Cabelo',true,1);

insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values('59000000-0000-0000-0000-000000000121','59000000-0000-0000-0000-000000000101','Profissional com inicio deslocado','92999990102',0,true,'{"monday":{"active":true,"start":"09:10","end":"15:10"}}');

insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled)
values('59000000-0000-0000-0000-000000000101','59000000-0000-0000-0000-000000000121','59000000-0000-0000-0000-000000000111',true);

select is((select count(*)::integer from public.get_public_schedule_by_slug('professional-grid-test','2040-01-02','59000000-0000-0000-0000-000000000111',null)),20,'grade usa expediente e intervalo do tenant');
select is((select count(*)::integer from public.get_public_schedule_by_slug('professional-grid-test','2040-01-02','59000000-0000-0000-0000-000000000111',null) where available),12,'jornada profissional filtra a grade do tenant');
select ok((select available from public.get_public_schedule_by_slug('professional-grid-test','2040-01-02','59000000-0000-0000-0000-000000000111',null) where slot_time='09:30'),'grade usa somente horarios na cadencia do tenant');
select ok(not (select available from public.get_public_schedule_by_slug('professional-grid-test','2040-01-02','59000000-0000-0000-0000-000000000111',null) where slot_time='08:00'),'horario fora da jornada profissional aparece indisponivel');
select is((select count(*)::integer from public.get_public_schedule_by_slug('professional-grid-test','2040-01-02','59000000-0000-0000-0000-000000000111','59000000-0000-0000-0000-000000000121')),12,'profissional selecionado usa o proprio expediente');
select is((select count(*)::integer from public.get_public_schedule_by_slug('professional-grid-test','2040-01-02','59000000-0000-0000-0000-000000000111','59000000-0000-0000-0000-000000000121') where available),12,'grade explicita disponibiliza somente a jornada profissional');
select ok((select available from public.get_public_schedule_by_slug('professional-grid-test','2040-01-02','59000000-0000-0000-0000-000000000111','59000000-0000-0000-0000-000000000121') where slot_time='09:10'),'inicio do profissional reinicia a grade visual');

select * from finish();
rollback;
