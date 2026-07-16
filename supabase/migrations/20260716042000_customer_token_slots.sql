create or replace function public.get_available_slots_by_token(
  p_token uuid,
  p_professional_id uuid,
  p_service_id uuid,
  p_date date,
  p_exclude_appointment_id uuid default null
)
returns table(slot_time text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_tenant_id uuid;
begin
  select c.id, c.tenant_id
  into v_customer_id, v_tenant_id
  from public.customers c
  where c.token_acesso = p_token
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_customer_id is null then
    raise exception 'Invalid or expired customer token' using errcode = 'P0001';
  end if;

  if p_exclude_appointment_id is not null and not exists (
    select 1
    from public.appointments a
    where a.id = p_exclude_appointment_id
      and a.customer_id = v_customer_id
      and a.tenant_id = v_tenant_id
  ) then
    raise exception 'Appointment does not belong to customer token' using errcode = 'P0001';
  end if;

  return query
  select slots.slot_time
  from public.get_available_slots(
    v_tenant_id,
    p_professional_id,
    p_service_id,
    p_date,
    p_exclude_appointment_id
  ) as slots;
end;
$$;

revoke all on function public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid) from public;
grant execute on function public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid)
  to anon, authenticated, service_role;
