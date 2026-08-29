begin;

select plan(7);

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'claim_whatsapp_message_outbox'
   and pg_get_function_identity_arguments(p.oid) = 'p_limit integer'),
  false,
  'claim da outbox não deve executar como SECURITY DEFINER no schema exposto'
);

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'complete_whatsapp_message_outbox'
   and pg_get_function_identity_arguments(p.oid) = 'p_outbox_id uuid, p_success boolean, p_error text'),
  false,
  'complete da outbox não deve executar como SECURITY DEFINER no schema exposto'
);

select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_pending_return_reminders'
   and pg_get_function_identity_arguments(p.oid) = 'p_tenant_id uuid'),
  false,
  'consulta de lembretes não deve executar como SECURITY DEFINER no schema exposto'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('fn_customer_welcome_balcao_trigger', 'fn_appointment_whatsapp_trigger')
     and p.prosecdef),
  0,
  'gatilhos privilegiados não devem permanecer publicados no schema public'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private'
     and p.proname in ('fn_customer_welcome_balcao_trigger', 'fn_appointment_whatsapp_trigger')),
  2,
  'gatilhos privilegiados devem ficar no schema privado'
);

select is(
  has_function_privilege('anon', 'private.fn_customer_welcome_balcao_trigger()', 'EXECUTE'),
  false,
  'gatilho de boas-vindas não deve ser executável por anon'
);

select is(
  has_function_privilege('authenticated', 'private.fn_appointment_whatsapp_trigger()', 'EXECUTE'),
  false,
  'gatilho de agendamento não deve ser executável por authenticated'
);

select * from finish();
rollback;
