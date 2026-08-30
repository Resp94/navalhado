-- Spec 024: sessão pública baseada no Supabase Auth anônimo.
-- O auth_user_id é a identidade autorizadora; nenhum token de cliente é retornado.
CREATE TABLE IF NOT EXISTS public.public_customer_sessions (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_public_customer_sessions_customer
  ON public.public_customer_sessions (customer_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_customer_sessions_expiry
  ON public.public_customer_sessions (expires_at);

ALTER TABLE public.public_customer_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_customer_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_public_customer_session(
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
  tenant_slug TEXT,
  tenant_timezone TEXT,
  business_hours JSONB,
  min_cancellation_lead_time_minutes INTEGER,
  min_booking_lead_time_minutes INTEGER,
  slot_interval_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_user_id UUID := (SELECT auth.uid());
  v_tenant public.tenants%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_name TEXT := btrim(p_name);
  v_phone TEXT;
BEGIN
  IF v_auth_user_id IS NULL OR COALESCE(((SELECT auth.jwt())->>'is_anonymous')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão pública anônima obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF v_name IS NULL OR array_length(regexp_split_to_array(v_name, E'\\s+'), 1) < 2 THEN
    RAISE EXCEPTION 'Informe nome e sobrenome completos.' USING ERRCODE = '22023';
  END IF;

  v_phone := private.normalize_br_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido com DDD.' USING ERRCODE = '22023';
  END IF;

  SELECT t.* INTO v_tenant
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE;

  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  SELECT c.* INTO v_customer
  FROM public.customers c
  WHERE c.tenant_id = v_tenant.id
    AND c.telefone_normalizado = v_phone
    AND c.cadastro_completo IS TRUE
    AND c.name IS NOT NULL
    AND lower(btrim(c.name)) = lower(v_name)
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  IF v_customer.id IS NULL THEN
    RETURN QUERY SELECT
      FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, FALSE,
      v_tenant.id, v_tenant.name, v_tenant.phone, v_tenant.slug,
      COALESCE(v_tenant.timezone, 'America/Sao_Paulo'), v_tenant.business_hours,
      COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::INTEGER,
      COALESCE(v_tenant.min_booking_lead_time_minutes, 15)::INTEGER,
      COALESCE(v_tenant.slot_interval_minutes, 30)::INTEGER;
    RETURN;
  END IF;

  INSERT INTO public.public_customer_sessions (auth_user_id, tenant_id, customer_id)
  VALUES (v_auth_user_id, v_tenant.id, v_customer.id)
  ON CONFLICT (auth_user_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    customer_id = EXCLUDED.customer_id,
    last_seen_at = now(),
    expires_at = now() + INTERVAL '7 days';

  RETURN QUERY SELECT
    TRUE, v_customer.id, v_customer.name, v_customer.phone, v_customer.cadastro_completo,
    v_tenant.id, v_tenant.name, v_tenant.phone, v_tenant.slug,
    COALESCE(v_tenant.timezone, 'America/Sao_Paulo'), v_tenant.business_hours,
    COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::INTEGER,
    COALESCE(v_tenant.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(v_tenant.slot_interval_minutes, 30)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_customer_session()
RETURNS TABLE (
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_slug TEXT,
  cadastro_completo BOOLEAN,
  tenant_timezone TEXT,
  business_hours JSONB,
  min_cancellation_lead_time_minutes INTEGER,
  min_booking_lead_time_minutes INTEGER,
  slot_interval_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_user_id UUID := (SELECT auth.uid());
BEGIN
  IF v_auth_user_id IS NULL OR COALESCE(((SELECT auth.jwt())->>'is_anonymous')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RETURN;
  END IF;

  UPDATE public.public_customer_sessions
  SET last_seen_at = now()
  WHERE auth_user_id = v_auth_user_id
    AND expires_at > now();

  RETURN QUERY SELECT
    c.id, c.name, c.phone, t.id, t.name, t.phone, t.slug, c.cadastro_completo,
    COALESCE(t.timezone, 'America/Sao_Paulo'), t.business_hours,
    COALESCE(t.min_cancellation_lead_time_minutes, 120)::INTEGER,
    COALESCE(t.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(t.slot_interval_minutes, 30)::INTEGER
  FROM public.public_customer_sessions s
  JOIN public.customers c ON c.id = s.customer_id
  JOIN public.tenants t ON t.id = s.tenant_id
  WHERE s.auth_user_id = v_auth_user_id
    AND s.expires_at > now()
    AND c.cadastro_completo IS TRUE
    AND t.onboarding_completed IS TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_customer_appointments()
RETURNS TABLE (
  appointment_id UUID,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  payment_status TEXT,
  cancellation_reason TEXT,
  professional_name TEXT,
  professional_id UUID,
  professional_phone TEXT,
  service_name TEXT,
  service_id UUID,
  service_price NUMERIC,
  service_duration INTEGER,
  tenant_name TEXT,
  tenant_id UUID,
  tenant_phone TEXT,
  customer_name TEXT,
  min_cancellation_lead_time_minutes INTEGER,
  min_booking_lead_time_minutes INTEGER,
  slot_interval_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_user_id UUID := (SELECT auth.uid());
  v_customer_id UUID;
  v_tenant_id UUID;
BEGIN
  SELECT s.customer_id, s.tenant_id INTO v_customer_id, v_tenant_id
  FROM public.public_customer_sessions s
  WHERE s.auth_user_id = v_auth_user_id
    AND s.expires_at > now();

  IF v_customer_id IS NULL OR COALESCE(((SELECT auth.jwt())->>'is_anonymous')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão pública inválida ou expirada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.public_customer_sessions SET last_seen_at = now()
  WHERE auth_user_id = v_auth_user_id;

  RETURN QUERY SELECT
    a.id, a.start_time, a.end_time, a.status, a.payment_status, a.cancellation_reason,
    p.name, p.id, p.phone, s.name, s.id, s.price, s.duration_minutes,
    t.name, t.id, t.phone, c.name,
    COALESCE(t.min_cancellation_lead_time_minutes, 120)::INTEGER,
    COALESCE(t.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(t.slot_interval_minutes, 30)::INTEGER
  FROM public.appointments a
  JOIN public.customers c ON c.id = a.customer_id
  JOIN public.professionals p ON p.id = a.professional_id
  JOIN public.services s ON s.id = a.service_id
  JOIN public.tenants t ON t.id = a.tenant_id
  WHERE a.customer_id = v_customer_id AND a.tenant_id = v_tenant_id
  ORDER BY a.start_time DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_public_session(
  p_appointment_id UUID,
  p_reason TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_user_id UUID := (SELECT auth.uid());
  v_customer_id UUID;
  v_tenant_id UUID;
  v_start_time TIMESTAMPTZ;
  v_min_cancellation_lead_time INTEGER;
BEGIN
  SELECT s.customer_id, s.tenant_id INTO v_customer_id, v_tenant_id
  FROM public.public_customer_sessions s
  WHERE s.auth_user_id = v_auth_user_id AND s.expires_at > now();

  IF v_customer_id IS NULL OR COALESCE(((SELECT auth.jwt())->>'is_anonymous')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão pública inválida ou expirada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT a.start_time INTO v_start_time FROM public.appointments a
  WHERE a.id = p_appointment_id AND a.customer_id = v_customer_id AND a.tenant_id = v_tenant_id;

  IF v_start_time IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou não pertence a este cliente.';
  END IF;
  IF v_start_time <= now() THEN
    RAISE EXCEPTION 'Não é possível cancelar um agendamento que já ocorreu ou está em andamento.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(t.min_cancellation_lead_time_minutes, 120) INTO v_min_cancellation_lead_time
  FROM public.tenants t WHERE t.id = v_tenant_id;
  IF v_start_time < now() + (v_min_cancellation_lead_time || ' minutes')::INTERVAL THEN
    RAISE EXCEPTION 'APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED: O prazo para cancelamento online expirou (% minutos de antecedência mínima). Entre em contato diretamente com o profissional.', v_min_cancellation_lead_time USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments SET status = 'canceled', cancellation_reason = p_reason, updated_at = now()
  WHERE id = p_appointment_id AND customer_id = v_customer_id AND tenant_id = v_tenant_id;
  UPDATE public.public_customer_sessions SET last_seen_at = now() WHERE auth_user_id = v_auth_user_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_public_session(
  p_appointment_id UUID,
  p_new_service_id UUID,
  p_new_professional_id UUID,
  p_new_date DATE,
  p_new_slot TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_auth_user_id UUID := (SELECT auth.uid());
  v_customer_id UUID;
  v_token UUID;
BEGIN
  SELECT s.customer_id, c.token_acesso INTO v_customer_id, v_token
  FROM public.public_customer_sessions s
  JOIN public.customers c ON c.id = s.customer_id AND c.tenant_id = s.tenant_id
  WHERE s.auth_user_id = v_auth_user_id AND s.expires_at > now()
    AND c.cadastro_completo IS TRUE;

  IF v_customer_id IS NULL OR v_token IS NULL OR COALESCE(((SELECT auth.jwt())->>'is_anonymous')::BOOLEAN, FALSE) IS NOT TRUE THEN
    RAISE EXCEPTION 'Sessão pública inválida ou expirada.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.public_customer_sessions SET last_seen_at = now() WHERE auth_user_id = v_auth_user_id;
  RETURN public.reschedule_appointment_by_token(v_token, p_appointment_id, p_new_service_id, p_new_professional_id, p_new_date, p_new_slot);
END;
$$;

REVOKE ALL ON FUNCTION public.start_public_customer_session(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_customer_session() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_public_customer_appointments() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_appointment_by_public_session(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reschedule_appointment_by_public_session(UUID, UUID, UUID, DATE, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_public_customer_session(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_customer_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_customer_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_public_session(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_public_session(UUID, UUID, UUID, DATE, TEXT) TO authenticated;
