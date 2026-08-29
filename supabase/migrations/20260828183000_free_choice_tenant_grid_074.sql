-- Migration 074: preserva a grade da barbearia no modo "Tanto faz".
--
-- A grade deve usar o expediente do profissional quando ele é escolhido
-- explicitamente. No modo livre, o horário visual continua sendo a grade do
-- estabelecimento, com a disponibilidade calculada entre os profissionais.

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
    RAISE EXCEPTION 'get_available_slots free-choice generation changed; migration 074 cannot be applied safely';
  END IF;

  EXECUTE replace(v_definition, v_old, v_new);
END;
$migration$;
