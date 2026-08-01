-- Ticket 02: modelo neutro de Instância WhatsApp e idempotência.
-- A tabela Evolution permanece intacta nesta etapa para não quebrar consumidores legados.

create table if not exists public.whatsapp_instances (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    provider text not null default 'uazapi',
    instance_name text not null,
    instance_token text not null,
    qr_code text,
    status text not null default 'disconnected',
    send_confirmation boolean not null default true,
    send_reminders boolean not null default true,
    send_cancellation boolean not null default true,
    reminder_hours integer not null default 2,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now()),
    constraint whatsapp_instances_provider_check check (provider = 'uazapi'),
    constraint whatsapp_instances_status_check check (
      status in ('connected', 'connecting', 'disconnected', 'hibernated')
    ),
    constraint whatsapp_instances_reminder_hours_check check (
      reminder_hours between 1 and 24
    ),
    constraint whatsapp_instances_tenant_id_key unique (tenant_id),
    constraint whatsapp_instances_instance_name_key unique (instance_name),
    constraint whatsapp_instances_id_tenant_key unique (id, tenant_id)
);

create index if not exists whatsapp_instances_provider_status_idx
on public.whatsapp_instances (provider, status);

-- A chave composta permite que a tabela de idempotência valide o tenant
-- simultaneamente com a instância ou o agendamento referenciado.
create unique index if not exists appointments_id_tenant_uidx
on public.appointments (id, tenant_id);

create table if not exists public.whatsapp_message_idempotency (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    whatsapp_instance_id uuid,
    direction text not null,
    event_type text not null,
    idempotency_key text not null,
    external_message_id text,
    appointment_id uuid,
    reminder_window text,
    status text not null default 'processing',
    -- Número de tentativas já executadas; a reserva inicial começa em zero.
    attempt_count integer not null default 0,
    last_error text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone not null default timezone('utc'::text, now()),
    updated_at timestamp with time zone not null default timezone('utc'::text, now()),
    constraint whatsapp_message_idempotency_direction_check check (
      direction in ('inbound', 'outbound')
    ),
    constraint whatsapp_message_idempotency_status_check check (
      status in ('processing', 'succeeded', 'failed')
    ),
    constraint whatsapp_message_idempotency_attempt_count_check check (
      attempt_count between 0 and 3
    ),
    constraint whatsapp_message_idempotency_reminder_window_required_check check (
      event_type <> 'appointment_reminder'
      or reminder_window is not null
    ),
    constraint whatsapp_message_idempotency_instance_tenant_fkey
      foreign key (whatsapp_instance_id, tenant_id)
      references public.whatsapp_instances(id, tenant_id)
      on delete set null (whatsapp_instance_id),
    constraint whatsapp_message_idempotency_appointment_tenant_fkey
      foreign key (appointment_id, tenant_id)
      references public.appointments(id, tenant_id)
      on delete set null (appointment_id),
    constraint whatsapp_message_idempotency_key unique (
      tenant_id, direction, idempotency_key
    )
);

create index if not exists whatsapp_message_idempotency_appointment_idx
on public.whatsapp_message_idempotency (tenant_id, appointment_id, event_type);

create index if not exists whatsapp_message_idempotency_external_message_idx
on public.whatsapp_message_idempotency (tenant_id, external_message_id)
where external_message_id is not null;

create unique index if not exists whatsapp_message_idempotency_inbound_external_uidx
on public.whatsapp_message_idempotency (tenant_id, external_message_id)
where direction = 'inbound' and external_message_id is not null;

create unique index if not exists whatsapp_message_idempotency_appointment_event_uidx
on public.whatsapp_message_idempotency (tenant_id, appointment_id, event_type)
where direction = 'outbound'
  and appointment_id is not null
  and event_type in ('appointment_created', 'appointment_cancelled');

create unique index if not exists whatsapp_message_idempotency_reminder_window_uidx
on public.whatsapp_message_idempotency (tenant_id, appointment_id, event_type, reminder_window)
where direction = 'outbound'
  and appointment_id is not null
  and event_type = 'appointment_reminder'
  and reminder_window is not null;

alter table public.whatsapp_instances enable row level security;
alter table public.whatsapp_instances force row level security;
alter table public.whatsapp_message_idempotency enable row level security;
alter table public.whatsapp_message_idempotency force row level security;

create policy whatsapp_instances_select_policy
on public.whatsapp_instances
for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) = 'gerente'
  )
);

create policy whatsapp_instances_update_policy
on public.whatsapp_instances
for update to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) = 'gerente'
  )
)
with check (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) = 'gerente'
  )
);

create policy whatsapp_message_idempotency_select_policy
on public.whatsapp_message_idempotency
for select to authenticated
using (
  (select private.is_saas_admin())
  or (
    tenant_id = (select private.get_auth_tenant_id())
    and (select private.get_auth_role()) = 'gerente'
  )
);

-- O navegador pode consultar a integração e seus diagnósticos sem ler credenciais.
-- Escritas e tokens permanecem exclusivas do backend/service_role.
revoke all on table public.whatsapp_instances from anon, authenticated;
grant select (
  id,
  tenant_id,
  provider,
  instance_name,
  qr_code,
  status,
  send_confirmation,
  send_reminders,
  send_cancellation,
  reminder_hours,
  created_at,
  updated_at
) on public.whatsapp_instances to authenticated;
grant update (
  qr_code,
  status,
  send_confirmation,
  send_reminders,
  send_cancellation,
  reminder_hours,
  updated_at
) on public.whatsapp_instances to authenticated;

revoke all on table public.whatsapp_message_idempotency from anon, authenticated;
grant select (
  id,
  tenant_id,
  whatsapp_instance_id,
  direction,
  event_type,
  status,
  attempt_count,
  completed_at,
  created_at,
  updated_at
) on public.whatsapp_message_idempotency to authenticated;
