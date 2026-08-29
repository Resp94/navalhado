-- Mantém os cron jobs de WhatsApp apontando para o próprio projeto.
-- A URL é resolvida pelo Vault para que a mesma migration seja portátil
-- entre DEV e PROD.

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'project_url'
  ) THEN
    RAISE EXCEPTION 'Vault secret project_url is required';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname IN (
    'process-whatsapp-reminders',
    'process-whatsapp-return-reminders',
    'process-whatsapp-welcome-outbox'
  );

  PERFORM cron.schedule(
    'process-whatsapp-reminders',
    '*/15 * * * *',
    $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1)
        || '/functions/v1/whatsapp-integration/process-reminders',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'x-db-trigger-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1)
      )::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
    $job$
  );

  PERFORM cron.schedule(
    'process-whatsapp-return-reminders',
    '0 13 * * *',
    $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1)
        || '/functions/v1/whatsapp-integration/process-return-reminders',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'x-db-trigger-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1)
      )::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
    $job$
  );

  PERFORM cron.schedule(
    'process-whatsapp-welcome-outbox',
    '* * * * *',
    $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1)
        || '/functions/v1/whatsapp-integration/process-welcome-outbox',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'x-db-trigger-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1)
      )::jsonb,
      body := jsonb_build_object('limit', 25),
      timeout_milliseconds := 15000
    );
    $job$
  );
END;
$migration$;
