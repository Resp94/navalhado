begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

select has_table(
  'public',
  'whatsapp_instances',
  'neutral WhatsApp instance table exists'
);
select has_table(
  'public',
  'whatsapp_message_idempotency',
  'neutral idempotency table exists'
);
select has_constraint(
  'public',
  'whatsapp_instances',
  'whatsapp_instances_tenant_id_key',
  'one neutral instance per tenant'
);
select has_constraint(
  'public',
  'whatsapp_instances',
  'whatsapp_instances_provider_check',
  'provider is constrained'
);
select has_constraint(
  'public',
  'whatsapp_instances',
  'whatsapp_instances_status_check',
  'neutral connection states are constrained'
);
select has_constraint(
  'public',
  'whatsapp_instances',
  'whatsapp_instances_reminder_hours_check',
  'reminder hours are constrained'
);
select has_constraint(
  'public',
  'whatsapp_message_idempotency',
  'whatsapp_message_idempotency_key',
  'idempotency key is unique per tenant and direction'
);
select has_constraint(
  'public',
  'whatsapp_message_idempotency',
  'whatsapp_message_idempotency_reminder_window_required_check',
  'reminder events require a window'
);
select has_constraint(
  'public',
  'whatsapp_message_idempotency',
  'whatsapp_message_idempotency_instance_tenant_fkey',
  'instance references cannot cross tenants'
);
select has_constraint(
  'public',
  'whatsapp_message_idempotency',
  'whatsapp_message_idempotency_appointment_tenant_fkey',
  'appointment references cannot cross tenants'
);
select has_index(
  'public',
  'appointments',
  'appointments_id_tenant_uidx',
  'appointments expose a tenant-composite key'
);
select has_index(
  'public',
  'whatsapp_message_idempotency',
  'whatsapp_message_idempotency_inbound_external_uidx',
  'inbound external message ids are unique'
);
select has_index(
  'public',
  'whatsapp_message_idempotency',
  'whatsapp_message_idempotency_appointment_event_uidx',
  'appointment confirmation and cancellation are unique'
);
select has_index(
  'public',
  'whatsapp_message_idempotency',
  'whatsapp_message_idempotency_reminder_window_uidx',
  'reminders are unique per appointment window'
);
select ok(
  (select column_default = '''uazapi''::text'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'whatsapp_instances'
     and column_name = 'provider'),
  'new instances default to uazapi'
);
select ok(
  (select column_default = '''disconnected''::text'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'whatsapp_instances'
     and column_name = 'status'),
  'new instances default to disconnected'
);
select ok(
  (select column_default = 'true'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'whatsapp_instances'
     and column_name = 'send_confirmation'),
  'confirmation defaults to enabled'
);
select ok(
  (select column_default = 'true'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'whatsapp_instances'
     and column_name = 'send_reminders'),
  'reminders default to enabled'
);
select ok(
  (select column_default = 'true'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'whatsapp_instances'
     and column_name = 'send_cancellation'),
  'cancellation defaults to enabled'
);
select ok(
  (select column_default = '2'
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'whatsapp_instances'
     and column_name = 'reminder_hours'),
  'reminder hours default to two'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_catalog.pg_class
   where oid = 'public.whatsapp_instances'::regclass),
  'instance table has forced RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity
   from pg_catalog.pg_class
   where oid = 'public.whatsapp_message_idempotency'::regclass),
  'idempotency table has forced RLS'
);
select ok(
  position('get_auth_tenant_id' in (select qual from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_instances'
      and policyname = 'whatsapp_instances_select_policy')) > 0,
  'instance reads are tenant-scoped'
);
select ok(
  position('get_auth_tenant_id' in (select qual from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'whatsapp_message_idempotency'
      and policyname = 'whatsapp_message_idempotency_select_policy')) > 0,
  'idempotency reads are tenant-scoped'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.whatsapp_instances',
    'instance_token',
    'SELECT'
  ),
  'instance token is not browser-readable'
);
select ok(
  not has_column_privilege(
    'authenticated',
    'public.whatsapp_instances',
    'instance_token',
    'UPDATE'
  ),
  'instance token is not browser-writable'
);
select ok(
  has_column_privilege(
    'authenticated',
    'public.whatsapp_instances',
    'status',
    'SELECT'
  ),
  'safe instance fields remain readable'
);
select ok(
  not has_table_privilege('anon', 'public.whatsapp_instances', 'SELECT'),
  'anonymous users cannot read instances'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_instances', 'INSERT'),
  'browser cannot create backend-managed instances'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_instances', 'DELETE'),
  'browser cannot delete backend-managed instances'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_message_idempotency', 'INSERT'),
  'browser cannot create idempotency reservations'
);
select ok(
  not has_table_privilege('authenticated', 'public.whatsapp_message_idempotency', 'DELETE'),
  'browser cannot delete idempotency reservations'
);

