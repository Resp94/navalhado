-- Migration 081: o expediente da barbearia e a autoridade sobre a agenda.
--
-- Ao alterar a abertura ou o fechamento do estabelecimento, ajusta
-- automaticamente as escalas profissionais que ultrapassarem esses limites.
-- Escalas manuais continuam sendo validadas contra o expediente vigente.

CREATE OR REPLACE FUNCTION private.clamp_professional_schedule_to_tenant(
  p_schedule JSONB,
  p_business_hours JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB := COALESCE(p_schedule, '{}'::jsonb);
  v_day_index INTEGER;
  v_day_en TEXT;
  v_day_pt TEXT;
  v_professional_key TEXT;
  v_professional_day JSONB;
  v_tenant_day JSONB;
  v_tenant_active BOOLEAN;
  v_professional_start TEXT;
  v_professional_end TEXT;
  v_break_start TEXT;
  v_break_end TEXT;
  v_open TEXT;
  v_close TEXT;
  v_start_field TEXT;
  v_end_field TEXT;
  v_day JSONB;
  v_clamped_start TIME;
  v_clamped_end TIME;
  v_clamped_break_start TIME;
  v_clamped_break_end TIME;
BEGIN
  FOR v_day_index IN 0..6 LOOP
    v_day_en := (ARRAY['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])[v_day_index + 1];
    v_day_pt := (ARRAY['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'])[v_day_index + 1];

    IF p_schedule ? v_day_en THEN
      v_professional_key := v_day_en;
    ELSIF p_schedule ? v_day_pt THEN
      v_professional_key := v_day_pt;
    ELSE
      CONTINUE;
    END IF;

    v_professional_day := p_schedule -> v_professional_key;
    IF jsonb_typeof(v_professional_day) <> 'object' THEN
      CONTINUE;
    END IF;

    v_tenant_day := COALESCE(p_business_hours -> v_day_pt, p_business_hours -> v_day_en);
    v_tenant_active := CASE
      WHEN v_tenant_day IS NULL THEN true
      ELSE lower(COALESCE(v_tenant_day ->> 'active', 'true')) <> 'false'
    END;

    -- Dia fechado não oferece slots e não precisa alterar a escala salva.
    IF NOT v_tenant_active THEN
      CONTINUE;
    END IF;

    v_open := COALESCE(v_tenant_day ->> 'open', v_tenant_day ->> 'start', '08:00');
    v_close := COALESCE(v_tenant_day ->> 'close', v_tenant_day ->> 'end', '20:00');
    v_professional_start := COALESCE(v_professional_day ->> 'start', v_professional_day ->> 'open');
    v_professional_end := COALESCE(v_professional_day ->> 'end', v_professional_day ->> 'close');

    IF v_professional_start IS NULL OR v_professional_end IS NULL THEN
      CONTINUE;
    END IF;

    v_clamped_start := GREATEST(v_professional_start::TIME, v_open::TIME);
    v_clamped_end := LEAST(v_professional_end::TIME, v_close::TIME);
    v_day := v_professional_day;

    -- Sem interseção, mantém uma escala válida, mas desativada.
    IF v_clamped_start >= v_clamped_end THEN
      v_clamped_start := v_open::TIME;
      v_clamped_end := v_close::TIME;
      v_day := jsonb_set(v_day, '{active}', 'false'::jsonb, true);
    END IF;

    v_start_field := CASE WHEN v_professional_day ? 'start' THEN 'start' ELSE 'open' END;
    v_end_field := CASE WHEN v_professional_day ? 'end' THEN 'end' ELSE 'close' END;
    v_day := jsonb_set(v_day, ARRAY[v_start_field], to_jsonb(to_char(v_clamped_start, 'HH24:MI')), true);
    v_day := jsonb_set(v_day, ARRAY[v_end_field], to_jsonb(to_char(v_clamped_end, 'HH24:MI')), true);

    v_break_start := v_professional_day ->> 'break_start';
    v_break_end := v_professional_day ->> 'break_end';
    IF v_break_start IS NULL OR v_break_end IS NULL THEN
      v_day := v_day - 'break_start' - 'break_end';
    ELSE
      v_clamped_break_start := GREATEST(v_break_start::TIME, v_clamped_start);
      v_clamped_break_end := LEAST(v_break_end::TIME, v_clamped_end);
      IF v_clamped_break_start >= v_clamped_break_end THEN
        v_day := v_day - 'break_start' - 'break_end';
      ELSE
        v_day := jsonb_set(v_day, '{break_start}', to_jsonb(to_char(v_clamped_break_start, 'HH24:MI')), true);
        v_day := jsonb_set(v_day, '{break_end}', to_jsonb(to_char(v_clamped_break_end, 'HH24:MI')), true);
      END IF;
    END IF;

    v_result := jsonb_set(v_result, ARRAY[v_professional_key], v_day, true);
  END LOOP;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION private.adjust_professional_schedules_to_tenant_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_professional RECORD;
  v_adjusted_schedule JSONB;
BEGIN
  FOR v_professional IN
    SELECT p.id, p.weekly_schedule
    FROM public.professionals p
    WHERE p.tenant_id = NEW.id
      AND p.deleted_at IS NULL
  LOOP
    v_adjusted_schedule := private.clamp_professional_schedule_to_tenant(
      v_professional.weekly_schedule,
      NEW.business_hours
    );

    IF v_adjusted_schedule IS DISTINCT FROM v_professional.weekly_schedule THEN
      UPDATE public.professionals
      SET weekly_schedule = v_adjusted_schedule,
          updated_at = timezone('utc'::text, now())
      WHERE id = v_professional.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_tenant_business_hours_boundaries ON public.tenants;
DROP TRIGGER IF EXISTS trg_adjust_professional_schedules_to_tenant_hours ON public.tenants;
CREATE TRIGGER trg_adjust_professional_schedules_to_tenant_hours
  AFTER UPDATE OF business_hours
  ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION private.adjust_professional_schedules_to_tenant_hours();
