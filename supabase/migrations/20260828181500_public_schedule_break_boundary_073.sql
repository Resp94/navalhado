-- Migration 073: limita a grade da manhã ao início do intervalo.
--
-- A migration 072 ajustou o início da grade para o expediente do
-- profissional. Esta migration completa a mesma regra no canal público,
-- evitando que a grade da manhã atravesse o intervalo e duplique a tarde.

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'public.get_public_schedule_by_slug(text,date,uuid,uuid)'::regprocedure
  );

  v_old := $old$
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
          AND v_break_start IS NOT NULL
          AND v_break_end IS NOT NULL
          AND v_professional_start IS NOT NULL
          AND v_professional_end IS NOT NULL
          AND v_break_start::TIME > v_start_time::TIME
          AND v_break_start::TIME > v_professional_start::TIME
          AND v_break_start::TIME < v_break_end::TIME
          AND v_break_end::TIME < v_end_time::TIME
          AND v_break_end::TIME < v_professional_end::TIME
        THEN ((p_date::TEXT || ' ' || v_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          - (v_duration || ' minutes')::INTERVAL
        ELSE CASE
          WHEN p_professional_id IS NOT NULL
            AND v_professional_end IS NOT NULL
            AND v_professional_end::TIME < v_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END - (v_duration || ' minutes')::INTERVAL
      END,
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
    RAISE EXCEPTION 'get_public_schedule_by_slug grid generation changed; migration 073 cannot be applied safely';
  END IF;

  EXECUTE replace(v_definition, v_old, v_new);
END;
$migration$;
