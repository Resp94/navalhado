begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select has_function('public','confirm_public_booking',array['text','uuid','uuid','date','text','text','text'],'public booking confirmation exists');
select ok(has_function_privilege('anon','public.confirm_public_booking(text,uuid,uuid,date,text,text,text)','EXECUTE'),'anonymous visitors can confirm a booking');
select ok((select p.prosecdef from pg_proc p where p.oid='public.confirm_public_booking(text,uuid,uuid,date,text,text,text)'::regprocedure),'booking confirmation uses a security definer boundary');
select ok((select exists(
  select 1 from pg_proc p
  where p.oid='public.confirm_public_booking(text,uuid,uuid,date,text,text,text)'::regprocedure
    and array_to_string(p.proconfig, ',') like '%search_path=%'
)),'booking confirmation pins its search path');

select * from finish();
rollback;
