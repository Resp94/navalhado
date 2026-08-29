begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes,onboarding_completed)
values('69000000-0000-0000-0000-000000000001','Tenant nao publicado','unpublished@test.local','92999990201','unpublished-test','{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb,'America/Manaus',30,0,false);

insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values
  ('69000000-0000-0000-0000-000000000011','69000000-0000-0000-0000-000000000001','Servico nao publicado',40,30,'Cabelo',true,1),
  ('69000000-0000-0000-0000-000000000012','69000000-0000-0000-0000-000000000001','Servico inativo',40,30,'Cabelo',false,2);

insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values('69000000-0000-0000-0000-000000000021','69000000-0000-0000-0000-000000000001','Profissional nao publicado','92999990202',0,true,'{}'::jsonb);

insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled)
values
  ('69000000-0000-0000-0000-000000000001','69000000-0000-0000-0000-000000000021','69000000-0000-0000-0000-000000000011',true),
  ('69000000-0000-0000-0000-000000000001','69000000-0000-0000-0000-000000000021','69000000-0000-0000-0000-000000000012',true);

select is((select count(*)::integer from public.get_public_tenant_by_slug('unpublished-test')),0,'tenant nao publicado nao aparece no contexto');
select is((select count(*)::integer from public.get_services_by_public_slug('unpublished-test')),0,'tenant nao publicado nao aparece no catalogo');
select is((select count(*)::integer from public.get_professionals_by_public_slug('unpublished-test','69000000-0000-0000-0000-000000000012')),0,'servico inativo nao expõe profissional');
select is((select count(*)::integer from public.get_public_schedule_by_slug('unpublished-test','2040-01-02','69000000-0000-0000-0000-000000000011',null)),0,'tenant nao publicado nao expõe grade');

select * from finish();
rollback;
