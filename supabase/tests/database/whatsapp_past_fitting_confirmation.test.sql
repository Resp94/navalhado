begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_function(
  'private',
  'fn_appointment_whatsapp_trigger()',
  'appointment WhatsApp trigger remains private'
);

select ok(
  position('NEW.is_fitting' in pg_get_functiondef(p.oid)) > 0,
  'trigger checks whether the appointment is a fitting'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'fn_appointment_whatsapp_trigger';

select ok(
  position('NEW.start_time < now()' in pg_get_functiondef(p.oid)) > 0,
  'trigger compares the fitting start instant with the database clock'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'fn_appointment_whatsapp_trigger';

select ok(
  position('whatsapp_confirmation_suppressed' in pg_get_functiondef(p.oid)) > 0,
  'trigger records a sanitized suppression reason'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'fn_appointment_whatsapp_trigger';

select ok(
  position('whatsapp_message_outbox' in pg_get_functiondef(p.oid)) > 0,
  'eligible appointments continue using the durable outbox'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private'
  and p.proname = 'fn_appointment_whatsapp_trigger';

select is(
  (select count(*)::integer
   from information_schema.triggers
   where event_object_schema = 'public'
     and event_object_table = 'appointments'
     and trigger_name = 'trg_appointment_whatsapp'),
  2,
  'appointment trigger remains installed for insert and update'
);

select * from finish();
rollback;

