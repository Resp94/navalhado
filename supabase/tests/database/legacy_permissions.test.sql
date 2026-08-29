begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(not exists(
  select 1 from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.oid::regprocedure::text='confirm_public_booking(text,uuid,uuid,date,text,text,text)'
),'legacy seven-argument public confirmation is removed');
select ok(exists(
  select 1 from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.oid::regprocedure::text='confirm_public_booking(text,uuid,uuid,date,text,text,text,uuid)'
),'token-aware public confirmation remains');
select ok(not has_function_privilege('anon','public.get_available_slots(uuid,uuid,uuid,date,uuid)','EXECUTE'),'internal availability is not callable by anon');
select ok(has_function_privilege('authenticated','public.get_available_slots(uuid,uuid,uuid,date,uuid)','EXECUTE'),'authenticated staff retain internal availability');
select ok(not has_function_privilege('anon','public.create_appointment_by_token(uuid,uuid,uuid,date,text)','EXECUTE'),'internal appointment creation is not callable by anon');
select ok(has_function_privilege('authenticated','public.create_appointment_by_token(uuid,uuid,uuid,date,text)','EXECUTE'),'authenticated staff retain internal appointment creation');
select ok(not has_function_privilege('anon','public.get_or_create_provisional_customer_by_slug(text,uuid)','EXECUTE'),'provisional customer creation is not public');
select ok(not has_function_privilege('authenticated','public.get_or_create_provisional_customer_by_slug(text,uuid)','EXECUTE'),'provisional customer creation is not exposed to authenticated clients');
select ok(has_function_privilege('service_role','public.get_or_create_provisional_customer_by_slug(text,uuid)','EXECUTE'),'service role retains legacy cleanup compatibility');
select ok(has_function_privilege('anon','public.get_available_slots_by_token(uuid,uuid,uuid,date,uuid)','EXECUTE'),'tokenized client schedule remains available for legacy client management');

select * from finish();
rollback;
