-- Migration 075: limita slots pelo início antes do fechamento.
--
-- O horário de fechamento limita o início do atendimento, não a duração do
-- serviço. Assim, com grade de 40 minutos e fechamento às 18:00, 17:40 é o
-- último início possível, mesmo que o atendimento termine depois.

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'public.get_available_slots(uuid,uuid,uuid,date,uuid)'::regprocedure
  );

  v_old := $selected_end$
          ELSE CASE
            WHEN v_end_time::TIME < v_tenant_end_time::TIME
            THEN ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          END - (v_duration || ' minutes')::INTERVAL
$selected_end$;
  v_new := $selected_end_new$
          ELSE CASE
            WHEN v_end_time::TIME < v_tenant_end_time::TIME
            THEN ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          END
$selected_end_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots selected closing boundary changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $selected_afternoon$
        CASE
          WHEN v_end_time::TIME < v_tenant_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END - (v_duration || ' minutes')::INTERVAL,
$selected_afternoon$;
  v_new := $selected_afternoon_new$
        CASE
          WHEN v_end_time::TIME < v_tenant_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END,
$selected_afternoon_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots selected afternoon boundary changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $selected_filters$
      AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL <=
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start + (v_duration || ' minutes')::INTERVAL <=
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$selected_filters$;
  v_new := $selected_filters_new$
      AND candidate.slot_start <
        ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      AND candidate.slot_start <
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$selected_filters_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots selected filters changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $free_choice_morning$
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
            - (qp.professional_duration || ' minutes')::INTERVAL
$free_choice_morning$;
  v_new := $free_choice_morning_new$
          ELSE ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$free_choice_morning_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots free-choice morning boundary changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $free_choice_afternoon$
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          - (qp.professional_duration || ' minutes')::INTERVAL,
$free_choice_afternoon$;
  v_new := $free_choice_afternoon_new$
        ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone,
$free_choice_afternoon_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots free-choice afternoon boundary changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $free_choice_filters$
    AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL <=
      ((p_date::TEXT || ' ' || candidate.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start + (candidate.professional_duration || ' minutes')::INTERVAL <=
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$free_choice_filters$;
  v_new := $free_choice_filters_new$
    AND candidate.slot_start <
      ((p_date::TEXT || ' ' || candidate.professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
    AND candidate.slot_start <
      ((p_date::TEXT || ' ' || v_tenant_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
$free_choice_filters_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_available_slots free-choice filters changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  v_definition := pg_get_functiondef(
    'public.get_public_schedule_by_slug(text,date,uuid,uuid)'::regprocedure
  );

  v_old := $public_morning$
        ELSE CASE
          WHEN p_professional_id IS NOT NULL
            AND v_professional_end IS NOT NULL
            AND v_professional_end::TIME < v_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END - (v_duration || ' minutes')::INTERVAL
$public_morning$;
  v_new := $public_morning_new$
        ELSE CASE
          WHEN p_professional_id IS NOT NULL
            AND v_professional_end IS NOT NULL
            AND v_professional_end::TIME < v_end_time::TIME
          THEN ((p_date::TEXT || ' ' || v_professional_end || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
          ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
        END
$public_morning_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule morning closing boundary changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $public_afternoon$
        ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      END - (v_duration || ' minutes')::INTERVAL,
$public_afternoon$;
  v_new := $public_afternoon_new$
        ELSE ((p_date::TEXT || ' ' || v_end_time || ':00')::TIMESTAMP) AT TIME ZONE v_timezone
      END,
$public_afternoon_new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'get_public_schedule afternoon closing boundary changed; migration 075 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;

  v_definition := pg_get_functiondef(
    'public.reschedule_appointment_by_token(uuid,uuid,uuid,uuid,date,text)'::regprocedure
  );
  v_old := 'AND v_new_end_time <= ';
  v_new := 'AND v_new_start_time < ';
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'reschedule professional boundary changed; migration 075 cannot be applied safely';
  END IF;
  EXECUTE replace(v_definition, v_old, v_new);
END;
$migration$;
