begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_function(
  'public',
  'get_public_tenant_by_slug',
  array['text'],
  'public tenant context function exists'
);

select ok(
  has_function_privilege(
    'anon',
    'public.get_public_tenant_by_slug(text)',
    'EXECUTE'
  ),
  'anonymous visitors can resolve a public tenant context'
);

select ok(
  (select p.prosecdef
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.oid = 'public.get_public_tenant_by_slug(text)'::regprocedure),
  'public tenant context uses a security definer boundary'
);

select ok(
  (select exists(
    select 1
    from pg_proc p
    where p.oid = 'public.get_public_tenant_by_slug(text)'::regprocedure
      and array_to_string(p.proconfig, ',') like '%search_path=%'
  )),
  'public tenant context pins its search path'
);

insert into public.tenants(id, name, email, phone, slug, onboarding_completed)
values (
  '57000000-0000-0000-0000-000000000001',
  'Tenant Context Test',
  'tenant-context-test@test.local',
  '92999990001',
  'tenant-context-test',
  true
);

select is(
  (select tenant_name from public.get_public_tenant_by_slug(' TENANT-CONTEXT-TEST ')),
  'Tenant Context Test'::text,
  'slug lookup is case-insensitive and trims whitespace'
);

select is(
  (select tenant_slug from public.get_public_tenant_by_slug('tenant-context-test')),
  'tenant-context-test'::text,
  'context returns the canonical tenant slug'
);

select is(
  (select count(*)::integer from public.customers
   where tenant_id = '57000000-0000-0000-0000-000000000001'),
  0,
  'resolving public context does not create a customer'
);

select is(
  (select count(*)::integer from public.get_public_tenant_by_slug('missing-tenant')),
  0,
  'missing slug returns no context'
);

select * from finish();
rollback;
