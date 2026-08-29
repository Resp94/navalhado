-- Migration 057: contexto público do tenant sem identidade de cliente
--
-- O contrato público resolve apenas os dados necessários para iniciar o
-- agendamento por slug. A criação ou reutilização de clientes deve ocorrer
-- somente na confirmação transacional do agendamento.

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
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.phone AS tenant_phone,
    t.slug AS tenant_slug,
    t.logo_url,
    COALESCE(t.timezone, 'America/Sao_Paulo') AS timezone,
    t.business_hours,
    COALESCE(t.slot_interval_minutes, 30)::INTEGER,
    COALESCE(t.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(t.min_cancellation_lead_time_minutes, 120)::INTEGER
  FROM public.tenants t
  WHERE lower(t.slug) = v_cleaned_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_tenant_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_slug(TEXT) TO anon, authenticated, service_role;
