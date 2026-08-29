-- Migration 058: catálogo público independente de identidade de cliente

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
    AND s.is_active = true
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
  JOIN public.professional_services ps
    ON ps.tenant_id = p.tenant_id
   AND ps.professional_id = p.id
   AND ps.service_id = p_service_id
  WHERE lower(t.slug) = lower(btrim(p_slug))
    AND p.is_active = true
    AND p.deleted_at IS NULL
    AND ps.is_enabled = true
  ORDER BY p.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_professionals_by_public_slug(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_professionals_by_public_slug(TEXT, UUID) TO anon, authenticated, service_role;
