begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_function('public','confirm_public_booking',array['text','uuid','uuid','date','text','text','text','uuid'],'public booking confirmation exists');
select ok(has_function_privilege('anon','public.confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)','EXECUTE'),'anonymous visitors can confirm a booking');
select ok((select p.prosecdef from pg_proc p where p.oid='public.confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)'::regprocedure),'booking confirmation uses a security definer boundary');
select ok((select exists(
  select 1 from pg_proc p
  where p.oid='public.confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)'::regprocedure
    and array_to_string(p.proconfig, ',') like '%search_path=%'
)),'booking confirmation pins its search path');
select ok((select pg_get_functiondef('public.confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)'::regprocedure) like '%pg_advisory_xact_lock%'),'same tenant and phone are serialized');
select ok((select exists(
  select 1 from pg_indexes
  where schemaname='public'
    and tablename='customers'
    and indexdef like '%telefone_normalizado%'
    and indexdef like '%UNIQUE%'
)),'customer identity has a unique tenant phone constraint');

insert into public.tenants(id,name,email,phone,slug,business_hours,timezone,slot_interval_minutes,min_booking_lead_time_minutes)
values
  ('68000000-0000-0000-0000-000000000001','Confirmation Test','confirmation-test@test.local','92999990028','confirmation-test','{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb,'America/Manaus',30,0),
  ('68000000-0000-0000-0000-000000000002','Other Tenant','other-tenant@test.local','92999990029','other-tenant','{"monday":{"active":true,"start":"09:00","end":"17:00"}}'::jsonb,'America/Manaus',30,0);

insert into public.services(id,tenant_id,name,price,duration_minutes,category,is_active,display_order)
values
  ('68000000-0000-0000-0000-000000000011','68000000-0000-0000-0000-000000000001','Serviço de confirmação',40,60,'Cabelo',true,1),
  ('68000000-0000-0000-0000-000000000012','68000000-0000-0000-0000-000000000002','Serviço de confirmação',40,60,'Cabelo',true,1);

insert into public.professionals(id,tenant_id,name,phone,commission_percentage,is_active,weekly_schedule)
values
  ('68000000-0000-0000-0000-000000000021','68000000-0000-0000-0000-000000000001','Profissional 1','92999990030',0,true,'{"monday":{"start":"09:00","end":"17:00"}}'::jsonb),
  ('68000000-0000-0000-0000-000000000022','68000000-0000-0000-0000-000000000002','Profissional 2','92999990031',0,true,'{"monday":{"start":"09:00","end":"17:00"}}'::jsonb);

insert into public.professional_services(tenant_id,professional_id,service_id,is_enabled,custom_duration_minutes)
values
  ('68000000-0000-0000-0000-000000000001','68000000-0000-0000-0000-000000000021','68000000-0000-0000-0000-000000000011',true,60),
  ('68000000-0000-0000-0000-000000000002','68000000-0000-0000-0000-000000000022','68000000-0000-0000-0000-000000000012',true,60);

select is((select customer_name from public.confirm_public_booking(
  'confirmation-test','68000000-0000-0000-0000-000000000011','68000000-0000-0000-0000-000000000021','2040-01-02','09:00','Maria Silva','92999990027',null)),
  'Maria Silva'::text,'confirmation returns the submitted identity');
select is((select count(*)::integer from public.customers where tenant_id='68000000-0000-0000-0000-000000000001'),1,'a new phone creates one customer');
select is((select phone from public.customers where tenant_id='68000000-0000-0000-0000-000000000001'),private.normalize_br_phone('92999990027'),'phone is persisted in canonical format');

select is((select customer_name from public.confirm_public_booking(
  'confirmation-test','68000000-0000-0000-0000-000000000011','68000000-0000-0000-0000-000000000021','2040-01-02','11:00','Nome Alterado','92999990027',null)),
  'Maria Silva'::text,'same phone reuses the existing canonical customer');
select is((select count(*)::integer from public.customers where tenant_id='68000000-0000-0000-0000-000000000001'),1,'repeated phone does not duplicate the customer');
select is((select count(*)::integer from public.appointments where tenant_id='68000000-0000-0000-0000-000000000001'),2,'each successful confirmation creates its appointment');

select is((select customer_name from public.confirm_public_booking(
  'other-tenant','68000000-0000-0000-0000-000000000012','68000000-0000-0000-0000-000000000022','2040-01-02','09:00','Outra Pessoa','92999990027',null)),
  'Outra Pessoa'::text,'the same phone can identify a separate tenant customer');
select is((select count(*)::integer from public.customers where tenant_id='68000000-0000-0000-0000-000000000002'),1,'customer identity is isolated by tenant');

select throws_ok($$select * from public.confirm_public_booking('confirmation-test','68000000-0000-0000-0000-000000000011','68000000-0000-0000-0000-000000000021','2040-01-02','09:00','Pessoa Falha','92999990032',null)$$,
  '23P01','O horário selecionado acabou de ser reservado ou não está disponível.','availability failure aborts confirmation');
select is((select count(*)::integer from public.customers where tenant_id='68000000-0000-0000-0000-000000000001' and telefone_normalizado=private.normalize_br_phone('92999990032')),0,'failed confirmation does not leave a partial customer');

select * from finish();
rollback;
