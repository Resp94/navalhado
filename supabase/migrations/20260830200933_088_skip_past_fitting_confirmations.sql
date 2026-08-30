-- Suprime confirmações WhatsApp de encaixes já iniciados no passado.
-- O encaixe permanece na agenda; somente o evento de confirmação é bloqueado.

CREATE OR REPLACE FUNCTION private.fn_appointment_whatsapp_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text;
  v_suppression_reason constant text := 'past_fitting_confirmation';
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

  IF v_event = 'appointment_created'
     AND COALESCE(NEW.is_fitting, false)
     AND NEW.start_time < now() THEN
    INSERT INTO public.audit_logs (
      tenant_id,
      action,
      resource,
      details
    ) VALUES (
      NEW.tenant_id,
      'whatsapp_confirmation_suppressed',
      'appointment',
      jsonb_build_object(
        'appointment_id', NEW.id,
        'event_type', v_event,
        'reason', v_suppression_reason
      )
    );
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
