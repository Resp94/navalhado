begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'process-whatsapp-welcome-outbox'
  ),
  'welcome outbox worker job exists'
);

select is(
  (
    select schedule
    from cron.job
    where jobname = 'process-whatsapp-welcome-outbox'
  ),
  '* * * * *',
  'welcome outbox worker runs every minute'
);

select ok(
  position(
    '/functions/v1/whatsapp-integration/process-welcome-outbox'
    in coalesce((
      select command
      from cron.job
      where jobname = 'process-whatsapp-welcome-outbox'
    ), '')
  ) > 0,
  'welcome outbox job invokes the worker route'
);

select ok(
  position(
    'whatsapp_db_trigger_secret'
    in coalesce((
      select command
      from cron.job
      where jobname = 'process-whatsapp-welcome-outbox'
    ), '')
  ) > 0,
  'welcome outbox job reads the trigger secret from Vault'
);

select * from finish();
rollback;
