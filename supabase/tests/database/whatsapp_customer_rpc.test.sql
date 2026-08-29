begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select lives_ok(
  $$
    select *
    from public.find_or_create_whatsapp_customer(
      (select id from public.tenants order by created_at limit 1),
      'first-contact-regression-' || gen_random_uuid()::text,
      'Cliente de teste'
    )
  $$,
  'find_or_create_whatsapp_customer creates a new customer without token ambiguity'
);

select * from finish();
rollback;
