-- Adiciona colunas de configuracao de notificacao no WhatsApp a tabela evolution_api_instances
alter table public.evolution_api_instances
add column send_confirmation boolean default true not null,
add column send_reminders boolean default true not null,
add column reminder_hours integer default 2 not null,
add column send_cancellation boolean default true not null;

-- Adiciona a restricao check para garantir que reminder_hours esteja entre 1 e 24
alter table public.evolution_api_instances
add constraint check_reminder_hours_range check (reminder_hours >= 1 and reminder_hours <= 24);
