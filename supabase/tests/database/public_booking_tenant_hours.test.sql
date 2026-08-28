begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes,onboarding_completed)
values('69100000-0000-0000-0000-000000000001','Tenant expediente','tenant-hours@test.local','92999990301','tenant-hours-test','{"monday":{"active":true,"start":"09:00","end":"17:00"},"sunday":{"active":false,"start":"09:00","end":"17:00"}}'::jsonb,'America/Manaus',30,0,true);

insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values('69100000-0000-0000-0000-000000000011','69100000-0000-0000-0000-000000000001','Servico expediente',40,60,'Cabelo',true,1);

insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values('69100000-0000-0000-0000-000000000021','69100000-0000-0000-0000-000000000001','Profissional domingo','92999990302',0,true,'{"sunday":{"active":true,"start":"09:00","end":"17:00"}}');

insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled)
values('69100000-0000-0000-0000-000000000001','69100000-0000-0000-0000-000000000021','69100000-0000-0000-0000-000000000011',true);

create temp table confirmation_result(passed boolean);
do $$
begin
  perform * from public.confirm_public_booking('tenant-hours-test','69100000-0000-0000-0000-000000000011','69100000-0000-0000-0000-000000000021','2040-01-08','10:00','Pessoa Expediente','92999990303',null);
  insert into confirmation_result values(false);
exception when sqlstate '23P01' then
  insert into confirmation_result values(true);
end $$;
select ok((select passed from confirmation_result),'confirmacao rejeita horario fora do expediente do tenant');

select * from finish();
rollback;
