-- Migration 061: disponibilidade pública restrita à agenda real do profissional

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_tenant_id UUID,
  p_professional_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE(slot_time TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone TEXT;
  v_slot_interval INTEGER;
  v_min_booking_lead_time INTEGER;
  v_duration INTEGER;
  v_day_of_week TEXT;
  v_start_time TEXT;
  v_end_time TEXT;
  v_break_start TEXT;
  v_break_end TEXT;
  v_day_active BOOLEAN;
BEGIN
  SELECT
    COALESCE(t.timezone, 'America/Sao_Paulo'),
    COALESCE(t.slot_interval_minutes, 30),
    COALESCE(t.min_booking_lead_time_minutes, 15)
  INTO v_timezone, v_slot_interval, v_min_booking_lead_time
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_timezone IS NULL THEN
    RETURN;
  END IF;

  SELECT CASE extract(dow FROM p_date)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END INTO v_day_of_week;

  SELECT COALESCE(s.duration_minutes, 40)
  INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = p_tenant_id
    AND s.is_active = true
    AND s.deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  IF p_professional_id IS NOT NULL THEN
    SELECT
      COALESCE(ps.custom_duration_minutes, v_duration),
      prof.weekly_schedule -> v_day_of_week ->> 'start',
      prof.weekly_schedule -> v_day_of_week ->> 'end',
      prof.weekly_schedule -> v_day_of_week ->> 'break_start',
      prof.weekly_schedule -> v_day_of_week ->> 'break_end',
      COALESCE((prof.weekly_schedule -> v_day_of_week ->> 'active')::BOOLEAN, false)
    INTO v_duration, v_start_time, v_end_time, v_break_start, v_break_end, v_day_active
    FROM public.professionals prof
    JOIN public.professional_services ps
      ON ps.tenant_id = prof.tenant_id
     AND ps.professional_id = prof.id
     AND ps.service_id = p_service_id
     AND ps.is_enabled = true
    WHERE prof.id = p_professional_id
      AND prof.tenant_id = p_tenant_id
      AND prof.is_active = true
      AND prof.deleted_at IS NULL;

    IF v_start_time IS NULL OR v_end_time IS NULL OR v_day_active IS NOT TRUE THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT to_char(candidate.slot_start AT TIME ZONE v_timezone, 'HH24:MI')
    FROM generate_series(
      ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (v_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS candidate(slot_start)
    WHERE candidate.slot_start + (v_duration || ' minutes')::INTERVAL <=
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start >= now() + (v_min_booking_lead_time || ' minutes')::INTERVAL
      AND (
        v_break_start IS NULL OR v_break_end IS NULL OR NOT (
          candidate.slot_start < ((p_date::TEXT || ' ' || v_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL >
            ((p_date::TEXT || ' ' || v_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE a.professional_id = p_professional_id
          AND a.status <> 'canceled'
          AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
          AND a.start_time < candidate.slot_start + (v_duration || ' minutes')::INTERVAL
          AND a.end_time > candidate.slot_start
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.blocked_slots b
        WHERE b.tenant_id = p_tenant_id
          AND (b.professional_id = p_professional_id OR b.professional_id IS NULL)
          AND b.start_time < candidate.slot_start + (v_duration || ' minutes')::INTERVAL
          AND b.end_time > candidate.slot_start
      )
    ORDER BY 1;
    RETURN;
  END IF;

  RETURN QUERY
  WITH qualified_professionals AS (
    SELECT
      prof.id AS professional_id,
      COALESCE(ps.custom_duration_minutes, v_duration) AS professional_duration,
      prof.weekly_schedule -> v_day_of_week ->> 'start' AS professional_start,
      prof.weekly_schedule -> v_day_of_week ->> 'end' AS professional_end,
      prof.weekly_schedule -> v_day_of_week ->> 'break_start' AS professional_break_start,
      prof.weekly_schedule -> v_day_of_week ->> 'break_end' AS professional_break_end
    FROM public.professionals prof
    JOIN public.professional_services ps
      ON ps.tenant_id = prof.tenant_id
     AND ps.professional_id = prof.id
     AND ps.service_id = p_service_id
     AND ps.is_enabled = true
    WHERE prof.tenant_id = p_tenant_id
      AND prof.is_active = true
      AND prof.deleted_at IS NULL
      AND COALESCE((prof.weekly_schedule -> v_day_of_week ->> 'active')::BOOLEAN, false) IS TRUE
      AND prof.weekly_schedule -> v_day_of_week ->> 'start' IS NOT NULL
      AND prof.weekly_schedule -> v_day_of_week ->> 'end' IS NOT NULL
  ), candidates AS (
    SELECT
      qp.professional_id,
      gs AS slot_start,
      qp.professional_duration,
      qp.professional_end,
      qp.professional_break_start,
      qp.professional_break_end
    FROM qualified_professionals qp
    CROSS JOIN LATERAL generate_series(
      ((p_date::TEXT || ' ' || qp.professional_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || qp.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (qp.professional_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS gs
  )
  SELECT DISTINCT to_char(candidate.slot_start AT TIME ZONE v_timezone, 'HH24:MI')
  FROM candidates candidate
  WHERE candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL <=
      ((p_date::TEXT || ' ' || candidate.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start >= now() + (v_min_booking_lead_time || ' minutes')::INTERVAL
    AND (
      candidate.professional_break_start IS NULL OR candidate.professional_break_end IS NULL OR NOT (
        candidate.slot_start < ((p_date::TEXT || ' ' || candidate.professional_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL >
          ((p_date::TEXT || ' ' || candidate.professional_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.professional_id = candidate.professional_id
        AND a.status <> 'canceled'
        AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
        AND a.start_time < candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL
        AND a.end_time > candidate.slot_start
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.blocked_slots b
      WHERE b.tenant_id = p_tenant_id
        AND (b.professional_id = candidate.professional_id OR b.professional_id IS NULL)
        AND b.start_time < candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL
        AND b.end_time > candidate.slot_start
    )
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_appointment_by_token(
  p_token UUID,
  p_service_id UUID,
  p_professional_id UUID,
  p_date DATE,
  p_slot TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id UUID;
  v_tenant_id UUID;
  v_timezone TEXT;
  v_min_booking_lead_time INTEGER;
  v_duration INTEGER;
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_final_professional_id UUID;
  v_appointment_id UUID;
BEGIN
  SELECT c.id, c.tenant_id
  INTO v_customer_id, v_tenant_id
  FROM public.customers c
  WHERE c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now());

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
  END IF;

  SELECT COALESCE(t.timezone, 'America/Sao_Paulo'), COALESCE(t.min_booking_lead_time_minutes, 15)
  INTO v_timezone, v_min_booking_lead_time
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  v_start_time := ((p_date::TEXT || ' ' || p_slot || ':00')::TIMESTAMP) AT TIME ZONE v_timezone;
  IF v_start_time < now() + (v_min_booking_lead_time || ' minutes')::INTERVAL THEN
    RAISE EXCEPTION 'Este horário não está mais disponível com a antecedência mínima necessária (% minutos).', v_min_booking_lead_time USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(s.duration_minutes, 40)
  INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'Serviço indisponível ou inexistente.';
  END IF;

  IF p_professional_id IS NULL THEN
    SELECT candidate.professional_id
    INTO v_final_professional_id
    FROM (
      SELECT prof.id AS professional_id
      FROM public.professionals prof
      JOIN public.professional_services ps
        ON ps.tenant_id = v_tenant_id
       AND ps.professional_id = prof.id
       AND ps.service_id = p_service_id
       AND ps.is_enabled = true
      WHERE prof.tenant_id = v_tenant_id
        AND prof.is_active = true
        AND prof.deleted_at IS NULL
      ORDER BY prof.name, prof.id
    ) candidate
    WHERE EXISTS (
      SELECT 1
      FROM public.get_available_slots(v_tenant_id, candidate.professional_id, p_service_id, p_date, NULL) available
      WHERE available.slot_time = p_slot
    )
    LIMIT 1;

    IF v_final_professional_id IS NULL THEN
      RAISE EXCEPTION 'Não há profissionais disponíveis para este horário. Por favor, escolha outro.';
    END IF;
  ELSE
    v_final_professional_id := p_professional_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_final_professional_id::TEXT || ':' || v_start_time::TEXT, 0));

  IF NOT EXISTS (
    SELECT 1
    FROM public.get_available_slots(v_tenant_id, v_final_professional_id, p_service_id, p_date, NULL) available
    WHERE available.slot_time = p_slot
  ) THEN
    RAISE EXCEPTION 'O horário selecionado acabou de ser reservado ou não está disponível.' USING ERRCODE = '23P01';
  END IF;

  SELECT COALESCE(ps.custom_duration_minutes, s.duration_minutes, 40)
  INTO v_duration
  FROM public.services s
  JOIN public.professional_services ps
    ON ps.tenant_id = v_tenant_id
   AND ps.professional_id = v_final_professional_id
   AND ps.service_id = s.id
   AND ps.is_enabled = true
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.deleted_at IS NULL;

  v_end_time := v_start_time + (v_duration || ' minutes')::INTERVAL;

  INSERT INTO public.appointments(
    tenant_id, customer_id, professional_id, service_id, start_time, end_time,
    status, payment_status, origin, notes
  ) VALUES (
    v_tenant_id, v_customer_id, v_final_professional_id, p_service_id, v_start_time, v_end_time,
    'confirmed', 'pending', 'online', 'Agendamento realizado pelo canal do cliente'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_appointment_by_token(UUID, UUID, UUID, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_by_token(UUID, UUID, UUID, DATE, TEXT) TO anon, authenticated, service_role;
