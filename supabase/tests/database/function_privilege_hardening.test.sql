begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select ok(not has_function_privilege('anon', 'public.fn_appointment_whatsapp_trigger()', 'EXECUTE'), 'appointment trigger is not callable');
select ok(not has_function_privilege('authenticated', 'public.fn_evolution_api_instance_trigger()', 'EXECUTE'), 'instance trigger is not callable');
select ok(not has_function_privilege('anon', 'public.handle_appointment_notification()', 'EXECUTE'), 'notification trigger is not callable');
select ok(not has_function_privilege('anon', 'public.get_admin_dashboard_metrics()', 'EXECUTE'), 'admin metrics deny anonymous users');
select ok(has_function_privilege('authenticated', 'public.get_admin_dashboard_metrics()', 'EXECUTE'), 'admin metrics remain available to authenticated admin');
select ok(not has_function_privilege('anon', 'public.get_tenant_financial_metrics(timestamptz,timestamptz)', 'EXECUTE'), 'financial metrics deny anonymous users');
select ok(not has_function_privilege('anon', 'public.get_available_slots(uuid,uuid,uuid,date,uuid)', 'EXECUTE'), 'internal slot overload denies anonymous users');
select ok(has_function_privilege('anon', 'public.get_available_slots(uuid,uuid,date)', 'EXECUTE'), 'token slot overload remains public');
select ok(not has_function_privilege('authenticated', 'public.create_appointment_by_token(uuid,uuid,uuid,timestamptz)', 'EXECUTE'), 'internal appointment overload is server-only');

select * from finish();
rollback;
