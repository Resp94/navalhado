-- Migration 077: preserva escalas cadastradas em dias fechados.
--
-- Um dia fechado impede a oferta de horarios, mas nao invalida uma escala
-- previamente cadastrada. Os limites de abertura/fechamento continuam sendo
-- aplicados quando o dia da barbearia esta ativo.

DO $migration$
DECLARE
  v_definition TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  v_definition := pg_get_functiondef(
    'private.assert_professional_schedule_within_tenant(uuid,jsonb,jsonb)'::regprocedure
  );

  v_old := $old$
    IF NOT v_tenant_active THEN
      RAISE EXCEPTION 'Nao e possivel configurar escala na % porque a barbearia esta fechada nesse dia', v_day_pt
        USING ERRCODE = '22023';
    END IF;
$old$;
  v_new := $new$
    IF NOT v_tenant_active THEN
      CONTINUE;
    END IF;
$new$;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'professional closed-day compatibility guard changed; migration 077 cannot be applied safely';
  END IF;

  EXECUTE replace(v_definition, v_old, v_new);
END;
$migration$;
