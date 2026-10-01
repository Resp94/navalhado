begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table(
  'public',
  'whatsapp_message_outbox',
  'welcome outbox table exists'
);
select ok(
  exists(
    select 1 from pg_constraint
    where conrelid = 'public.whatsapp_message_outbox'::regclass
      and conname = 'whatsapp_message_outbox_key_unique'
  ),
  'outbox idempotency is tenant scoped'
);
select ok(
  exists(
    select 1 from pg_constraint
    where conrelid = 'public.whatsapp_message_outbox'::regclass
      and conname = 'whatsapp_message_outbox_status_check'
  ),
  'outbox states are constrained'
);
select has_index(
  'public',
  'whatsapp_message_outbox',
  'whatsapp_message_outbox_ready_idx',
  'ready outbox items are indexed'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_catalog.pg_class
   where oid = 'public.whatsapp_message_outbox'::regclass),
  'outbox has forced RLS'
);
select ok(
  not has_table_privilege('anon', 'public.whatsapp_message_outbox', 'SELECT'),
  'anonymous users cannot read the outbox'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_message_outbox', 'INSERT'),
  'browser cannot insert outbox events'
);
select ok(
  has_function_privilege('service_role', 'public.claim_whatsapp_message_outbox(integer)', 'EXECUTE'),
  'worker can claim outbox items'
);
select ok(
  not has_function_privilege('anon', 'public.claim_whatsapp_message_outbox(integer)', 'EXECUTE'),
  'anonymous callers cannot claim outbox items'
);
select ok(
  position('whatsapp_message_outbox' in pg_get_functiondef('private.fn_customer_welcome_balcao_trigger()'::regprocedure)) > 0,
  'welcome trigger persists an outbox event'
);
select ok(
  position('net.http_post' in pg_get_functiondef('private.fn_customer_welcome_balcao_trigger()'::regprocedure)) = 0,
  'welcome trigger does not fire HTTP directly'
);
select ok(
  coalesce((select 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.claim_whatsapp_message_outbox(integer)'::regprocedure), false),
  'claim function has an explicit empty search path'
);

select * from finish(true);
rollback;
