-- Migration 086: alinha o modo "Tanto faz" ao expediente efetivo dos profissionais.
--
-- A grade do tenant continua definindo os limites máximos. Quando existe pelo
-- menos um profissional habilitado para o serviço, a cadência deve começar
-- no início efetivo de cada profissional e reiniciar no retorno do intervalo.
-- Agendamentos existentes apenas ocupam seus horários; nunca deslocam a grade.

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
        END,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS morning(slot_start)
      UNION ALL
      SELECT slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || qp.professional_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
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
          END
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
        END,
        (v_slot_interval || ' minutes')::INTERVAL
      ) AS afternoon(slot_start)
      WHERE qp.professional_break_start IS NOT NULL
        AND qp.professional_break_end IS NOT NULL
        AND qp.professional_start IS NOT NULL
        AND qp.professional_end IS NOT NULL
        AND qp.professional_break_start::TIME > v_tenant_start_time::TIME
        AND qp.professional_break_start::TIME > qp.professional_start::TIME
        AND qp.professional_break_start::TIME < qp.professional_break_end::TIME
        AND qp.professional_break_end::TIME < v_tenant_end_time::TIME
        AND qp.professional_break_end::TIME < qp.professional_end::TIME
    ) AS generated(slot_start)
$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots free-choice start changed; migration 086 cannot be applied safely';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);

  v_definition := pg_get_functiondef(
    'public.get_public_schedule_by_slug(text,date,uuid,uuid)'::regprocedure
  );

  v_old := $old$
  RETURN QUERY
  SELECT
    to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI'),
$old$;
  v_new := $new$
  IF p_professional_id IS NULL THEN
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
      WHERE prof.tenant_id = v_tenant_id
        AND prof.is_active IS TRUE
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
      CROSS JOIN LATERAL (
        SELECT slot_start
        FROM generate_series(
          CASE
            WHEN qp.professional_start::TIME > v_start_time::TIME
            THEN ((p_date::TEXT || ' ' || qp.professional_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            ELSE ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          END,
          CASE
            WHEN qp.professional_break_start IS NOT NULL
              AND qp.professional_break_end IS NOT NULL
              AND qp.professional_break_start::TIME > v_start_time::TIME
              AND qp.professional_break_start::TIME > qp.professional_start::TIME
              AND qp.professional_break_start::TIME < qp.professional_break_end::TIME
              AND qp.professional_break_end::TIME < v_end_time::TIME
              AND qp.professional_break_end::TIME < qp.professional_end::TIME
            THEN ((p_date::TEXT || ' ' || qp.professional_break_start || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
              - (qp.professional_duration || ' minutes')::INTERVAL
            ELSE CASE
              WHEN qp.professional_end::TIME < v_end_time::TIME
              THEN ((p_date::TEXT || ' ' || qp.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
              ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            END - INTERVAL '1 minute'
          END,
          (v_slot_interval || ' minutes')::INTERVAL
        ) AS morning(slot_start)
        UNION ALL
        SELECT slot_start
        FROM generate_series(
          ((p_date::TEXT || ' ' || qp.professional_break_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
          CASE
            WHEN qp.professional_end::TIME < v_end_time::TIME
            THEN ((p_date::TEXT || ' ' || qp.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          END - INTERVAL '1 minute',
          (v_slot_interval || ' minutes')::INTERVAL
        ) AS afternoon(slot_start)
        WHERE qp.professional_break_start IS NOT NULL
          AND qp.professional_break_end IS NOT NULL
          AND qp.professional_start IS NOT NULL
          AND qp.professional_end IS NOT NULL
          AND qp.professional_break_start::TIME > v_start_time::TIME
          AND qp.professional_break_start::TIME > qp.professional_start::TIME
          AND qp.professional_break_start::TIME < qp.professional_break_end::TIME
          AND qp.professional_break_end::TIME < v_end_time::TIME
          AND qp.professional_break_end::TIME < qp.professional_end::TIME
      ) AS generated(slot_start)
    ), tenant_grid AS (
      SELECT generated.slot_start
      FROM generate_series(
        ((p_date::TEXT || ' ' || v_start_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone - INTERVAL '1 minute',
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
      to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI'),
      to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI') = ANY(v_available_slots)
    FROM grid
    ORDER BY grid.slot_start;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    to_char(grid.slot_start AT TIME ZONE v_timezone, 'HH24:MI'),
$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule free-choice grid changed; migration 086 cannot be applied safely';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);
END;
$migration$;
