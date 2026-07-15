-- =========================================================================
-- MIGRAÇÃO SQL: Integração Real com a Evolution API Go
-- =========================================================================

-- 1. Habilitar extensões necessárias
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2. Ajustes na tabela public.evolution_api_instances
-- Remover constraints antigas de reminder_minutes se existirem para evitar conflitos ao mudar para horas
alter table public.evolution_api_instances drop constraint if exists check_reminder_minutes_range;

do $$
begin
    -- Renomear reminder_minutes para reminder_hours se existir
    if exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
          and table_name = 'evolution_api_instances' 
          and column_name = 'reminder_minutes'
    ) then
        alter table public.evolution_api_instances rename column reminder_minutes to reminder_hours;
    end if;

    -- Adicionar reminder_hours se não existir
    if not exists (
        select 1 from information_schema.columns 
        where table_schema = 'public' 
          and table_name = 'evolution_api_instances' 
          and column_name = 'reminder_hours'
    ) then
        alter table public.evolution_api_instances add column reminder_hours integer default 2 not null;
    end if;
end
$$;

-- Atualizar registros existentes para valores válidos (entre 1 e 24 horas)
-- Se o valor for inválido (por exemplo, minutos antigos como 30, 60, 120), definimos o padrão de 2 horas.
update public.evolution_api_instances 
set reminder_hours = 2 
where reminder_hours < 1 or reminder_hours > 24;

-- Garantir que reminder_hours padrão seja 2
alter table public.evolution_api_instances alter column reminder_hours set default 2;

-- Adicionar restrição check para garantir que reminder_hours esteja entre 1 e 24
alter table public.evolution_api_instances drop constraint if exists check_reminder_hours_range;
alter table public.evolution_api_instances add constraint check_reminder_hours_range check (reminder_hours >= 1 and reminder_hours <= 24);

-- 3. Ajustes na tabela public.appointments
alter table public.appointments add column if not exists reminder_sent boolean default false not null;

-- 4. Criar Índice Parcial de Performance para Lembretes Pendentes
create index if not exists idx_appointments_reminder_pending 
on public.appointments (start_time, tenant_id) 
where reminder_sent = false and status = 'confirmed';

-- 5. Função da Trigger Assíncrona para Disparo HTTP de Notificações
create or replace function public.fn_appointment_whatsapp_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_payload jsonb;
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_db_trigger_secret' limit 1);
begin
  -- Determinar o tipo de evento com base na operação e status
  if TG_OP = 'INSERT' then
    if new.status = 'confirmed' then
      v_event := 'appointment_created';
    else
      return new;
    end if;
  elsif TG_OP = 'UPDATE' then
    if old.status != 'confirmed' and new.status = 'confirmed' then
      v_event := 'appointment_created';
    elsif old.status != 'canceled' and new.status = 'canceled' then
      v_event := 'appointment_cancelled';
    else
      return new;
    end if;
  else
    return new;
  end if;

  -- Montar o payload JSON contendo as referências necessárias
  v_payload := jsonb_build_object(
    'event', v_event,
    'appointment_id', new.id,
    'tenant_id', new.tenant_id
  );

  -- Realizar disparo assíncrono via pg_net para a Edge Function
  perform net.http_post(
    url := 'https://boakqstrdfqmsrwnjore.supabase.co/functions/v1/whatsapp-integration/send-notification',
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-db-trigger-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.fn_appointment_whatsapp_trigger() from public;

-- Criar a trigger associada à tabela public.appointments
drop trigger if exists trg_appointment_whatsapp on public.appointments;
create trigger trg_appointment_whatsapp
  after insert or update of status
  on public.appointments
  for each row
  execute function public.fn_appointment_whatsapp_trigger();

-- 6. Orquestrar Lembretes Periódicos com pg_cron
-- Limpar agendamentos anteriores com o mesmo nome para evitar duplicatas
select cron.unschedule(jobid) from cron.job where jobname = 'process-whatsapp-reminders';

-- Agendar a execução a cada 15 minutos chamando a rota /process-reminders
select cron.schedule(
  'process-whatsapp-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://boakqstrdfqmsrwnjore.supabase.co/functions/v1/whatsapp-integration/process-reminders',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'x-db-trigger-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_db_trigger_secret' limit 1)
    )::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 7. Trigger para gerenciar instâncias de WhatsApp (criação, conexão, desconexão)
create or replace function public.fn_evolution_api_instance_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_payload jsonb;
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_db_trigger_secret' limit 1);
begin
  if TG_OP = 'INSERT' then
    v_action := 'create';
  elsif TG_OP = 'UPDATE' then
    if old.status != 'pairing' and new.status = 'pairing' then
      v_action := 'connect';
    elsif old.status != 'disconnected' and new.status = 'disconnected' then
      v_action := 'disconnect';
    else
      return new;
    end if;
  else
    return new;
  end if;

  v_payload := jsonb_build_object(
    'action', v_action,
    'instance_id', new.id,
    'instance_name', new.instance_name,
    'tenant_id', new.tenant_id
  );

  perform net.http_post(
    url := 'https://boakqstrdfqmsrwnjore.supabase.co/functions/v1/whatsapp-integration/manage-instance',
    body := v_payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-db-trigger-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

revoke all on function public.fn_evolution_api_instance_trigger() from public;

drop trigger if exists trg_evolution_api_instance on public.evolution_api_instances;
create trigger trg_evolution_api_instance
  after insert or update of status
  on public.evolution_api_instances
  for each row
  execute function public.fn_evolution_api_instance_trigger();
