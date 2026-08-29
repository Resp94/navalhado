-- Migration 068: restringe o canal público a tenants publicados e serviços ativos

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug(p_slug TEXT)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_slug TEXT,
  logo_url TEXT,
  timezone TEXT,
  business_hours JSONB,
  slot_interval_minutes INTEGER,
  min_booking_lead_time_minutes INTEGER,
  min_cancellation_lead_time_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cleaned_slug TEXT := lower(btrim(p_slug));
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.phone,
    t.slug,
    t.logo_url,
    COALESCE(t.timezone, 'America/Sao_Paulo'),
    t.business_hours,
    COALESCE(t.slot_interval_minutes, 30)::INTEGER,
    COALESCE(t.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(t.min_cancellation_lead_time_minutes, 120)::INTEGER
  FROM public.tenants t
  WHERE lower(t.slug) = v_cleaned_slug
    AND t.onboarding_completed IS TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_tenant_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_slug(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_services_by_public_slug(p_slug TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  duration_minutes INTEGER,
  category TEXT,
  is_active BOOLEAN,
  display_order INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    s.id,
    s.name,
    s.description,
    s.price,
    s.duration_minutes,
    s.category,
    s.is_active,
    s.display_order
  FROM public.services s
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE lower(t.slug) = lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE
    AND s.is_active IS TRUE
    AND s.deleted_at IS NULL
  ORDER BY s.display_order ASC, s.created_at ASC, s.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_services_by_public_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_services_by_public_slug(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_professionals_by_public_slug(
  p_slug TEXT,
  p_service_id UUID
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  phone TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.name,
    p.phone,
    p.is_active
  FROM public.professionals p
  JOIN public.tenants t ON t.id = p.tenant_id
  JOIN public.services s
    ON s.tenant_id = p.tenant_id
   AND s.id = p_service_id
  JOIN public.professional_services ps
    ON ps.tenant_id = p.tenant_id
   AND ps.professional_id = p.id
   AND ps.service_id = s.id
  WHERE lower(t.slug) = lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE
    AND s.is_active IS TRUE
    AND s.deleted_at IS NULL
    AND p.is_active IS TRUE
    AND p.deleted_at IS NULL
    AND ps.is_enabled IS TRUE
  ORDER BY p.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_professionals_by_public_slug(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_professionals_by_public_slug(TEXT, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_public_booking(
  p_slug TEXT,
  p_service_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_slot TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_token UUID
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
  WHERE lower(t.slug) = lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF p_token IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.token_acesso = p_token
      AND c.tenant_id = v_tenant_id
      AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now())
  ) THEN
    RAISE EXCEPTION 'Token inválido para este estabelecimento.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::TEXT || ':' || v_phone, 0));

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
    INSERT INTO public.customers(tenant_id, name, phone, cadastro_completo, registration_origin)
    VALUES(v_tenant_id, left(v_name, 100), v_phone, true, 'canal_cliente')
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
  SELECT v_appointment_id, v_customer.id, v_customer.token_acesso, v_customer.name, v_customer.phone;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_public_booking(TEXT, UUID, UUID, DATE, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_public_booking(TEXT, UUID, UUID, DATE, TEXT, TEXT, TEXT, UUID) TO anon, authenticated, service_role;
