-- Migration 082: Protege o histórico operacional de no-show sem permitir movimentos financeiros
-- novos em comandas vinculadas a atendimentos cancelados ou não comparecidos.

CREATE OR REPLACE FUNCTION public.fn_auto_cancel_comanda_on_appointment_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status IN ('canceled', 'no_show')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.comandas
    SET status = 'cancelada',
        closed_at = pg_catalog.timezone('utc'::text, pg_catalog.now()),
        updated_at = pg_catalog.timezone('utc'::text, pg_catalog.now())
    WHERE appointment_id = NEW.id
      AND status = 'aberta';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_cancel_comanda_on_appointment_cancel ON public.appointments;
CREATE TRIGGER trg_auto_cancel_comanda_on_appointment_cancel
  AFTER UPDATE OF status
  ON public.appointments
  FOR EACH ROW
  WHEN (
    NEW.status IN ('canceled', 'no_show')
    AND OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.fn_auto_cancel_comanda_on_appointment_cancel();

CREATE OR REPLACE FUNCTION private.prevent_payment_for_ineligible_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_appointment_status text;
BEGIN
  SELECT a.status
    INTO v_appointment_status
  FROM public.comandas c
  JOIN public.appointments a ON a.id = c.appointment_id
  WHERE c.id = NEW.comanda_id;

  IF v_appointment_status IN ('canceled', 'no_show') THEN
    RAISE EXCEPTION 'Não é permitido registrar pagamento para atendimento %.', v_appointment_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.prevent_closing_ineligible_appointment_comanda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_appointment_status text;
BEGIN
  IF NEW.status = 'fechada' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT a.status
      INTO v_appointment_status
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id;

    IF v_appointment_status IN ('canceled', 'no_show') THEN
      RAISE EXCEPTION 'Não é permitido fechar comanda de atendimento %.', v_appointment_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_payment_for_ineligible_appointment ON public.comanda_pagamentos;
CREATE TRIGGER trg_prevent_payment_for_ineligible_appointment
  BEFORE INSERT OR UPDATE
  ON public.comanda_pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_payment_for_ineligible_appointment();

DROP TRIGGER IF EXISTS trg_prevent_closing_ineligible_appointment_comanda ON public.comandas;
CREATE TRIGGER trg_prevent_closing_ineligible_appointment_comanda
  BEFORE UPDATE OF status
  ON public.comandas
  FOR EACH ROW
  EXECUTE FUNCTION private.prevent_closing_ineligible_appointment_comanda();

REVOKE ALL ON FUNCTION public.fn_auto_cancel_comanda_on_appointment_cancel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_payment_for_ineligible_appointment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_closing_ineligible_appointment_comanda() FROM PUBLIC, anon, authenticated;
