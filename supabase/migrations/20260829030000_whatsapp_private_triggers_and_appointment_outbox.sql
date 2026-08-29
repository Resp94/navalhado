-- Move gatilhos privilegiados para schema privado e elimina HTTP fire-and-forget
-- da origem dos eventos de agendamento.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.fn_customer_welcome_balcao_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.registration_origin = 'balcao'
     AND NEW.phone IS NOT NULL
     AND btrim(NEW.phone) <> ''
     AND NEW.welcome_sent_at IS NULL THEN
    INSERT INTO public.whatsapp_message_outbox (
      tenant_id,
      customer_id,
      event_type,
      idempotency_key,
      payload
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      'customer_welcome_balcao',
      'customer:' || NEW.id::text || ':customer_welcome_balcao',
      jsonb_build_object(
        'event', 'customer_welcome_balcao',
        'event_type', 'customer_welcome_balcao',
        'customer_id', NEW.id,
        'tenant_id', NEW.tenant_id
      )
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.fn_appointment_whatsapp_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'confirmed' THEN
      v_event := 'appointment_created';
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
      v_event := 'appointment_created';
    ELSIF OLD.status != 'canceled' AND NEW.status = 'canceled' THEN
      v_event := 'appointment_cancelled';
    ELSIF OLD.status = 'confirmed' AND NEW.status = 'confirmed' AND (
      OLD.start_time IS DISTINCT FROM NEW.start_time OR
      OLD.service_id IS DISTINCT FROM NEW.service_id OR
      OLD.professional_id IS DISTINCT FROM NEW.professional_id
    ) THEN
      v_event := 'appointment_rescheduled';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.whatsapp_message_outbox (
      tenant_id,
      customer_id,
      event_type,
      idempotency_key,
      payload
    ) VALUES (
      NEW.tenant_id,
      NEW.customer_id,
      v_event,
      'appointment:' || NEW.id::text || ':' || v_event,
      jsonb_build_object(
        'event', v_event,
        'event_type', v_event,
        'appointment_id', NEW.id,
        'tenant_id', NEW.tenant_id
      )
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_welcome_balcao ON public.customers;
CREATE TRIGGER trg_customer_welcome_balcao
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION private.fn_customer_welcome_balcao_trigger();

DROP TRIGGER IF EXISTS trg_appointment_whatsapp ON public.appointments;
CREATE TRIGGER trg_appointment_whatsapp
  AFTER INSERT OR UPDATE OF status, start_time, service_id, professional_id
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION private.fn_appointment_whatsapp_trigger();

DROP FUNCTION IF EXISTS public.fn_customer_welcome_balcao_trigger();
DROP FUNCTION IF EXISTS public.fn_appointment_whatsapp_trigger();

ALTER FUNCTION public.claim_whatsapp_message_outbox(integer) SECURITY INVOKER;
ALTER FUNCTION public.complete_whatsapp_message_outbox(uuid, boolean, text) SECURITY INVOKER;
ALTER FUNCTION public.get_pending_return_reminders(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_pending_return_reminders(uuid) SET search_path = '';

REVOKE ALL ON FUNCTION public.claim_whatsapp_message_outbox(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_whatsapp_message_outbox(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pending_return_reminders(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_message_outbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_whatsapp_message_outbox(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pending_return_reminders(uuid) TO service_role;
