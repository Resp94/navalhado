-- =============================================================================
-- Migration 051: WhatsApp Boas-Vindas de Balcão e Templates da Equipe Personalizáveis
-- =============================================================================

-- 1. Adicionar colunas de rastreamento de origem e disparo de boas-vindas na tabela public.customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS registration_origin TEXT NOT NULL DEFAULT 'balcao',
  ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Restrição de valores permitidos para registration_origin
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_registration_origin_check'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_registration_origin_check
      CHECK (registration_origin IN ('balcao', 'online', 'importacao'));
  END IF;
END $$;

-- 2. Adicionar novas colunas de templates e switches na tabela public.whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS template_welcome_balcao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS send_welcome_balcao BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS template_professional_created TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS template_professional_rescheduled TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS template_professional_cancelled TEXT DEFAULT NULL;

-- Restrições de limite de caracteres (2.000 caracteres por template)
ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_template_welcome_balcao_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_template_welcome_balcao_check
  CHECK (template_welcome_balcao IS NULL OR LENGTH(template_welcome_balcao) <= 2000);

ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_template_prof_created_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_template_prof_created_check
  CHECK (template_professional_created IS NULL OR LENGTH(template_professional_created) <= 2000);

ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_template_prof_rescheduled_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_template_prof_rescheduled_check
  CHECK (template_professional_rescheduled IS NULL OR LENGTH(template_professional_rescheduled) <= 2000);

ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_template_prof_cancelled_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_template_prof_cancelled_check
  CHECK (template_professional_cancelled IS NULL OR LENGTH(template_professional_cancelled) <= 2000);

-- 3. Conceder permissões para o papel authenticated
GRANT SELECT, UPDATE ON public.whatsapp_instances TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.customers TO authenticated;

-- 4. Função e trigger para disparo exclusivo de boas-vindas no cadastro de balcão
CREATE OR REPLACE FUNCTION public.fn_customer_welcome_balcao_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb;
  v_secret text := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1);
BEGIN
  -- Disparar exclusivamente no INSERT de cliente vindo de balcão com telefone válido e sem welcome_sent_at anterior
  IF TG_OP = 'INSERT' AND NEW.registration_origin = 'balcao' AND NEW.phone IS NOT NULL AND NEW.phone != '' AND NEW.welcome_sent_at IS NULL THEN
    v_payload := jsonb_build_object(
      'event', 'customer_welcome_balcao',
      'event_type', 'customer_welcome_balcao',
      'customer_id', NEW.id,
      'tenant_id', NEW.tenant_id
    );

    PERFORM net.http_post(
      url := 'https://selvxobcjbkligxighlp.supabase.co/functions/v1/whatsapp-integration/send-notification',
      body := v_payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-db-trigger-secret', v_secret
      ),
      timeout_milliseconds := 5000
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_customer_welcome_balcao_trigger() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_customer_welcome_balcao ON public.customers;

CREATE TRIGGER trg_customer_welcome_balcao
  AFTER INSERT
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_customer_welcome_balcao_trigger();
