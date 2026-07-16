begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select ok(
  position('raw_user_meta_data ->> ''role''' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) = 0,
  'auth trigger ignores client role metadata'
);
select ok(
  position('raw_user_meta_data ->> ''tenant_id''' in pg_get_functiondef('public.handle_new_user()'::regprocedure)) = 0,
  'auth trigger ignores client tenant metadata'
);
select has_trigger('public', 'users', 'protect_user_authority_fields', 'authority trigger exists');
select ok(
  not has_table_privilege('anon', 'public.tenants', 'INSERT'),
  'anonymous tenant insert is revoked'
);
select ok(
  not has_table_privilege('anon', 'public.view_tenants_management', 'SELECT'),
  'management view is hidden from anonymous users'
);
select ok(
  coalesce((select 'security_invoker=true' = any(reloptions)
    from pg_class where oid = 'public.view_tenants_management'::regclass), false),
  'management view runs as invoker'
);
select ok(
  not has_column_privilege('authenticated', 'public.evolution_api_instances', 'api_key', 'SELECT'),
  'Evolution API key is not browser-readable'
);
select has_index(
  'public', 'evolution_api_instances', 'evolution_api_instances_tenant_id_uidx',
  'one Evolution instance per tenant'
);
select has_index(
  'public', 'professionals', 'professionals_user_id_uidx',
  'one professional record per auth user'
);
select has_constraint(
  'public', 'appointments', 'appointments_no_professional_overlap',
  'overlapping active appointments are blocked'
);
select ok(
  position('is_own_professional' in (select qual from pg_policies
    where schemaname = 'public' and tablename = 'appointments'
      and policyname = 'appointments_select_policy')) > 0,
  'barber appointment reads are professional-scoped'
);
select ok(
  position('is_own_appointment' in (select qual from pg_policies
    where schemaname = 'public' and tablename = 'payments'
      and policyname = 'payments_select_policy')) > 0,
  'barber payment reads are professional-scoped'
);

select * from finish();
rollback;
