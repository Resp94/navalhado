-- Migration 071: reinicia a cadência de slots no retorno do intervalo.
--
-- A agenda interna já inicia a grade novamente em break_end. Os RPCs usados
-- pelo canal público e pelo reagendamento passam a aplicar a mesma regra,
-- preservando a antecedência mínima do tenant.

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'public.get_available_slots(uuid,uuid,uuid,date,uuid)'::regprocedure
  );

  v_old := $old$
    FROM generate_series(
      ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (v_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS candidate(slot_start)
$old$;
  v_new := $new$
    FROM (
      SELECT slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        CASE
          WHEN v_break_start IS NOT NULL
            AND v_break_end IS NOT NULL
            AND v_break_start::TIME > v_tenant_start_time::TIME
            AND v_break_start::TIME < v_break_end::TIME
            AND v_break_end::TIME < v_tenant_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            - (v_duration || ' minutes')::INTERVAL
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            - (v_duration || ' minutes')::INTERVAL
        END,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS morning(slot_start)
      UNION ALL
      SELECT slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || v_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          - (v_duration || ' minutes')::INTERVAL,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS afternoon(slot_start)
      WHERE v_break_start IS NOT NULL
        AND v_break_end IS NOT NULL
        AND v_break_start::TIME > v_tenant_start_time::TIME
        AND v_break_start::TIME < v_break_end::TIME
        AND v_break_end::TIME < v_tenant_end_time::TIME
    ) AS candidate(slot_start)
$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots candidate generation changed; migration 071 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
    CROSS JOIN LATERAL generate_series(
      ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (qp.professional_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS generated(slot_start)
$old$;
  v_new := $new$
    CROSS JOIN LATERAL (
      SELECT slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        CASE
          WHEN qp.professional_break_start IS NOT NULL
            AND qp.professional_break_end IS NOT NULL
            AND qp.professional_break_start::TIME > v_tenant_start_time::TIME
            AND qp.professional_break_start::TIME < qp.professional_break_end::TIME
            AND qp.professional_break_end::TIME < v_tenant_end_time::TIME
          THEN ((p_date::TEXT || ' ' || qp.professional_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            - (qp.professional_duration || ' minutes')::INTERVAL
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            - (qp.professional_duration || ' minutes')::INTERVAL
        END,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS morning(slot_start)
      UNION ALL
      SELECT slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || qp.professional_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          - (qp.professional_duration || ' minutes')::INTERVAL,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS afternoon(slot_start)
      WHERE qp.professional_break_start IS NOT NULL
        AND qp.professional_break_end IS NOT NULL
        AND qp.professional_break_start::TIME > v_tenant_start_time::TIME
        AND qp.professional_break_start::TIME < qp.professional_break_end::TIME
        AND qp.professional_break_end::TIME < v_tenant_end_time::TIME
    ) AS generated(slot_start)
$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots free-choice candidate generation changed; migration 071 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  v_definition := pg_get_functiondef(
    'public.get_public_schedule_by_slug(text,date,uuid,uuid)'::regprocedure
  );
  v_definition := replace(
    v_definition,
    '  v_available_slots TEXT[];',
    E'  v_available_slots TEXT[];\n  v_break_start TEXT;\n  v_break_end TEXT;'
  );

  v_old := $old$
  IF v_day_active IS FALSE OR v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN;
  END IF;

  SELECT ARRAY(SELECT slots.slot_time FROM public.get_available_slots(v_tenant_id, p_professional_id, p_service_id, p_date, NULL::UUID) AS slots)
$old$;
  v_new := $new$
  IF v_day_active IS FALSE OR v_start_time IS NULL OR v_end_time IS NULL THEN
    RETURN;
  END IF;

  IF p_professional_id IS NOT NULL THEN
    SELECT
      prof.weekly_schedule -> v_day_of_week ->> 'break_start',
      prof.weekly_schedule -> v_day_of_week ->> 'break_end'
    INTO v_break_start, v_break_end
    FROM public.professionals prof
    WHERE prof.id = p_professional_id
      AND prof.tenant_id = v_tenant_id
      AND prof.is_active IS TRUE
      AND prof.deleted_at IS NULL;
  END IF;

  SELECT ARRAY(SELECT slots.slot_time FROM public.get_available_slots(v_tenant_id, p_professional_id, p_service_id, p_date, NULL::UUID) AS slots)
$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule_by_slug break lookup location changed; migration 071 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
  FROM generate_series(
    ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
    ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone - (v_duration || ' minutes')::INTERVAL,
    (v_slot_interval || ' minutes')::INTERVAL
  ) AS grid(slot_start)
$old$;
  v_new := $new$
  FROM (
    SELECT slot_start
    FROM generate_series(
      ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      CASE
        WHEN v_break_start IS NOT NULL
          AND v_break_end IS NOT NULL
          AND v_break_start::TIME > v_start_time::TIME
          AND v_break_start::TIME < v_break_end::TIME
          AND v_break_end::TIME < v_end_time::TIME
        THEN ((p_date::TEXT || ' ' || v_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          - (v_duration || ' minutes')::INTERVAL
        ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          - (v_duration || ' minutes')::INTERVAL
      END,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS morning(slot_start)
    UNION ALL
    SELECT slot_start
    FROM generate_series(
      ((p_date::TEXT || ' ' || v_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        - (v_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS afternoon(slot_start)
    WHERE v_break_start IS NOT NULL
      AND v_break_end IS NOT NULL
      AND v_break_start::TIME > v_start_time::TIME
      AND v_break_start::TIME < v_break_end::TIME
      AND v_break_end::TIME < v_end_time::TIME
  ) AS grid(slot_start)
$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule_by_slug grid generation changed; migration 071 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;
