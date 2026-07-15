begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_function('public','find_or_create_whatsapp_customer',
  array['uuid','text','text'],'RPC exists');
select ok(not has_function_privilege('public',
  'public.find_or_create_whatsapp_customer(uuid,text,text)','execute'),'PUBLIC denied');
select ok(not has_function_privilege('anon',
  'public.find_or_create_whatsapp_customer(uuid,text,text)','execute'),'anon denied');
select ok(not has_function_privilege('authenticated',
  'public.find_or_create_whatsapp_customer(uuid,text,text)','execute'),'authenticated denied');
select ok(has_function_privilege('service_role',
  'public.find_or_create_whatsapp_customer(uuid,text,text)','execute'),'service allowed');

insert into public.tenants(id,name,email,phone) values
('20000000-0000-0000-0000-000000000001','Tenant A','rpc-a@test.local','92999991001'),
('20000000-0000-0000-0000-000000000002','Tenant B','rpc-b@test.local','92999991002');

create temp table first_result on commit drop as
select * from public.find_or_create_whatsapp_customer(
  '20000000-0000-0000-0000-000000000001','(92) 99999-4444','  Maria  ');
select ok((select created from first_result),'new phone created');
select ok((select token_acesso is not null from first_result),'token generated');
select ok(not (select cadastro_completo from first_result),'new phone provisional');
select is((select name from public.customers where id=(select customer_id from first_result)),
  'Maria','push name trimmed');

update public.customers set name='Maria Final', cadastro_completo=true
where id=(select customer_id from first_result);
create temp table reused_result on commit drop as
select * from public.find_or_create_whatsapp_customer(
  '20000000-0000-0000-0000-000000000001','5592999994444','Overwrite');
select ok(not (select created from reused_result),'existing phone reused');
select is((select customer_id from reused_result),(select customer_id from first_result),
  'customer identity stable');
select is((select token_acesso from reused_result),(select token_acesso from first_result),
  'token stable');
select is((select name from public.customers where id=(select customer_id from reused_result)),
  'Maria Final','reuse does not overwrite');

select throws_ok($$select * from public.find_or_create_whatsapp_customer(
  '20000000-0000-0000-0000-000000000001','9999',null)$$,
  '22023','PHONE_INVALID','invalid phone rejected');
select throws_ok($$select * from public.find_or_create_whatsapp_customer(
  '29999999-0000-0000-0000-000000000099','92999995555',null)$$,
  'P0002','TENANT_NOT_FOUND','missing tenant rejected');

select isnt(
  (select customer_id from public.find_or_create_whatsapp_customer(
    '20000000-0000-0000-0000-000000000002','5592999994444','')),
  (select customer_id from first_result),
  'same phone isolated by tenant'
);

select * from finish();
rollback;
