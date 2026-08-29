-- Migration 072: reinicia a grade no início do expediente do profissional.
--
-- O intervalo entre a abertura da barbearia e o início do profissional não
-- deve consumir a cadência dos slots. A regra é aplicada aos dois RPCs que
-- alimentam o agendamento público e o reagendamento.

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
$old$;
  v_new := $new$
    FROM (
      SELECT slot_start
      FROM generate_series(
        CASE
          WHEN v_start_time::TIME > v_tenant_start_time::TIME
          THEN ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END,
        CASE
          WHEN v_break_start IS NOT NULL
            AND v_break_end IS NOT NULL
            AND v_break_start::TIME > v_tenant_start_time::TIME
            AND v_break_start::TIME > v_start_time::TIME
            AND v_break_start::TIME < v_break_end::TIME
            AND v_break_end::TIME < v_tenant_end_time::TIME
            AND v_break_end::TIME < v_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            - (v_duration || ' minutes')::INTERVAL
          ELSE CASE
            WHEN v_end_time::TIME < v_tenant_end_time::TIME
            THEN ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          END - (v_duration || ' minutes')::INTERVAL
        END,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS morning(slot_start)
      UNION ALL
      SELECT slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || v_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        CASE
          WHEN v_end_time::TIME < v_tenant_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END - (v_duration || ' minutes')::INTERVAL,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS afternoon(slot_start)
      WHERE v_break_start IS NOT NULL
        AND v_break_end IS NOT NULL
        AND v_break_start::TIME > v_tenant_start_time::TIME
        AND v_break_start::TIME > v_start_time::TIME
        AND v_break_start::TIME < v_break_end::TIME
        AND v_break_end::TIME < v_tenant_end_time::TIME
        AND v_break_end::TIME < v_end_time::TIME
    ) AS candidate(slot_start)
$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots selected-professional generation changed; migration 072 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
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
$old$;
  v_new := $new$
    CROSS JOIN LATERAL (
      SELECT slot_start
      FROM generate_series(
        CASE
          WHEN qp.professional_start::TIME > v_tenant_start_time::TIME
          THEN ((p_date::TEXT || ' ' || qp.professional_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_tenant_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END,
        CASE
          WHEN qp.professional_break_start IS NOT NULL
            AND qp.professional_break_end IS NOT NULL
            AND qp.professional_break_start::TIME > v_tenant_start_time::TIME
            AND qp.professional_break_start::TIME > qp.professional_start::TIME
            AND qp.professional_break_start::TIME < qp.professional_break_end::TIME
            AND qp.professional_break_end::TIME < v_tenant_end_time::TIME
            AND qp.professional_break_end::TIME < qp.professional_end::TIME
          THEN ((p_date::TEXT || ' ' || qp.professional_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            - (qp.professional_duration || ' minutes')::INTERVAL
          ELSE CASE
            WHEN qp.professional_end::TIME < v_tenant_end_time::TIME
            THEN ((p_date::TEXT || ' ' || qp.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          END - (qp.professional_duration || ' minutes')::INTERVAL
        END,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS morning(slot_start)
      UNION ALL
      SELECT slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || qp.professional_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        CASE
          WHEN qp.professional_end::TIME < v_tenant_end_time::TIME
          THEN ((p_date::TEXT || ' ' || qp.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END - (qp.professional_duration || ' minutes')::INTERVAL,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS afternoon(slot_start)
      WHERE qp.professional_break_start IS NOT NULL
        AND qp.professional_break_end IS NOT NULL
        AND qp.professional_break_start::TIME > v_tenant_start_time::TIME
        AND qp.professional_break_start::TIME > qp.professional_start::TIME
        AND qp.professional_break_start::TIME < qp.professional_break_end::TIME
        AND qp.professional_break_end::TIME < v_tenant_end_time::TIME
        AND qp.professional_break_end::TIME < qp.professional_end::TIME
    ) AS generated(slot_start)
$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots free-choice generation changed; migration 072 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  v_definition := pg_get_functiondef(
    'public.get_public_schedule_by_slug(text,date,uuid,uuid)'::regprocedure
  );
  v_old := $old$
  v_break_start TEXT;
  v_break_end TEXT;
$old$;
  v_new := $new$
  v_break_start TEXT;
  v_break_end TEXT;
  v_professional_start TEXT;
  v_professional_end TEXT;
$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule_by_slug declarations changed; migration 072 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
    SELECT
      prof.weekly_schedule -> v_day_of_week ->> 'break_start',
      prof.weekly_schedule -> v_day_of_week ->> 'break_end'
    INTO v_break_start, v_break_end
$old$;
  v_new := $new$
    SELECT
      prof.weekly_schedule -> v_day_of_week ->> 'start',
      prof.weekly_schedule -> v_day_of_week ->> 'end',
      prof.weekly_schedule -> v_day_of_week ->> 'break_start',
      prof.weekly_schedule -> v_day_of_week ->> 'break_end'
    INTO v_professional_start, v_professional_end, v_break_start, v_break_end
$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule_by_slug professional schedule lookup changed; migration 072 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old$
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
$old$;
  v_new := $new$
  FROM (
    SELECT slot_start
    FROM generate_series(
      CASE
        WHEN p_professional_id IS NOT NULL
          AND v_professional_start IS NOT NULL
          AND v_professional_start::TIME > v_start_time::TIME
        THEN ((p_date::TEXT || ' ' || v_professional_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        ELSE ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      END,
      CASE
        WHEN p_professional_id IS NOT NULL
          AND v_professional_end IS NOT NULL
          AND v_professional_end::TIME < v_end_time::TIME
        THEN ((p_date::TEXT || ' ' || v_professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      END - (v_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS morning(slot_start)
    UNION ALL
    SELECT slot_start
    FROM generate_series(
      ((p_date::TEXT || ' ' || v_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
      CASE
        WHEN v_professional_end IS NOT NULL AND v_professional_end::TIME < v_end_time::TIME
        THEN ((p_date::TEXT || ' ' || v_professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      END - (v_duration || ' minutes')::INTERVAL,
      (v_slot_interval || ' minutes')::INTERVAL
    ) AS afternoon(slot_start)
    WHERE p_professional_id IS NOT NULL
      AND v_break_start IS NOT NULL
      AND v_break_end IS NOT NULL
      AND v_professional_start IS NOT NULL
      AND v_professional_end IS NOT NULL
      AND v_break_start::TIME > v_start_time::TIME
      AND v_break_start::TIME > v_professional_start::TIME
      AND v_break_start::TIME < v_break_end::TIME
      AND v_break_end::TIME < v_end_time::TIME
      AND v_break_end::TIME < v_professional_end::TIME
  ) AS grid(slot_start)
$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule_by_slug grid generation changed; migration 072 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;
