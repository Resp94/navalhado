begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select ok(
  position('if coalesce(new.is_anonymous, false) then' in lower(pg_get_functiondef('public.handle_new_user()'::regprocedure))) > 0,
  'o trigger de auth ignora usuarios anonimos antes de tocar em public.users'
);
select ok(
  position('return new;' in lower(pg_get_functiondef('public.handle_new_user()'::regprocedure))) > 0,
  'o trigger preserva a conclusao do insert em auth.users'
);

select * from finish();
rollback;
