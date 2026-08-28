-- Migration 078: nao exibe o proprio horario de fechamento como slot.
--
-- A grade usa o fechamento como limite exclusivo. O ultimo slot e o ultimo
-- inicio gerado antes dele, ainda que o atendimento termine depois.

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'public.get_public_schedule_by_slug(text,date,uuid,uuid)'::regprocedure
  );

  v_old := $old$      END,
      (v_slot_interval || ' minutes')::INTERVAL$old$;
  v_new := $new$      END - INTERVAL '1 minute',
      (v_slot_interval || ' minutes')::INTERVAL$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'public schedule closing endpoint changed; migration 078 cannot be applied safely';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;
