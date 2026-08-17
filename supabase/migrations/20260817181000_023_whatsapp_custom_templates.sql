-- =========================================================================
-- MIGRAÇÃO SQL: 023_whatsapp_custom_templates.sql
-- Personalização de Templates de Notificação WhatsApp com Fallback Seguro
-- =========================================================================

-- 1. Adicionar colunas dedicadas de template na tabela public.whatsapp_instances
alter table public.whatsapp_instances
  add column if not exists template_confirmation text,
  add column if not exists template_reschedule text,
  add column if not exists template_cancellation text,
  add column if not exists template_reminder text,
  add column if not exists template_first_contact text;

-- 2. Adicionar restrições de tamanho máximo (limite seguro de 2.000 caracteres por template)
alter table public.whatsapp_instances drop constraint if exists whatsapp_instances_template_confirmation_check;
alter table public.whatsapp_instances add constraint whatsapp_instances_template_confirmation_check
  check (template_confirmation is null or length(template_confirmation) <= 2000);

alter table public.whatsapp_instances drop constraint if exists whatsapp_instances_template_reschedule_check;
alter table public.whatsapp_instances add constraint whatsapp_instances_template_reschedule_check
  check (template_reschedule is null or length(template_reschedule) <= 2000);

alter table public.whatsapp_instances drop constraint if exists whatsapp_instances_template_cancellation_check;
alter table public.whatsapp_instances add constraint whatsapp_instances_template_cancellation_check
  check (template_cancellation is null or length(template_cancellation) <= 2000);

alter table public.whatsapp_instances drop constraint if exists whatsapp_instances_template_reminder_check;
alter table public.whatsapp_instances add constraint whatsapp_instances_template_reminder_check
  check (template_reminder is null or length(template_reminder) <= 2000);

alter table public.whatsapp_instances drop constraint if exists whatsapp_instances_template_first_contact_check;
alter table public.whatsapp_instances add constraint whatsapp_instances_template_first_contact_check
  check (template_first_contact is null or length(template_first_contact) <= 2000);

-- 3. Atualizar concessões granulares de colunas para o papel authenticated
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
  template_confirmation,
  template_reschedule,
  template_cancellation,
  template_reminder,
  template_first_contact,
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
  template_confirmation,
  template_reschedule,
  template_cancellation,
  template_reminder,
  template_first_contact,
  updated_at
) on public.whatsapp_instances to authenticated;
