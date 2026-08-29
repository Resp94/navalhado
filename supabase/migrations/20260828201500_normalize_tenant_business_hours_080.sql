-- Migration 080: normaliza horarios legados e chaves parciais do expediente.
--
-- A tela de configuracoes usa as chaves em portugues. Registros antigos podem
-- usar chaves em ingles ou conter apenas o campo que foi alterado, o que fazia
-- a edicao de um dia sem chave portuguesa persistir um JSON incompleto.

DO $migration$
DECLARE
  v_tenant RECORD;
  v_day_index INTEGER;
  v_pt_key TEXT;
  v_en_key TEXT;
  v_pt_day JSONB;
  v_en_day JSONB;
  v_fallback JSONB;
  v_normalized JSONB;
  v_active TEXT;
  v_open TEXT;
  v_close TEXT;
BEGIN
  FOR v_tenant IN
    SELECT id, COALESCE(business_hours, '{}'::jsonb) AS business_hours
    FROM public.tenants
  LOOP
    v_normalized := '{}'::jsonb;

    FOR v_day_index IN 0..6 LOOP
      v_pt_key := (ARRAY['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'])[v_day_index + 1];
      v_en_key := (ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])[v_day_index + 1];
      v_pt_day := COALESCE(v_tenant.business_hours -> v_pt_key, '{}'::jsonb);
      v_en_day := COALESCE(v_tenant.business_hours -> v_en_key, '{}'::jsonb);
      v_fallback := jsonb_build_object(
        'active', v_pt_key <> 'domingo',
        'open', CASE WHEN v_pt_key = 'sabado' OR v_pt_key = 'domingo' THEN '09:00' ELSE '09:00' END,
        'close', CASE WHEN v_pt_key = 'sabado' THEN '15:00' WHEN v_pt_key = 'domingo' THEN '12:00' ELSE '18:00' END
      );

      v_active := COALESCE(
        NULLIF(v_pt_day ->> 'active', ''),
        NULLIF(v_en_day ->> 'active', ''),
        v_fallback ->> 'active'
      );
      v_open := COALESCE(
        NULLIF(v_pt_day ->> 'open', ''),
        NULLIF(v_pt_day ->> 'start', ''),
        NULLIF(v_en_day ->> 'open', ''),
        NULLIF(v_en_day ->> 'start', ''),
        v_fallback ->> 'open'
      );
      v_close := COALESCE(
        NULLIF(v_pt_day ->> 'close', ''),
        NULLIF(v_pt_day ->> 'end', ''),
        NULLIF(v_en_day ->> 'close', ''),
        NULLIF(v_en_day ->> 'end', ''),
        v_fallback ->> 'close'
      );

      v_normalized := v_normalized || jsonb_build_object(
        v_pt_key,
        jsonb_build_object(
          'active', lower(v_active) <> 'false',
          'open', v_open,
          'close', v_close
        )
      );
    END LOOP;

    UPDATE public.tenants
    SET business_hours = v_normalized
    WHERE id = v_tenant.id
      AND business_hours IS DISTINCT FROM v_normalized;
  END LOOP;
END;
$migration$;
