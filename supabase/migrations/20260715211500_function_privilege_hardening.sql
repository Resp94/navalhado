alter function public.cancel_appointment_by_token(uuid, uuid, text) set search_path = '';
alter function public.create_appointment_by_token(uuid, uuid, uuid, date, text) set search_path = '';
alter function public.get_available_slots(uuid, uuid, uuid, date, uuid) set search_path = '';
alter function public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text) set search_path = '';

revoke all on function public.fn_appointment_whatsapp_trigger() from public, anon, authenticated;
revoke all on function public.fn_evolution_api_instance_trigger() from public, anon, authenticated;
revoke all on function public.handle_appointment_notification() from public, anon, authenticated;

revoke all on function public.get_admin_dashboard_metrics() from public, anon;
grant execute on function public.get_admin_dashboard_metrics() to authenticated, service_role;

revoke all on function public.get_tenant_financial_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_tenant_financial_metrics(timestamptz, timestamptz) to authenticated, service_role;

revoke all on function public.get_available_slots(uuid, uuid, uuid, date, uuid) from public, anon;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date, uuid) to authenticated, service_role;

revoke all on function public.create_appointment_by_token(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.create_appointment_by_token(uuid, uuid, uuid, timestamptz) to service_role;