insert into public.tenants(id, name, email, phone) values
  ('40000000-0000-0000-0000-000000000001', 'Neutral WhatsApp Tenant', 'neutral-whatsapp@test.local', '92999994001'),
  ('40000000-0000-0000-0000-000000000002', 'Neutral WhatsApp Tenant 2', 'neutral-whatsapp-2@test.local', '92999994002'),
  ('40000000-0000-0000-0000-000000000003', 'Neutral WhatsApp Tenant 3', 'neutral-whatsapp-3@test.local', '92999994003');

insert into public.whatsapp_instances(
  tenant_id,
  instance_name,
  instance_token
) values (
  '40000000-0000-0000-0000-000000000001',
  'neutral_whatsapp_test_1',
  'backend-only-instance-token'
);

select lives_ok($$insert into public.whatsapp_instances(
  tenant_id, instance_name, instance_token, status
) values (
  '40000000-0000-0000-0000-000000000002',
  'neutral_whatsapp_test_2',
  'backend-only-instance-token-2',
  'connected'
)$$, 'connected is an accepted state');

select lives_ok($$insert into public.whatsapp_instances(
  tenant_id, instance_name, instance_token, status
) values (
  '40000000-0000-0000-0000-000000000003',
  'neutral_whatsapp_test_3',
  'backend-only-instance-token-3',
  'hibernated'
)$$, 'hibernated is an accepted state');

select lives_ok($$update public.whatsapp_instances
set status = 'connecting'
where tenant_id = '40000000-0000-0000-0000-000000000002'$$,
'connecting is an accepted state');

select throws_ok($$update public.whatsapp_instances
set status = 'pairing'
where tenant_id = '40000000-0000-0000-0000-000000000002'$$,
'23514', null, 'legacy pairing state is rejected');

select throws_ok($$update public.whatsapp_instances
set reminder_hours = 0
where tenant_id = '40000000-0000-0000-0000-000000000002'$$,
'23514', null, 'zero reminder hours are rejected');

select throws_ok($$update public.whatsapp_instances
set reminder_hours = 25
where tenant_id = '40000000-0000-0000-0000-000000000002'$$,
'23514', null, 'reminder hours above 24 are rejected');

select throws_ok($$insert into public.whatsapp_instances(
  tenant_id, instance_name, instance_token
) values (
  '40000000-0000-0000-0000-000000000001',
  'neutral_whatsapp_duplicate',
  'backend-only-instance-token-2'
)$$, '23505', null, 'duplicate tenant instance is rejected');

select throws_ok($$insert into public.whatsapp_instances(
  tenant_id, provider, instance_name, instance_token
) values (
  '40000000-0000-0000-0000-000000000002',
  'evolution',
  'neutral_whatsapp_invalid_provider',
  'backend-only-instance-token-3'
)$$, '23514', null, 'non-Uazapi provider is rejected');

insert into public.whatsapp_message_idempotency(
  tenant_id,
  direction,
  event_type,
  idempotency_key,
  external_message_id
) values (
  '40000000-0000-0000-0000-000000000001',
  'inbound',
  'message',
  'uazapi-message-001',
  'uazapi-external-message-001'
);

select throws_ok($$insert into public.whatsapp_message_idempotency(
  tenant_id, direction, event_type, idempotency_key, external_message_id
) values (
  '40000000-0000-0000-0000-000000000001',
  'inbound',
  'message',
  'uazapi-message-002',
  'uazapi-external-message-001'
)$$, '23505', null, 'duplicate external message id is rejected');

select throws_ok($$insert into public.whatsapp_message_idempotency(
  tenant_id, whatsapp_instance_id, direction, event_type, idempotency_key
) values (
  '40000000-0000-0000-0000-000000000002',
  (select id from public.whatsapp_instances
   where tenant_id = '40000000-0000-0000-0000-000000000001'),
  'inbound',
  'message',
  'cross-tenant-instance-reference'
)$$, '23503', null, 'instance reference cannot cross tenants');

select lives_ok($$insert into public.whatsapp_message_idempotency(
  tenant_id, direction, event_type, idempotency_key
) values (
  '40000000-0000-0000-0000-000000000001',
  'outbound',
  'message',
  'uazapi-message-001'
)$$, 'same key is allowed across independent directions');

select throws_ok($$insert into public.whatsapp_message_idempotency(
  tenant_id, direction, event_type, idempotency_key, attempt_count
) values (
  '40000000-0000-0000-0000-000000000001',
  'outbound',
  'appointment_created',
  'too-many-attempts',
  4
)$$, '23514', null, 'attempt count cannot exceed three');

select lives_ok($$insert into public.whatsapp_message_idempotency(
  tenant_id, direction, event_type, idempotency_key, attempt_count
) values (
  '40000000-0000-0000-0000-000000000001',
  'outbound',
  'appointment_created',
  'three-attempts-complete',
  3
)$$, 'three completed attempts are allowed');

select * from finish();
rollback;
