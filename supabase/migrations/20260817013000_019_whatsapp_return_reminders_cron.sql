-- Migration: 20260817013000_019_whatsapp_return_reminders_cron.sql
-- Description: Configurar agendamento via pg_cron para disparo automatizado de lembretes de retorno (/process-return-reminders)

-- 1. Desagendar qualquer job anterior com o mesmo nome para garantir idempotência
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-whatsapp-return-reminders') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-whatsapp-return-reminders';
  END IF;
END $$;

-- 2. Agendar a rotina diária às 13:00 UTC (10:00 BRT) para envio dos lembretes de retorno aos clientes
SELECT cron.schedule(
  'process-whatsapp-return-reminders',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://selvxobcjbkligxighlp.supabase.co/functions/v1/whatsapp-integration/process-return-reminders',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'x-db-trigger-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1)
    )::jsonb,
    body := '{}'::jsonb
  );
  $$
);
