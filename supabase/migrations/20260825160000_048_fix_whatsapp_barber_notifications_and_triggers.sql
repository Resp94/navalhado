-- Migration: 20260825160000_048_fix_whatsapp_barber_notifications_and_triggers.sql
-- Description: Atualização do gatilho trg_appointment_whatsapp e função fn_appointment_whatsapp_trigger para suportar reagendamento e disparo em alterações de status, start_time, service_id e professional_id

CREATE OR REPLACE FUNCTION public.fn_appointment_whatsapp_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text;
  v_payload jsonb;
  v_secret text := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1);
BEGIN
  -- Determinar o tipo de evento com base na operação e status
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

  -- Montar o payload JSON contendo as referências necessárias
  v_payload := jsonb_build_object(
    'event', v_event,
    'event_type', v_event,
    'appointment_id', NEW.id,
    'tenant_id', NEW.tenant_id
  );

  -- Realizar disparo assíncrono via pg_net para a Edge Function
  PERFORM net.http_post(
    url := 'https://selvxobcjbkligxighlp.supabase.co/functions/v1/whatsapp-integration/send-notification',
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-db-trigger-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
END;
$$;

-- Revogar privilégios de execução pública por segurança
REVOKE ALL ON FUNCTION public.fn_appointment_whatsapp_trigger() FROM PUBLIC, anon, authenticated;

-- Recriar trigger trg_appointment_whatsapp incluindo start_time, service_id e professional_id
DROP TRIGGER IF EXISTS trg_appointment_whatsapp ON public.appointments;

CREATE TRIGGER trg_appointment_whatsapp
  AFTER INSERT OR UPDATE OF status, start_time, service_id, professional_id
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_appointment_whatsapp_trigger();
