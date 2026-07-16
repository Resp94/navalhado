begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select has_function(
  'public',
  'get_available_slots_by_token',
  array['uuid', 'uuid', 'uuid', 'date', 'uuid'],
  'token-scoped slot function exists'
);

select ok(
  has_function_privilege('anon', 'public.get_available_slots_by_token(uuid,uuid,uuid,date,uuid)', 'EXECUTE'),
  'anonymous customer can request slots with a token'
);

select ok(
  has_function_privilege('authenticated', 'public.get_available_slots_by_token(uuid,uuid,uuid,date,uuid)', 'EXECUTE'),
  'signed-in browser sessions can use customer token links'
);

select ok(
  not has_function_privilege('anon', 'public.get_available_slots(uuid,uuid,uuid,date,uuid)', 'EXECUTE'),
  'anonymous customer cannot call tenant-id slot function'
);

select ok(
  to_regprocedure('public.get_available_slots(uuid,uuid,date)') is null,
  'legacy token slot function was removed'
);

select ok(
  (select p.prosecdef
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'get_available_slots_by_token'
     and pg_get_function_identity_arguments(p.oid) = 'p_token uuid, p_professional_id uuid, p_service_id uuid, p_date date, p_exclude_appointment_id uuid'),
  'token-scoped slot function is security definer'
);

select is(
  (select p.proconfig
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'get_available_slots_by_token'
     and pg_get_function_identity_arguments(p.oid) = 'p_token uuid, p_professional_id uuid, p_service_id uuid, p_date date, p_exclude_appointment_id uuid'),
  array['search_path=""'],
  'token-scoped slot function has an empty search path'
);

select * from finish();
rollback;
