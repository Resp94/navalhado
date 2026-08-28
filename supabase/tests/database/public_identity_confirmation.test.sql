begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_function('public','confirm_public_booking',array['text','uuid','uuid','date','text','text','text','uuid'],'public confirmation accepts an optional identity token');
select ok(has_function_privilege('anon','public.confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)','EXECUTE'),'anonymous visitors can confirm with an identity token');
select ok((select p.prosecdef from pg_proc p where p.oid='public.confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)'::regprocedure),'token confirmation uses a security definer boundary');
select ok((select exists(
  select 1 from pg_proc p
  where p.oid='public.confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)'::regprocedure
    and array_to_string(p.proconfig, ',') like '%search_path=%'
)),'token confirmation pins its search path');

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes)
values('67000000-0000-0000-0000-000000000001','Identity Test','identity-test@test.local','92999990022','identity-test','{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb,'America/Manaus',30,0);
insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values('67000000-0000-0000-0000-000000000011','67000000-0000-0000-0000-000000000001','Serviço',40,60,'Cabelo',true,1);
insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values('67000000-0000-0000-0000-000000000021','67000000-0000-0000-0000-000000000001','Profissional','92999990023',0,true,'{"monday":{"start":"09:00","end":"17:00"}}'::jsonb);
insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled,custom_duration_minutes)
values('67000000-0000-0000-0000-000000000001','67000000-0000-0000-0000-000000000021','67000000-0000-0000-0000-000000000011',true,60);
insert into public.customers(id,tenant_id,name,phone,cadastro_completo,registration_origin)
values('67000000-0000-0000-0000-000000000031','67000000-0000-0000-0000-000000000001','Cliente Original','92999990024',true,'online');

select is((select customer_name from public.confirm_public_booking(
  'identity-test','67000000-0000-0000-0000-000000000011','67000000-0000-0000-0000-000000000021','2040-01-02','09:00','Pessoa Nova','92999990025',
  (select token_acesso from public.customers where id='67000000-0000-0000-0000-000000000031'))),'Pessoa Nova'::text,'changed phone resolves a new customer identity');

select is((select count(*)::integer from public.customers where tenant_id='67000000-0000-0000-0000-000000000001'),2,'changed phone creates one complete customer without changing the original');
select is((select name from public.customers where id='67000000-0000-0000-0000-000000000031'),'Cliente Original'::text,'original customer name remains intact');
select is((select customer_name from public.confirm_public_booking(
  'identity-test','67000000-0000-0000-0000-000000000011','67000000-0000-0000-0000-000000000021','2040-01-02','11:00','Nome Alterado','92999990024',
  (select token_acesso from public.customers where id='67000000-0000-0000-0000-000000000031'))),'Cliente Original'::text,'same phone reuses the canonical name');

select throws_ok($$select * from public.confirm_public_booking('identity-test','67000000-0000-0000-0000-000000000011','67000000-0000-0000-0000-000000000021','2040-01-02','13:00','Pessoa Inválida','92999990026','00000000-0000-0000-0000-000000000099')$$,'P0002','Token inválido para este estabelecimento.','token from another tenant is rejected');

select * from finish();
rollback;
