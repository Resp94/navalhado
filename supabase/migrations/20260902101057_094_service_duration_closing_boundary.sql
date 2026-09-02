-- Migration 094: normal availability must fit the effective service duration
-- before both the professional and tenant closing boundaries.
--
-- The visual internal ruler intentionally remains unchanged. This migration
-- only tightens the normal availability RPC used by internal/public booking.

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'public.get_available_slots(uuid,uuid,uuid,date,uuid)'::regprocedure
  );

  v_old := $selected_filters$
      AND candidate.slot_start <
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start <
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$selected_filters$;
  v_new := $selected_filters_new$
      AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL <=
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL <=
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$selected_filters_new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots selected closing filters changed; migration 094 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $free_choice_filters$
    AND candidate.slot_start <
      ((p_date::TEXT || ' ' || candidate.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start <
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$free_choice_filters$;
  v_new := $free_choice_filters_new$
    AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL <=
      ((p_date::TEXT || ' ' || candidate.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL <=
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$free_choice_filters_new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots free-choice closing filters changed; migration 094 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;
