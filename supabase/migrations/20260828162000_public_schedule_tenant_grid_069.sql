-- Migration 069: usa a grade do tenant como origem e cruza a jornada do profissional

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
  v_day_bh_key TEXT;
  v_tenant_start_time TEXT;
  v_tenant_end_time TEXT;
  v_tenant_day_active BOOLEAN;
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

  SELECT
    CASE extract(dow FROM p_date)
      WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
    END,
    CASE extract(dow FROM p_date)
      WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda' WHEN 2 THEN 'terca'
      WHEN 3 THEN 'quarta' WHEN 4 THEN 'quinta' WHEN 5 THEN 'sexta'
      WHEN 6 THEN 'sabado'
    END
  INTO v_day_of_week, v_day_bh_key;

  SELECT
    COALESCE(
      t.business_hours -> v_day_of_week ->> 'start',
      t.business_hours -> v_day_bh_key ->> 'open',
      t.business_hours -> v_day_bh_key ->> 'start',
      '08:00'
    ),
    COALESCE(
      t.business_hours -> v_day_of_week ->> 'end',
      t.business_hours -> v_day_bh_key ->> 'close',
      t.business_hours -> v_day_bh_key ->> 'end',
      '20:00'
    ),
    COALESCE(
      (t.business_hours -> v_day_of_week ->> 'active')::BOOLEAN,
      (t.business_hours -> v_day_bh_key ->> 'active')::BOOLEAN,
      true
    )
  INTO v_tenant_start_time, v_tenant_end_time, v_tenant_day_active
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_tenant_day_active IS FALSE OR v_tenant_start_time IS NULL OR v_tenant_end_time IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(s.duration_minutes, 40)
  INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = p_tenant_id
    AND s.is_active IS TRUE
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
      COALESCE(
        (prof.weekly_schedule -> v_day_of_week ->> 'active')::BOOLEAN,
        (prof.weekly_schedule -> v_day_of_week ->> 'start') IS NOT NULL
          AND (prof.weekly_schedule -> v_day_of_week ->> 'end') IS NOT NULL
      )
    INTO v_duration, v_start_time, v_end_time, v_break_start, v_break_end, v_day_active
    FROM public.professionals prof
    JOIN public.professional_services ps
      ON ps.tenant_id = prof.tenant_id
     AND ps.professional_id = prof.id
     AND ps.service_id = p_service_id
     AND ps.is_enabled IS TRUE
    WHERE prof.id = p_professional_id
      AND prof.tenant_id = p_tenant_id
      AND prof.is_active IS TRUE
      AND prof.deleted_at IS NULL;

    IF v_start_time IS NULL OR v_end_time IS NULL OR v_day_active IS NOT TRUE THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT to_char(candidate.slot_start AT TIME ZONE v_timezone, 'HH24:MI')
    FROM generate_series(
      ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (v_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS candidate(slot_start)
    WHERE candidate.slot_start >= ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL <=
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL <=
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start >= now() + (v_min_booking_lead_time || ' minutes')::INTERVAL
      AND (
        v_break_start IS NULL OR v_break_end IS NULL OR NOT (
          candidate.slot_start < ((p_date::TEXT || ' ' || v_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL >
            ((p_date::TEXT || ' ' || v_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.professional_id = p_professional_id
          AND a.status <> 'canceled'
          AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
          AND a.start_time < candidate.slot_start + (v_duration || ' minutes')::INTERVAL
          AND a.end_time > candidate.slot_start
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
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
     AND ps.is_enabled IS TRUE
    WHERE prof.tenant_id = p_tenant_id
      AND prof.is_active IS TRUE
      AND prof.deleted_at IS NULL
      AND COALESCE(
        (prof.weekly_schedule -> v_day_of_week ->> 'active')::BOOLEAN,
        (prof.weekly_schedule -> v_day_of_week ->> 'start') IS NOT NULL
          AND (prof.weekly_schedule -> v_day_of_week ->> 'end') IS NOT NULL
      ) IS TRUE
      AND prof.weekly_schedule -> v_day_of_week ->> 'start' IS NOT NULL
      AND prof.weekly_schedule -> v_day_of_week ->> 'end' IS NOT NULL
  ), candidates AS (
    SELECT qp.*, generated.slot_start
    FROM qualified_professionals qp
    CROSS JOIN LATERAL generate_series(
      ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (qp.professional_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS generated(slot_start)
  )
  SELECT DISTINCT to_char(candidate.slot_start AT TIME ZONE v_timezone, 'HH24:MI')
  FROM candidates candidate
  WHERE candidate.slot_start >= ((p_date::TEXT || ' ' || candidate.professional_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL <=
      ((p_date::TEXT || ' ' || candidate.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL <=
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start >= now() + (v_min_booking_lead_time || ' minutes')::INTERVAL
    AND (
      candidate.professional_break_start IS NULL OR candidate.professional_break_end IS NULL OR NOT (
        candidate.slot_start < ((p_date::TEXT || ' ' || candidate.professional_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL >
          ((p_date::TEXT || ' ' || candidate.professional_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.professional_id = candidate.professional_id
        AND a.status <> 'canceled'
        AND (p_exclude_appointment_id IS NULL OR a.id <> p_exclude_appointment_id)
        AND a.start_time < candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL
        AND a.end_time > candidate.slot_start
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_slots b
      WHERE b.tenant_id = p_tenant_id
        AND (b.professional_id = candidate.professional_id OR b.professional_id IS NULL)
        AND b.start_time < candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL
        AND b.end_time > candidate.slot_start
    )
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(UUID, UUID, UUID, DATE, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_schedule_by_slug(
  p_slug TEXT,
  p_date DATE,
  p_service_id UUID,
  p_professional_id UUID DEFAULT NULL
)
RETURNS TABLE(slot_time TEXT, available BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_timezone TEXT;
  v_slot_interval INTEGER;
  v_duration INTEGER;
  v_day_of_week TEXT;
  v_day_bh_key TEXT;
  v_start_time TEXT;
  v_end_time TEXT;
  v_day_active BOOLEAN;
  v_available_slots TEXT[];
BEGIN
  SELECT t.id, COALESCE(t.timezone, 'America/Sao_Paulo'), COALESCE(t.slot_interval_minutes, 30)
  INTO v_tenant_id, v_timezone, v_slot_interval
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug))
    AND t.onboarding_completed IS TRUE;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.duration_minutes
  INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active IS TRUE
    AND s.deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  SELECT
    CASE extract(dow FROM p_date)
      WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday' WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
    END,
    CASE extract(dow FROM p_date)
      WHEN 0 THEN 'domingo' WHEN 1 THEN 'segunda' WHEN 2 THEN 'terca'
      WHEN 3 THEN 'quarta' WHEN 4 THEN 'quinta' WHEN 5 THEN 'sexta'
      WHEN 6 THEN 'sabado'
    END
  INTO v_day_of_week, v_day_bh_key;

  SELECT
    COALESCE(t.business_hours -> v_day_of_week ->> 'start', t.business_hours -> v_day_bh_key ->> 'open', t.business_hours -> v_day_bh_key ->> 'start', '08:00'),
    COALESCE(t.business_hours -> v_day_of_week ->> 'end', t.business_hours -> v_day_bh_key ->> 'close', t.business_hours -> v_day_bh_key ->> 'end', '20:00'),
    COALESCE((t.business_hours -> v_day_of_week ->> 'active')::BOOLEAN, (t.business_hours -> v_day_bh_key ->> 'active')::BOOLEAN, true)
  INTO v_start_time, v_end_time, v_day_active
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF v_day_active IS FALSE OR v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN;
  END IF;

  SELECT ARRAY(SELECT slots.slot_time FROM public.get_available_slots(v_tenant_id, p_professional_id, p_service_id, p_date, NULL::UUID) AS slots)
  INTO v_available_slots;

  RETURN QUERY
  SELECT
    to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI'),
    to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI') = ANY(v_available_slots)
  FROM generate_series(
    ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
    ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone - (v_duration || ' minutes')::INTERVAL,
    (v_slot_interval || ' minutes')::INTERVAL
  ) AS grid(slot_start)
  ORDER BY grid.slot_start;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_schedule_by_slug(TEXT, DATE, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_schedule_by_slug(TEXT, DATE, UUID, UUID) TO anon, authenticated, service_role;
