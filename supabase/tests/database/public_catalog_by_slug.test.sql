begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function('public','get_services_by_public_slug',array['text'],'public services function exists');
select has_function('public','get_professionals_by_public_slug',array['text','uuid'],'public professionals function exists');
select ok(has_function_privilege('anon','public.get_services_by_public_slug(text)','EXECUTE'),'anonymous visitors can list public services');
select ok(has_function_privilege('anon','public.get_professionals_by_public_slug(text,uuid)','EXECUTE'),'anonymous visitors can list public professionals');

insert into public.tenants(id,name,email,phone,slug)
values('58000000-0000-0000-0000-000000000001','Catalog Test','catalog-test@test.local','92999990002','catalog-test');

insert into public.services(id,tenant_id,name,description,price,duration_minutes,category,is_active,display_order)
values
  ('58000000-0000-0000-0000-000000000011','58000000-0000-0000-0000-000000000001','Corte Público',null,40,40,'Cabelo',true,1),
  ('58000000-0000-0000-0000-000000000012','58000000-0000-0000-0000-000000000001','Serviço Inativo',null,40,40,'Cabelo',false,2);

insert into public.professionals(id,tenant_id,name,phone,is_active,weekly_schedule)
values('58000000-0000-0000-0000-000000000021','58000000-0000-0000-0000-000000000001','Profissional Público','92999990003',true,'{}');

insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled)
values('58000000-0000-0000-0000-000000000001','58000000-0000-0000-0000-000000000021','58000000-0000-0000-0000-000000000011',true);

select is((select count(*)::integer from public.get_services_by_public_slug('CATALOG-TEST')),1,'only active services are public');
select is((select name from public.get_services_by_public_slug('catalog-test')),'Corte Público'::text,'public service is tenant scoped');
select is((select count(*)::integer from public.get_professionals_by_public_slug('catalog-test','58000000-0000-0000-0000-000000000011')),1,'professionals are filtered by service');
select is((select count(*)::integer from public.get_professionals_by_public_slug('catalog-test','58000000-0000-0000-0000-000000000012')),0,'professionals are not returned for another service');

select * from finish();
rollback;
