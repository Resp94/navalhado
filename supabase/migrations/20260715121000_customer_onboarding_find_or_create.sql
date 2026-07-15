create or replace function public.find_or_create_whatsapp_customer(
  p_tenant_id uuid,
  p_phone text,
  p_push_name text default null
)
returns table(
  customer_id uuid,
  tenant_id uuid,
  token_acesso uuid,
  cadastro_completo boolean,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.normalize_br_phone(p_phone);
  v_customer public.customers%rowtype;
begin
  if v_phone is null then
    raise exception 'PHONE_INVALID' using errcode = '22023';
  end if;
  if not exists(select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'TENANT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || v_phone, 0)
  );

  select c.* into v_customer
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.telefone_normalizado = v_phone;

  if found then
    return query select v_customer.id, v_customer.tenant_id,
      v_customer.token_acesso, v_customer.cadastro_completo, false;
    return;
  end if;

  insert into public.customers(tenant_id, name, phone, cadastro_completo)
  values(
    p_tenant_id,
    left(coalesce(nullif(btrim(p_push_name), ''), 'Cliente'), 100),
    v_phone,
    false
  )
  on conflict do nothing
  returning * into v_customer;

  if found then
    return query select v_customer.id, v_customer.tenant_id,
      v_customer.token_acesso, v_customer.cadastro_completo, true;
    return;
  end if;

  select c.* into strict v_customer
  from public.customers c
  where c.tenant_id = p_tenant_id
    and c.telefone_normalizado = v_phone;

  return query select v_customer.id, v_customer.tenant_id,
    v_customer.token_acesso, v_customer.cadastro_completo, false;
end;
$$;

revoke all on function public.find_or_create_whatsapp_customer(uuid,text,text)
from public, anon, authenticated;
grant execute on function public.find_or_create_whatsapp_customer(uuid,text,text)
to service_role;
