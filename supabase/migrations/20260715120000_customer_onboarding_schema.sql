set local lock_timeout = '5s';
-- Two-row baseline. Use a maintenance window before applying on a large table.
create schema if not exists private;

create or replace function private.normalize_br_phone(p_phone text)
returns text language sql immutable strict set search_path = ''
as $$
  with d as (select regexp_replace(p_phone, '[^0-9]', '', 'g') value)
  select case
    when value ~ '^55[1-9][0-9]{9,10}$' then value
    when value ~ '^[1-9][0-9]{9,10}$' then '55' || value
    else null
  end from d
$$;
revoke all on function private.normalize_br_phone(text) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.normalize_br_phone(text) to authenticated, service_role;

do $$
declare v_invalid bigint; v_duplicates bigint; v_type text;
begin
  select count(*) into v_invalid from public.customers
  where private.normalize_br_phone(phone) is null;
  select count(*) into v_duplicates from (
    select tenant_id, private.normalize_br_phone(phone)
    from public.customers
    group by tenant_id, private.normalize_br_phone(phone)
    having count(*) > 1
  ) d;
  if v_invalid > 0 or v_duplicates > 0 then
    raise exception 'CUSTOMER_PHONE_PREFLIGHT_FAILED'
      using detail = format('invalid=%s duplicate_groups=%s', v_invalid, v_duplicates);
  end if;
  select format_type(atttypid, atttypmod) into v_type
  from pg_catalog.pg_attribute
  where attrelid = 'public.customers'::regclass
    and attname = 'cadastro_completo' and not attisdropped;
  if found and v_type <> 'boolean' then
    raise exception 'CUSTOMER_ONBOARDING_SCHEMA_MISMATCH'
      using detail = format('cadastro_completo type=%s', v_type);
  end if;
end $$;

alter table public.customers add column if not exists cadastro_completo boolean;
update public.customers set cadastro_completo = true where cadastro_completo is null;
alter table public.customers alter column cadastro_completo set default true;
alter table public.customers alter column cadastro_completo set not null;

do $$
declare v_type text; v_generated "char"; v_expression text;
begin
  select format_type(a.atttypid, a.atttypmod), a.attgenerated,
         pg_catalog.pg_get_expr(d.adbin, d.adrelid)
  into v_type, v_generated, v_expression
  from pg_catalog.pg_attribute a
  left join pg_catalog.pg_attrdef d
    on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attrelid = 'public.customers'::regclass
    and a.attname = 'telefone_normalizado' and not a.attisdropped;
  if found and (v_type <> 'text' or v_generated <> 's'
    or v_expression <> 'private.normalize_br_phone(phone)') then
    raise exception 'CUSTOMER_ONBOARDING_SCHEMA_MISMATCH'
      using detail = format('phone type=%s generated=%s expression=%s',
        v_type, v_generated, v_expression);
  end if;
end $$;

alter table public.customers add column if not exists telefone_normalizado text
generated always as (private.normalize_br_phone(phone)) stored;

do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'customers_telefone_normalizado_valid_chk'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_telefone_normalizado_valid_chk
      check (telefone_normalizado is not null) not valid;
  end if;
end $$;
alter table public.customers validate constraint customers_telefone_normalizado_valid_chk;

do $$
declare v_unique boolean; v_plain boolean; v_columns text[];
begin
  select i.indisunique, i.indpred is null,
    array(select a.attname::text
      from unnest(i.indkey) with ordinality k(attnum, pos)
      join pg_catalog.pg_attribute a
        on a.attrelid = i.indrelid and a.attnum = k.attnum
      order by k.pos)
  into v_unique, v_plain, v_columns
  from pg_catalog.pg_class x join pg_catalog.pg_index i on i.indexrelid = x.oid
  where x.relnamespace = 'public'::regnamespace
    and x.relname = 'customers_tenant_telefone_normalizado_uidx';
  if found and (not v_unique or not v_plain
    or v_columns <> array['tenant_id','telefone_normalizado']::text[]) then
    raise exception 'CUSTOMER_ONBOARDING_SCHEMA_MISMATCH'
      using detail = format('index unique=%s plain=%s columns=%s',
        v_unique, v_plain, v_columns);
  end if;
  if not found then
    create unique index customers_tenant_telefone_normalizado_uidx
      on public.customers(tenant_id, telefone_normalizado);
  end if;
end $$;

create or replace function private.prevent_customer_registration_regression()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.cadastro_completo and not new.cadastro_completo then
    raise exception 'CUSTOMER_REGISTRATION_CANNOT_REGRESS';
  end if;
  return new;
end $$;
revoke all on function private.prevent_customer_registration_regression() from public;
drop trigger if exists customers_registration_cannot_regress on public.customers;
create trigger customers_registration_cannot_regress
before update of cadastro_completo on public.customers
for each row execute function private.prevent_customer_registration_regression();

drop policy if exists customers_insert_policy on public.customers;
create policy customers_insert_policy on public.customers
for insert to authenticated with check (
  cadastro_completo is true and (
    (select private.is_saas_admin())
    or tenant_id = (select private.get_auth_tenant_id())
  )
);
