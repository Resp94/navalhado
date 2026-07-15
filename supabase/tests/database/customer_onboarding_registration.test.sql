begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select has_function('public','complete_customer_registration',
  array['uuid','text'],'completion RPC exists');

insert into public.tenants(id,name,email,phone) values
('30000000-0000-0000-0000-000000000001','Registration Test','registration@test.local','92999992001');

insert into public.customers(
  id,tenant_id,name,phone,token_acesso,cadastro_completo,token_expirado_em
) values
('31000000-0000-0000-0000-000000000001',
 '30000000-0000-0000-0000-000000000001','Cliente','92999992002',
 '32000000-0000-0000-0000-000000000001',false,null),
('31000000-0000-0000-0000-000000000002',
 '30000000-0000-0000-0000-000000000001','Expirado','92999992003',
 '32000000-0000-0000-0000-000000000002',false,now()-interval '1 minute');

select throws_ok(
  $$select * from public.complete_customer_registration(
    '32000000-0000-0000-0000-000000000001','A')$$,
  '22023','CUSTOMER_NAME_INVALID','short name rejected'
);
select throws_ok(
  format($sql$select * from public.complete_customer_registration(
    '32000000-0000-0000-0000-000000000001',%L)$sql$,repeat('a',101)),
  '22023','CUSTOMER_NAME_INVALID','long name rejected'
);
select throws_ok(
  $$select * from public.complete_customer_registration(
    '32999999-0000-0000-0000-000000000099','Maria')$$,
  'P0002','TOKEN_INVALID','unknown token rejected'
);
select throws_ok(
  $$select * from public.complete_customer_registration(
    '32000000-0000-0000-0000-000000000002','Maria')$$,
  '22023','TOKEN_EXPIRED','expired token rejected'
);

create temp table completed_first on commit drop as
select * from public.complete_customer_registration(
  '32000000-0000-0000-0000-000000000001','  Maria Silva  ');

select is((select customer_name from completed_first),'Maria Silva','name trimmed');
select ok((select cadastro_completo from completed_first),'registration completed');

create temp table completed_second on commit drop as
select * from public.complete_customer_registration(
  '32000000-0000-0000-0000-000000000001','Outro Nome');

select is((select customer_id from completed_second),
  (select customer_id from completed_first),'same customer returned');
select is((select customer_name from completed_second),'Maria Silva','second call preserves name');
select ok((select cadastro_completo from public.get_customer_details_by_token(
  '32000000-0000-0000-0000-000000000001')),'details returns completion flag');

select ok((select p.prosecdef and 'search_path=""'=any(p.proconfig)
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='complete_customer_registration'),
  'completion RPC secured');
select ok((select p.prosecdef and 'search_path=""'=any(p.proconfig)
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_customer_details_by_token'),
  'details RPC secured');

select ok(not has_function_privilege('public',
  'public.complete_customer_registration(uuid,text)','execute'),'completion PUBLIC denied');
select ok(has_function_privilege('anon',
  'public.complete_customer_registration(uuid,text)','execute'),'completion anon allowed');
select ok(has_function_privilege('authenticated',
  'public.complete_customer_registration(uuid,text)','execute'),'completion authenticated allowed');
select ok(has_function_privilege('service_role',
  'public.complete_customer_registration(uuid,text)','execute'),'completion service allowed');

select ok(not has_function_privilege('public',
  'public.get_customer_details_by_token(uuid)','execute'),'details PUBLIC denied');
select ok(has_function_privilege('anon',
  'public.get_customer_details_by_token(uuid)','execute'),'details anon allowed');
select ok(has_function_privilege('authenticated',
  'public.get_customer_details_by_token(uuid)','execute'),'details authenticated allowed');
select ok(has_function_privilege('service_role',
  'public.get_customer_details_by_token(uuid)','execute'),'details service allowed');

select * from finish();
rollback;
