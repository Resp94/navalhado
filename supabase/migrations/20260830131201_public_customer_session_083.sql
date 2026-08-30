-- Spec 024: resolve public customer identity without creating provisional customers.
-- No access token is returned from this public lookup. The authoritative booking
-- confirmation remains responsible for creating/updating the customer session.
CREATE OR REPLACE FUNCTION public.resolve_public_customer_identity(
  p_slug TEXT,
  p_name TEXT,
  p_phone TEXT
)
RETURNS TABLE (
  found BOOLEAN,
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  cadastro_completo BOOLEAN,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_tenant_phone TEXT;
  v_tenant_slug TEXT;
  v_customer public.customers%ROWTYPE;
  v_name TEXT := btrim(p_name);
  v_phone TEXT;
BEGIN
  IF v_name IS NULL OR array_length(regexp_split_to_array(v_name, '\\s+'), 1) < 2 THEN
    RAISE EXCEPTION 'Informe nome e sobrenome completos.' USING ERRCODE = '22023';
  END IF;

  v_phone := private.normalize_br_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido com DDD.' USING ERRCODE = '22023';
  END IF;

  SELECT t.id, t.name, t.phone, t.slug
  INTO v_tenant_id, v_tenant_name, v_tenant_phone, v_tenant_slug
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.*
  INTO v_customer
  FROM public.customers c
  WHERE c.tenant_id = v_tenant_id
    AND c.telefone_normalizado = v_phone
    AND c.cadastro_completo IS TRUE
    AND c.name IS NOT NULL
    AND lower(btrim(c.name)) = lower(v_name)
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      TRUE,
      v_customer.id,
      v_customer.name,
      v_customer.phone,
      v_customer.cadastro_completo,
      v_tenant_id,
      v_tenant_name,
      v_tenant_phone,
      v_tenant_slug;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    FALSE,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    FALSE,
    v_tenant_id,
    v_tenant_name,
    v_tenant_phone,
    v_tenant_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_public_customer_identity(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_customer_identity(TEXT, TEXT, TEXT) TO anon, authenticated;
