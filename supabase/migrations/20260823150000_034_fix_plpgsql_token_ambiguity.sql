-- =============================================================================
-- Migration 034: Corrigir ambiguidade de coluna PL/pgSQL em get_or_create_provisional_customer_by_slug
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_provisional_customer_by_slug(
  p_slug TEXT,
  p_existing_token UUID DEFAULT NULL
)
RETURNS TABLE(
  token_acesso UUID,
  customer_id UUID,
  customer_name TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_slug TEXT,
  cadastro_completo BOOLEAN,
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
  v_tenant RECORD;
  v_cust public.customers%ROWTYPE;
BEGIN
  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- Se fornecido token existente, tenta reaproveitar o cliente daquele tenant se não expirado
  IF p_existing_token IS NOT NULL THEN
    SELECT * INTO v_cust
    FROM public.customers c
    WHERE c.token_acesso = p_existing_token
      AND c.tenant_id = v_tenant.id
      AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now());

    IF FOUND THEN
      RETURN QUERY
      SELECT 
        v_cust.token_acesso,
        v_cust.id AS customer_id,
        v_cust.name AS customer_name,
        v_tenant.id AS tenant_id,
        v_tenant.name AS tenant_name,
        v_tenant.phone AS tenant_phone,
        v_tenant.slug AS tenant_slug,
        v_cust.cadastro_completo,
        v_tenant.logo_url,
        COALESCE(v_tenant.timezone, 'America/Sao_Paulo') AS timezone,
        v_tenant.business_hours,
        COALESCE(v_tenant.slot_interval_minutes, 30)::INTEGER,
        COALESCE(v_tenant.min_booking_lead_time_minutes, 15)::INTEGER,
        COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::INTEGER;
      RETURN;
    END IF;
  END IF;

  -- Caso contrário, criar novo cliente provisório para a barbearia
  INSERT INTO public.customers (tenant_id, name, cadastro_completo)
  VALUES (v_tenant.id, 'Cliente', false)
  RETURNING * INTO v_cust;

  RETURN QUERY
  SELECT 
    v_cust.token_acesso,
    v_cust.id AS customer_id,
    v_cust.name AS customer_name,
    v_tenant.id AS tenant_id,
    v_tenant.name AS tenant_name,
    v_tenant.phone AS tenant_phone,
    v_tenant.slug AS tenant_slug,
    v_cust.cadastro_completo,
    v_tenant.logo_url,
    COALESCE(v_tenant.timezone, 'America/Sao_Paulo') AS timezone,
    v_tenant.business_hours,
    COALESCE(v_tenant.slot_interval_minutes, 30)::INTEGER,
    COALESCE(v_tenant.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::INTEGER;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT, UUID) TO anon, authenticated, service_role;
