-- Agenda o worker durável de boas-vindas de balcão.
-- O job é idempotente e usa o segredo armazenado no Supabase Vault.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'process-whatsapp-welcome-outbox'
  ) THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'process-whatsapp-welcome-outbox';
  END IF;
END
$$;

SELECT cron.schedule(
  'process-whatsapp-welcome-outbox',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://selvxobcjbkligxighlp.supabase.co/functions/v1/whatsapp-integration/process-welcome-outbox',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'x-db-trigger-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'whatsapp_db_trigger_secret'
        LIMIT 1
      )
    )::jsonb,
    body := jsonb_build_object('limit', 25),
    timeout_milliseconds := 15000
  );
  $$
);
