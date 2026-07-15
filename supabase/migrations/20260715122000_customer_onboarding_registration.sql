create or replace function public.complete_customer_registration(
  p_token uuid,
  p_name text
)
returns table(
  customer_id uuid,
  customer_name text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  cadastro_completo boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_row record;
begin
  if v_name is null or char_length(v_name) not between 2 and 100 then
    raise exception 'CUSTOMER_NAME_INVALID' using errcode = '22023';
  end if;

  update public.customers c
  set name = v_name,
      cadastro_completo = true,
      updated_at = timezone('utc'::text, now())
  from public.tenants t
  where c.tenant_id = t.id
    and c.token_acesso = p_token
    and (c.token_expirado_em is null or c.token_expirado_em >= now())
    and c.cadastro_completo = false
  returning c.id as customer_id,
    c.name as customer_name,
    c.tenant_id as tenant_id,
    t.name as tenant_name,
    t.phone as tenant_phone,
    c.cadastro_completo as cadastro_completo
  into v_row;

  if found then
    return query select v_row.customer_id, v_row.customer_name, v_row.tenant_id,
      v_row.tenant_name, v_row.tenant_phone, v_row.cadastro_completo;
    return;
  end if;

  select c.id, c.name, c.tenant_id, t.name as tenant_name,
         t.phone as tenant_phone, c.cadastro_completo, c.token_expirado_em
  into v_row
  from public.customers c
  join public.tenants t on t.id = c.tenant_id
  where c.token_acesso = p_token;

  if not found then
    raise exception 'TOKEN_INVALID' using errcode = 'P0002';
  end if;

  if v_row.token_expirado_em is not null and v_row.token_expirado_em < now() then
    raise exception 'TOKEN_EXPIRED' using errcode = '22023';
  end if;

  return query select v_row.id, v_row.name, v_row.tenant_id,
    v_row.tenant_name, v_row.tenant_phone, v_row.cadastro_completo;
end;
$$;

revoke all on function public.complete_customer_registration(uuid,text)
from public, anon, authenticated, service_role;
grant execute on function public.complete_customer_registration(uuid,text)
to anon, authenticated, service_role;

drop function if exists public.get_customer_details_by_token(uuid);

create function public.get_customer_details_by_token(p_token uuid)
returns table(
  customer_id uuid,
  customer_name text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  cadastro_completo boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select c.id, c.name, c.tenant_id, t.name as tenant_name,
         t.phone as tenant_phone, c.cadastro_completo, c.token_expirado_em
  into v_row
  from public.customers c
  join public.tenants t on t.id = c.tenant_id
  where c.token_acesso = p_token;

  if not found then
    raise exception 'TOKEN_INVALID' using errcode = 'P0002';
  end if;

  if v_row.token_expirado_em is not null and v_row.token_expirado_em < now() then
    raise exception 'TOKEN_EXPIRED' using errcode = '22023';
  end if;

  return query select v_row.id, v_row.name, v_row.tenant_id,
    v_row.tenant_name, v_row.tenant_phone, v_row.cadastro_completo;
end;
$$;

revoke all on function public.get_customer_details_by_token(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_customer_details_by_token(uuid)
to anon, authenticated, service_role;
