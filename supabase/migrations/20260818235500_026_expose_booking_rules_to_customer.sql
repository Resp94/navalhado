-- =============================================================================
-- Migration: 026_expose_booking_rules_to_customer
-- Descrição: Expor regras de agendamento (antecedência para cancelar, agendar e intervalo),
--            fuso horário e horários de funcionamento nas RPCs get_customer_details_by_token
--            e get_customer_appointments_by_token
-- =============================================================================

-- 1. get_customer_details_by_token com regras de agendamento e business_hours
DROP FUNCTION IF EXISTS public.get_customer_details_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_customer_details_by_token(p_token uuid)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  cadastro_completo boolean,
  min_cancellation_lead_time_minutes integer,
  min_booking_lead_time_minutes integer,
  slot_interval_minutes integer,
  tenant_timezone text,
  business_hours jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT c.id, c.name, c.tenant_id, t.name AS tenant_name,
         t.phone AS tenant_phone, c.cadastro_completo, c.token_expirado_em,
         t.min_cancellation_lead_time_minutes, t.min_booking_lead_time_minutes, t.slot_interval_minutes,
         COALESCE(t.timezone, 'America/Sao_Paulo') AS timezone,
         t.business_hours
  INTO v_row
  FROM public.customers c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE c.token_acesso = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_INVALID' USING errcode = 'P0002';
  END IF;

  IF v_row.token_expirado_em IS NOT NULL AND v_row.token_expirado_em < now() THEN
    RAISE EXCEPTION 'TOKEN_EXPIRED' USING errcode = '22023';
  END IF;

  RETURN QUERY SELECT 
    v_row.id, 
    v_row.name, 
    v_row.tenant_id,
    v_row.tenant_name, 
    v_row.tenant_phone, 
    v_row.cadastro_completo,
    COALESCE(v_row.min_cancellation_lead_time_minutes, 120)::integer,
    COALESCE(v_row.min_booking_lead_time_minutes, 15)::integer,
    COALESCE(v_row.slot_interval_minutes, 30)::integer,
    v_row.timezone::text,
    v_row.business_hours::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_details_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_details_by_token(uuid) TO anon, authenticated, service_role;

-- 2. get_customer_appointments_by_token com regras de agendamento
DROP FUNCTION IF EXISTS public.get_customer_appointments_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_customer_appointments_by_token(p_token uuid)
RETURNS TABLE(
  appointment_id uuid,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status text,
  payment_status text,
  cancellation_reason text,
  professional_name text,
  professional_id uuid,
  professional_phone text,
  service_name text,
  service_id uuid,
  service_price numeric,
  service_duration integer,
  tenant_name text,
  tenant_id uuid,
  tenant_phone text,
  customer_name text,
  min_cancellation_lead_time_minutes integer,
  min_booking_lead_time_minutes integer,
  slot_interval_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Validar token e capturar customer_id
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.token_acesso = p_token 
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em > now());

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Token inválido ou expirado.';
  END IF;

  RETURN QUERY
  SELECT 
    a.id AS appointment_id,
    a.start_time,
    a.end_time,
    a.status,
    a.payment_status,
    a.cancellation_reason,
    p.name AS professional_name,
    p.id AS professional_id,
    p.phone AS professional_phone,
    s.name AS service_name,
    s.id AS service_id,
    s.price AS service_price,
    s.duration_minutes AS service_duration,
    t.name AS tenant_name,
    t.id AS tenant_id,
    t.phone AS tenant_phone,
    c.name AS customer_name,
    COALESCE(t.min_cancellation_lead_time_minutes, 120)::integer AS min_cancellation_lead_time_minutes,
    COALESCE(t.min_booking_lead_time_minutes, 15)::integer AS min_booking_lead_time_minutes,
    COALESCE(t.slot_interval_minutes, 30)::integer AS slot_interval_minutes
  FROM public.appointments a
  JOIN public.customers c ON a.customer_id = c.id
  JOIN public.professionals p ON p.id = a.professional_id
  JOIN public.services s ON s.id = a.service_id
  JOIN public.tenants t ON t.id = a.tenant_id
  WHERE a.customer_id = v_customer_id
  ORDER BY a.start_time DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_appointments_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_appointments_by_token(uuid) TO anon, authenticated, service_role;
