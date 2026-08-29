-- Migration 060: confirmação pública transacional

CREATE OR REPLACE FUNCTION public.confirm_public_booking(
  p_slug TEXT,
  p_service_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_slot TEXT,
  p_name TEXT,
  p_phone TEXT
)
RETURNS TABLE(
  appointment_id UUID,
  customer_id UUID,
  token_acesso UUID,
  customer_name TEXT,
  customer_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_customer public.customers%ROWTYPE;
  v_phone TEXT;
  v_name TEXT := btrim(p_name);
  v_appointment_id UUID;
BEGIN
  IF v_name IS NULL OR array_length(regexp_split_to_array(v_name, '\s+'), 1) < 2 THEN
    RAISE EXCEPTION 'Informe nome e sobrenome completos.' USING ERRCODE = '22023';
  END IF;

  v_phone := private.normalize_br_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido com DDD.' USING ERRCODE = '22023';
  END IF;

  SELECT t.id
  INTO v_tenant_id
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug));

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_tenant_id::TEXT || ':' || v_phone, 0)
  );

  SELECT c.*
  INTO v_customer
  FROM public.customers c
  WHERE c.tenant_id = v_tenant_id
    AND c.telefone_normalizado = v_phone;

  IF FOUND THEN
    IF v_customer.cadastro_completo IS FALSE THEN
      UPDATE public.customers
      SET name = left(v_name, 100),
          phone = v_phone,
          cadastro_completo = true,
          registration_origin = 'canal_cliente',
          updated_at = timezone('utc'::TEXT, now())
      WHERE id = v_customer.id
      RETURNING * INTO v_customer;
    END IF;
  ELSE
    INSERT INTO public.customers(
      tenant_id,
      name,
      phone,
      cadastro_completo,
      registration_origin
    )
    VALUES(
      v_tenant_id,
      left(v_name, 100),
      v_phone,
      true,
      'canal_cliente'
    )
    RETURNING * INTO v_customer;
  END IF;

  v_appointment_id := public.create_appointment_by_token(
    v_customer.token_acesso,
    p_service_id,
    p_professional_id,
    p_date,
    p_slot
  );

  RETURN QUERY
  SELECT
    v_appointment_id,
    v_customer.id,
    v_customer.token_acesso,
    v_customer.name,
    v_customer.phone;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_public_booking(TEXT, UUID, UUID, DATE, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_public_booking(TEXT, UUID, UUID, DATE, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
