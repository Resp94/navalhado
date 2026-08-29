-- Migration 079: endurece reativacao e dias inativos no trigger de agendamento.

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'private.validate_appointment_schedule_boundaries()'::regprocedure
  );

  v_old := $old$    AND NEW.is_fitting IS NOT DISTINCT FROM OLD.is_fitting THEN$old$;
  v_new := $new$    AND NEW.is_fitting IS NOT DISTINCT FROM OLD.is_fitting
     AND NOT (
       lower(COALESCE(OLD.status, '')) IN ('cancelled', 'canceled', 'cancelado')
       AND lower(COALESCE(NEW.status, '')) NOT IN ('cancelled', 'canceled', 'cancelado')
     ) THEN$new$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'appointment status reactivation guard changed; migration 079 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old_active$  IF NOT v_professional_active THEN
    RETURN NEW;
  END IF;
$old_active$;
  v_new := $new_active$  IF NOT v_professional_active THEN
    RAISE EXCEPTION 'O profissional nao atende nesta data'
      USING ERRCODE = '22023';
  END IF;
$new_active$;
  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'inactive professional day guard changed; migration 079 cannot be applied safely';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END;
$migration$;
