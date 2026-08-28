-- Migration 059: grade pública baseada no expediente do tenant

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
  SELECT
    to_char(slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time,
    to_char(slot_start AT TIME ZONE v_timezone, 'HH24:MI') = ANY(v_available_slots) AS available
  FROM generate_series(
    ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
    ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      - (v_duration || ' minutes')::INTERVAL,
    (v_slot_interval || ' minutes')::INTERVAL
  ) AS slots(slot_start);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_schedule_by_slug(TEXT, DATE, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_schedule_by_slug(TEXT, DATE, UUID, UUID) TO anon, authenticated, service_role;
