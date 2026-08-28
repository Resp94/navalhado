-- Migration 067: alinha a grade pública à agenda real dos profissionais

CREATE OR REPLACE FUNCTION public.get_public_schedule_by_slug(
  p_slug TEXT,
  p_date DATE,
  p_service_id UUID,
  p_professional_id UUID DEFAULT NULL
)
RETURNS TABLE(
  slot_time TEXT,
  available BOOLEAN
)
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
  SELECT
    t.id,
    COALESCE(t.timezone, 'America/Sao_Paulo'),
    COALESCE(t.slot_interval_minutes, 30)
  INTO v_tenant_id, v_timezone, v_slot_interval
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug));

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.duration_minutes
  INTO v_duration
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.tenant_id = v_tenant_id
    AND s.is_active = true
    AND s.deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  SELECT
    CASE extract(dow FROM p_date)
      WHEN 0 THEN 'sunday'
      WHEN 1 THEN 'monday'
      WHEN 2 THEN 'tuesday'
      WHEN 3 THEN 'wednesday'
      WHEN 4 THEN 'thursday'
      WHEN 5 THEN 'friday'
      WHEN 6 THEN 'saturday'
    END,
    CASE extract(dow FROM p_date)
      WHEN 0 THEN 'domingo'
      WHEN 1 THEN 'segunda'
      WHEN 2 THEN 'terca'
      WHEN 3 THEN 'quarta'
      WHEN 4 THEN 'quinta'
      WHEN 5 THEN 'sexta'
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
  INTO v_start_time, v_end_time, v_day_active
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  IF v_day_active IS FALSE OR v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN;
  END IF;

  SELECT ARRAY(
    SELECT slots.slot_time
    FROM public.get_available_slots(
      v_tenant_id,
      p_professional_id,
      p_service_id,
      p_date,
      NULL::UUID
    ) AS slots
  )
  INTO v_available_slots;

  RETURN QUERY
  WITH qualified_professionals AS (
    SELECT
      prof.id AS professional_id,
      COALESCE(ps.custom_duration_minutes, v_duration) AS professional_duration,
      GREATEST(
        ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        ((p_date::TEXT || ' ' || (prof.weekly_schedule -> v_day_of_week ->> 'start') || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      ) AS window_start,
      LEAST(
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        ((p_date::TEXT || ' ' || (prof.weekly_schedule -> v_day_of_week ->> 'end') || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      ) AS window_end
    FROM public.professionals prof
    JOIN public.professional_services ps
      ON ps.tenant_id = prof.tenant_id
     AND ps.professional_id = prof.id
     AND ps.service_id = p_service_id
     AND ps.is_enabled = true
    WHERE prof.tenant_id = v_tenant_id
      AND (p_professional_id IS NULL OR prof.id = p_professional_id)
      AND prof.is_active = true
      AND prof.deleted_at IS NULL
      AND COALESCE(
        (prof.weekly_schedule -> v_day_of_week ->> 'active')::BOOLEAN,
        (prof.weekly_schedule -> v_day_of_week ->> 'start') IS NOT NULL
          AND (prof.weekly_schedule -> v_day_of_week ->> 'end') IS NOT NULL
      ) IS TRUE
      AND prof.weekly_schedule -> v_day_of_week ->> 'start' IS NOT NULL
      AND prof.weekly_schedule -> v_day_of_week ->> 'end' IS NOT NULL
  ), professional_grid AS (
    SELECT generated.slot_start
    FROM qualified_professionals qp
    CROSS JOIN LATERAL generate_series(
      qp.window_start,
      qp.window_end - (qp.professional_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS generated(slot_start)
  ), tenant_grid AS (
    SELECT generated.slot_start
    FROM generate_series(
      ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (v_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS generated(slot_start)
  ), grid AS (
    SELECT slot_start FROM professional_grid
    UNION
    SELECT slot_start
    FROM tenant_grid
    WHERE NOT EXISTS (SELECT 1 FROM qualified_professionals)
  )
  SELECT
    to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time,
    COALESCE(
      to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI') = ANY(v_available_slots),
      false
    ) AS available
  FROM grid
  ORDER BY grid.slot_start;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_schedule_by_slug(TEXT, DATE, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_schedule_by_slug(TEXT, DATE, UUID, UUID) TO anon, authenticated, service_role;
