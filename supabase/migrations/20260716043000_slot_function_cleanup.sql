revoke all on function public.get_available_slots(uuid, uuid, uuid, date, uuid)
  from public, anon, authenticated;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, uuid)
  to service_role;

drop function if exists public.get_available_slots(uuid, uuid, date);
