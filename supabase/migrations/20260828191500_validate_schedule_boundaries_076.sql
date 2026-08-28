-- Migration 076: aplica os limites do expediente em todas as escritas.
--
-- O fechamento limita o inicio do atendimento. A duracao pode ultrapassa-lo,
-- mas nenhum novo horario pode comecar no fechamento ou depois dele.

CREATE OR REPLACE FUNCTION private.assert_professional_schedule_within_tenant(
  p_tenant_id UUID,
  p_schedule JSONB,
  p_business_hours JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_business_hours JSONB;
  v_tenant_day JSONB;
  v_professional_day JSONB;
  v_day_en TEXT;
  v_day_pt TEXT;
  v_open TEXT;
  v_close TEXT;
  v_professional_start TEXT;
  v_professional_end TEXT;
  v_break_start TEXT;
  v_break_end TEXT;
  v_active BOOLEAN;
  v_tenant_active BOOLEAN;
  v_day_index INTEGER;
BEGIN
  SELECT COALESCE(p_business_hours, t.business_hours)
    INTO v_business_hours
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_business_hours IS NULL THEN
    RAISE EXCEPTION 'Barbearia nao encontrada para validar a escala do profissional'
      USING ERRCODE = '22023';
  END IF;

  FOR v_day_index IN 0..6 LOOP
    v_day_en := (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[v_day_index + 1];
    v_day_pt := (ARRAY['domingo','segunda','terca','quarta','quinta','sexta','sabado'])[v_day_index + 1];

    v_professional_day := COALESCE(p_schedule -> v_day_en, p_schedule -> v_day_pt);
    IF v_professional_day IS NULL OR jsonb_typeof(v_professional_day) <> 'object' THEN
      CONTINUE;
    END IF;

    v_active := CASE
      WHEN lower(COALESCE(v_professional_day ->> 'active', 'true')) = 'false' THEN false
      ELSE true
    END;
    v_professional_start := COALESCE(v_professional_day ->> 'start', v_professional_day ->> 'open');
    v_professional_end := COALESCE(v_professional_day ->> 'end', v_professional_day ->> 'close');
    v_break_start := v_professional_day ->> 'break_start';
    v_break_end := v_professional_day ->> 'break_end';

    IF NOT v_active AND v_professional_start IS NULL AND v_professional_end IS NULL THEN
      CONTINUE;
    END IF;

    IF v_professional_start IS NULL OR v_professional_end IS NULL THEN
      RAISE EXCEPTION 'A escala de % precisa informar entrada e saida', v_day_pt
        USING ERRCODE = '22023';
    END IF;

    v_tenant_day := COALESCE(v_business_hours -> v_day_pt, v_business_hours -> v_day_en);
    v_tenant_active := CASE
      WHEN v_tenant_day IS NULL THEN true
      WHEN lower(COALESCE(v_tenant_day ->> 'active', 'true')) = 'false' THEN false
      ELSE true
    END;
    v_open := COALESCE(v_tenant_day ->> 'open', v_tenant_day ->> 'start', '08:00');
    v_close := COALESCE(v_tenant_day ->> 'close', v_tenant_day ->> 'end', '20:00');

    IF NOT v_tenant_active THEN
      RAISE EXCEPTION 'Nao e possivel configurar escala na % porque a barbearia esta fechada nesse dia', v_day_pt
        USING ERRCODE = '22023';
    END IF;

    IF v_professional_start::TIME >= v_professional_end::TIME THEN
      RAISE EXCEPTION 'A escala de % possui entrada igual ou posterior a saida', v_day_pt
        USING ERRCODE = '22023';
    END IF;

    IF v_open::TIME >= v_close::TIME THEN
      RAISE EXCEPTION 'O expediente da barbearia na % e invalido', v_day_pt
        USING ERRCODE = '22023';
    END IF;

    IF v_professional_start::TIME < v_open::TIME
       OR v_professional_end::TIME > v_close::TIME THEN
      RAISE EXCEPTION 'A escala de % deve ficar entre % e %', v_day_pt, v_open, v_close
        USING ERRCODE = '22023';
    END IF;

    IF (v_break_start IS NULL) <> (v_break_end IS NULL) THEN
      RAISE EXCEPTION 'O intervalo da % precisa informar inicio e fim', v_day_pt
        USING ERRCODE = '22023';
    END IF;

    IF v_break_start IS NOT NULL AND v_break_end IS NOT NULL THEN
      IF v_break_start::TIME >= v_break_end::TIME
         OR v_break_start::TIME < v_professional_start::TIME
         OR v_break_end::TIME > v_professional_end::TIME THEN
        RAISE EXCEPTION 'O intervalo da % deve ficar dentro da escala do profissional', v_day_pt
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION private.validate_professional_schedule_boundaries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM private.assert_professional_schedule_within_tenant(NEW.tenant_id, NEW.weekly_schedule);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_professional_schedule_boundaries ON public.professionals;
CREATE TRIGGER trg_validate_professional_schedule_boundaries
  BEFORE INSERT OR UPDATE OF tenant_id, weekly_schedule
  ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_professional_schedule_boundaries();

CREATE OR REPLACE FUNCTION private.validate_tenant_business_hours_boundaries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_professional RECORD;
BEGIN
  FOR v_professional IN
    SELECT p.tenant_id, p.weekly_schedule
    FROM public.professionals p
    WHERE p.tenant_id = NEW.id
      AND p.deleted_at IS NULL
  LOOP
    PERFORM private.assert_professional_schedule_within_tenant(
      v_professional.tenant_id,
      v_professional.weekly_schedule,
      NEW.business_hours
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_tenant_business_hours_boundaries ON public.tenants;
CREATE TRIGGER trg_validate_tenant_business_hours_boundaries
  BEFORE UPDATE OF business_hours
  ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_tenant_business_hours_boundaries();

CREATE OR REPLACE FUNCTION private.validate_appointment_schedule_boundaries()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tenant RECORD;
  v_professional RECORD;
  v_business_day JSONB;
  v_professional_day JSONB;
  v_day_en TEXT;
  v_day_pt TEXT;
  v_local_start TIMESTAMP;
  v_local_end TIMESTAMP;
  v_open TIME;
  v_close TIME;
  v_professional_start TIME;
  v_professional_end TIME;
  v_break_start TIME;
  v_break_end TIME;
  v_tenant_active BOOLEAN;
  v_professional_active BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.professional_id IS NOT DISTINCT FROM OLD.professional_id
     AND NEW.service_id IS NOT DISTINCT FROM OLD.service_id
     AND NEW.start_time IS NOT DISTINCT FROM OLD.start_time
     AND NEW.end_time IS NOT DISTINCT FROM OLD.end_time
     AND NEW.is_fitting IS NOT DISTINCT FROM OLD.is_fitting THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_fitting, false)
     OR lower(COALESCE(NEW.status, '')) IN ('cancelled', 'canceled', 'cancelado') THEN
    RETURN NEW;
  END IF;

  SELECT t.timezone, t.business_hours
    INTO v_tenant
  FROM public.tenants t
  WHERE t.id = NEW.tenant_id;

  SELECT p.weekly_schedule
    INTO v_professional
  FROM public.professionals p
  WHERE p.id = NEW.professional_id
    AND p.tenant_id = NEW.tenant_id;

  IF v_tenant.timezone IS NULL OR v_tenant.business_hours IS NULL OR v_professional.weekly_schedule IS NULL THEN
    RETURN NEW;
  END IF;

  v_local_start := NEW.start_time AT TIME ZONE v_tenant.timezone;
  v_local_end := NEW.end_time AT TIME ZONE v_tenant.timezone;
  v_day_en := (ARRAY['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])[extract(dow from v_local_start)::INTEGER + 1];
  v_day_pt := (ARRAY['domingo','segunda','terca','quarta','quinta','sexta','sabado'])[extract(dow from v_local_start)::INTEGER + 1];
  v_business_day := COALESCE(v_tenant.business_hours -> v_day_pt, v_tenant.business_hours -> v_day_en);
  v_professional_day := COALESCE(v_professional.weekly_schedule -> v_day_en, v_professional.weekly_schedule -> v_day_pt);

  v_tenant_active := CASE
    WHEN v_business_day IS NULL THEN true
    WHEN lower(COALESCE(v_business_day ->> 'active', 'true')) = 'false' THEN false
    ELSE true
  END;
  v_open := COALESCE((v_business_day ->> 'open')::TIME, (v_business_day ->> 'start')::TIME, '08:00'::TIME);
  v_close := COALESCE((v_business_day ->> 'close')::TIME, (v_business_day ->> 'end')::TIME, '20:00'::TIME);

  IF NOT v_tenant_active OR v_local_start::TIME < v_open OR v_local_start::TIME >= v_close THEN
    RAISE EXCEPTION 'O horario deve iniciar dentro do expediente da barbearia (% - %)', v_open, v_close
      USING ERRCODE = '22023';
  END IF;

  IF v_professional_day IS NULL OR jsonb_typeof(v_professional_day) <> 'object' THEN
    RETURN NEW;
  END IF;

  v_professional_active := lower(COALESCE(v_professional_day ->> 'active', 'true')) <> 'false';
  IF NOT v_professional_active THEN
    RETURN NEW;
  END IF;

  v_professional_start := COALESCE((v_professional_day ->> 'start')::TIME, (v_professional_day ->> 'open')::TIME);
  v_professional_end := COALESCE((v_professional_day ->> 'end')::TIME, (v_professional_day ->> 'close')::TIME);
  IF v_professional_start IS NULL OR v_professional_end IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_local_start::TIME < v_professional_start OR v_local_start::TIME >= v_professional_end THEN
    RAISE EXCEPTION 'O horario deve iniciar dentro da escala do profissional (% - %)', v_professional_start, v_professional_end
      USING ERRCODE = '22023';
  END IF;

  v_break_start := (v_professional_day ->> 'break_start')::TIME;
  v_break_end := (v_professional_day ->> 'break_end')::TIME;
  IF v_break_start IS NOT NULL AND v_break_end IS NOT NULL
     AND v_local_start::TIME < v_break_end
     AND v_local_end::TIME > v_break_start THEN
    RAISE EXCEPTION 'O horario escolhido coincide com o intervalo do profissional'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_appointment_schedule_boundaries ON public.appointments;
CREATE TRIGGER trg_validate_appointment_schedule_boundaries
  BEFORE INSERT OR UPDATE OF tenant_id, professional_id, service_id, start_time, end_time, status, is_fitting
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION private.validate_appointment_schedule_boundaries();
