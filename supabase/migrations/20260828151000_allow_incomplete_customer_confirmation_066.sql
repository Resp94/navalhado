-- Compatibilidade: tokens válidos de clientes provisórios também podem concluir
-- o cadastro dentro da confirmação transacional.
create or replace function public.confirm_public_booking(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_date date,
  p_slot text,
  p_name text,
  p_phone text,
  p_token uuid
)
returns table(
  appointment_id uuid,
  customer_id uuid,
  token_acesso uuid,
  customer_name text,
  customer_phone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_customer public.customers%rowtype;
  v_phone text;
  v_name text := btrim(p_name);
  v_appointment_id uuid;
begin
  if v_name is null or array_length(regexp_split_to_array(v_name, '\s+'), 1) < 2 then
    raise exception 'Informe nome e sobrenome completos.' using errcode = '22023';
  end if;

  v_phone := private.normalize_br_phone(p_phone);
  if v_phone is null then
    raise exception 'Informe um WhatsApp válido com DDD.' using errcode = '22023';
  end if;

  select t.id
  into v_tenant_id
  from public.tenants t
  where lower(t.slug) = lower(btrim(p_slug));

  if v_tenant_id is null then
    raise exception 'Estabelecimento não encontrado.' using errcode = 'P0002';
  end if;

  if p_token is not null and not exists (
    select 1
    from public.customers c
    where c.token_acesso = p_token
      and c.tenant_id = v_tenant_id
      and (c.token_expirado_em is null or c.token_expirado_em >= now())
  ) then
    raise exception 'Token inválido para este estabelecimento.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || v_phone, 0));

  select c.*
  into v_customer
  from public.customers c
  where c.tenant_id = v_tenant_id
    and c.telefone_normalizado = v_phone;

  if found then
    if v_customer.cadastro_completo is false then
      update public.customers
      set name = left(v_name, 100),
          phone = v_phone,
          cadastro_completo = true,
          registration_origin = 'canal_cliente',
          updated_at = timezone('utc'::text, now())
      where id = v_customer.id
      returning * into v_customer;
    end if;
  else
    insert into public.customers(
      tenant_id,
      name,
      phone,
      cadastro_completo,
      registration_origin
    )
    values(
      v_tenant_id,
      left(v_name, 100),
      v_phone,
      true,
      'canal_cliente'
    )
    returning * into v_customer;
  end if;

  v_appointment_id := public.create_appointment_by_token(
    v_customer.token_acesso,
    p_service_id,
    p_professional_id,
    p_date,
    p_slot
  );

  return query
  select
    v_appointment_id,
    v_customer.id,
    v_customer.token_acesso,
    v_customer.name,
    v_customer.phone;
end;
$$;

revoke all on function public.confirm_public_booking(text, uuid, uuid, date, text, text, text, uuid) from public;
grant execute on function public.confirm_public_booking(text, uuid, uuid, date, text, text, text, uuid) to anon, authenticated, service_role;
