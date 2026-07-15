begin;
create extension if not exists pgtap with schema extensions;
select plan(19);
select has_function('private','normalize_br_phone',array['text'],'normalizer exists');
select is(private.normalize_br_phone('(92) 99999-2222'),'5592999992222','mobile');
select is(private.normalize_br_phone('92 3333-4444'),'559233334444','landline');
select is(private.normalize_br_phone('5592999992222'),'5592999992222','country code');
select is(private.normalize_br_phone('9999'),null,'invalid');
select has_column('public','customers','cadastro_completo','flag exists');
select col_not_null('public','customers','cadastro_completo','flag not null');
select ok((select data_type='boolean' and column_default='true'
  from information_schema.columns where table_schema='public'
  and table_name='customers' and column_name='cadastro_completo'),'flag definition');
select has_column('public','customers','telefone_normalizado','generated phone');
select ok((select a.attgenerated='s'
  and pg_catalog.pg_get_expr(d.adbin,d.adrelid)='private.normalize_br_phone(phone)'
  from pg_catalog.pg_attribute a join pg_catalog.pg_attrdef d
  on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='public.customers'::regclass
  and a.attname='telefone_normalizado'),'generated definition');
select has_index('public','customers','customers_tenant_telefone_normalizado_uidx','identity index');
select ok((select i.indisunique and i.indpred is null and
  array(select a.attname::text from unnest(i.indkey) with ordinality k(attnum,pos)
    join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
    order by k.pos)=array['tenant_id','telefone_normalizado']::text[]
  from pg_catalog.pg_class x join pg_catalog.pg_index i on i.indexrelid=x.oid
  where x.relnamespace='public'::regnamespace
  and x.relname='customers_tenant_telefone_normalizado_uidx'),'index definition');
select ok(not exists(select 1 from public.customers where not cadastro_completo),'existing complete');
insert into public.tenants(id,name,email,phone) values
('10000000-0000-0000-0000-000000000001','Test A','onboarding-a@test.local','92999990001'),
('10000000-0000-0000-0000-000000000002','Test B','onboarding-b@test.local','92999990002');
insert into public.customers(tenant_id,name,phone)
values('10000000-0000-0000-0000-000000000001','Ana','(92) 99999-3333');
select throws_ok($$insert into public.customers(tenant_id,name,phone)
values('10000000-0000-0000-0000-000000000001','Other','5592999993333')$$,
'23505',null,'same tenant duplicate');
select lives_ok($$insert into public.customers(tenant_id,name,phone)
values('10000000-0000-0000-0000-000000000002','Ana B','5592999993333')$$,
'different tenant duplicate');
select throws_ok($$update public.customers set cadastro_completo=false where name='Ana'$$,
'P0001','CUSTOMER_REGISTRATION_CANNOT_REGRESS','cannot regress');
select ok((select position('cadastro_completo' in with_check)>0
  from pg_catalog.pg_policies where schemaname='public' and tablename='customers'
  and policyname='customers_insert_policy'),'policy requires complete');
select ok(not has_function_privilege('public','private.normalize_br_phone(text)','execute'),'PUBLIC denied');
select ok(has_function_privilege('service_role','private.normalize_br_phone(text)','execute'),'service allowed');
select * from finish();
rollback;
