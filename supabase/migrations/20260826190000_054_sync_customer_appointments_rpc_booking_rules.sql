-- =============================================================================
-- Migration 054: Sincronizar RPC get_customer_appointments_by_token e hardening de search_path
-- =============================================================================

-- 1. Garantir que get_customer_appointments_by_token retorne todas as colunas de regras de agendamento
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
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Validar token e capturar customer_id
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.token_acesso = p_token 
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em > now());

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Token inválido ou expirado.' USING errcode = 'P0002';
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
$$;

REVOKE ALL ON FUNCTION public.get_customer_appointments_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_appointments_by_token(uuid) TO anon, authenticated, service_role;

-- 2. Hardening de search_path na trigger fn_auto_create_comanda_for_appointment
CREATE OR REPLACE FUNCTION public.fn_auto_create_comanda_for_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comanda_id UUID;
  v_service_price NUMERIC(10,2) := 0;
BEGIN
  -- Se já existir uma comanda vinculada a este appointment, não duplica
  IF EXISTS (SELECT 1 FROM public.comandas WHERE appointment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Obter preço do serviço cadastrado
  SELECT price INTO v_service_price FROM public.services WHERE id = NEW.service_id;
  IF v_service_price IS NULL THEN
    v_service_price := 0;
  END IF;

  -- Criar a comanda com status 'aberta' (customer_id pode ser NULL)
  INSERT INTO public.comandas (
    tenant_id,
    appointment_id,
    customer_id,
    status,
    total_amount,
    discount_amount,
    tip_amount,
    created_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.customer_id,
    CASE WHEN NEW.payment_status = 'paid' OR NEW.status = 'completed' THEN 'fechada' ELSE 'aberta' END,
    v_service_price,
    0,
    0,
    COALESCE(NEW.created_at, timezone('utc'::text, now()))
  ) RETURNING id INTO v_comanda_id;

  -- Inserir o serviço como primeiro item da comanda
  IF NEW.service_id IS NOT NULL THEN
    INSERT INTO public.comanda_itens (
      comanda_id,
      tenant_id,
      item_type,
      service_id,
      professional_id,
      quantity,
      unit_price,
      total_price,
      created_at
    ) VALUES (
      v_comanda_id,
      NEW.tenant_id,
      'servico',
      NEW.service_id,
      NEW.professional_id,
      1,
      v_service_price,
      v_service_price,
      COALESCE(NEW.created_at, timezone('utc'::text, now()))
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_auto_create_comanda_for_appointment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_auto_create_comanda_for_appointment() TO authenticated, service_role;
