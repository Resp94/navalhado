begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(not has_function_privilege('anon', 'private.fn_appointment_whatsapp_trigger()', 'EXECUTE'), 'appointment trigger is not callable');
select ok(not has_function_privilege('anon', 'public.handle_appointment_notification()', 'EXECUTE'), 'notification trigger is not callable');
select ok(not has_function_privilege('anon', 'public.get_admin_dashboard_metrics()', 'EXECUTE'), 'admin metrics deny anonymous users');
select ok(has_function_privilege('authenticated', 'public.get_admin_dashboard_metrics()', 'EXECUTE'), 'admin metrics remain available to authenticated admin');
select ok(not has_function_privilege('anon', 'public.get_tenant_financial_metrics(timestamptz,timestamptz,uuid)', 'EXECUTE'), 'financial metrics deny anonymous users');
select ok(not has_function_privilege('anon', 'public.get_available_slots(uuid,uuid,uuid,date,uuid)', 'EXECUTE'), 'internal slot overload denies anonymous users');
select ok(has_function_privilege('authenticated', 'public.get_available_slots(uuid,uuid,uuid,date,uuid)', 'EXECUTE'), 'internal slot overload remains usable by authenticated staff');
select ok(not exists(
  select 1 from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_appointment_by_token'
    and pg_get_function_identity_arguments(p.oid) = 'p_token uuid, p_service_id uuid, p_professional_id uuid, p_start_time timestamp with time zone'
), 'internal timestamptz overload was removed, not merely restricted');

select * from finish(true);
rollback;
