begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- 1. Verifica existência das novas colunas na tabela tenants
select has_column('public', 'tenants', 'cep', 'tenants possui coluna cep');
select has_column('public', 'tenants', 'address_street', 'tenants possui coluna address_street');
select has_column('public', 'tenants', 'latitude', 'tenants possui coluna latitude');
select has_column('public', 'tenants', 'longitude', 'tenants possui coluna longitude');
select has_column('public', 'tenants', 'base_cut_price', 'tenants possui coluna base_cut_price');
select has_column('public', 'tenants', 'acquisition_channel', 'tenants possui coluna acquisition_channel');
select has_column('public', 'tenants', 'onboarding_completed', 'tenants possui coluna onboarding_completed');

select * from finish();
rollback;
