-- =========================================================================
-- MIGRAÇÃO SQL: Notificações em Tempo Real e Triggers Automatizados
-- =========================================================================

-- 1. Criação da Tabela de Notificações
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    professional_id uuid references public.professionals(id) on delete cascade,
    type text not null,
    title text not null,
    message text not null,
    read boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Índices de Performance Recomendados (Supabase Best Practices)
create index if not exists notifications_tenant_id_idx on public.notifications (tenant_id);
create index if not exists notifications_professional_id_idx on public.notifications (professional_id);
create index if not exists notifications_unread_idx on public.notifications (tenant_id, professional_id) where read = false;

-- 3. Habilitar Row Level Security (RLS)
alter table public.notifications enable row level security;

-- 4. Criar Políticas de RLS Otimizadas (Subqueries para Cache)
create policy notifications_select_policy on public.notifications
    for select to authenticated
    using (
      (select private.is_saas_admin()) or (
        tenant_id = (select private.get_auth_tenant_id()) and (
          (select private.get_auth_role()) = 'gerente' or
          professional_id in (select id from public.professionals where user_id = (select auth.uid()))
        )
      )
    );

create policy notifications_update_policy on public.notifications
    for update to authenticated
    using (
      (select private.is_saas_admin()) or (
        tenant_id = (select private.get_auth_tenant_id()) and (
          (select private.get_auth_role()) = 'gerente' or
          professional_id in (select id from public.professionals where user_id = (select auth.uid()))
        )
      )
    );

create policy notifications_delete_policy on public.notifications
    for delete to authenticated
    using (
      (select private.is_saas_admin()) or (
        tenant_id = (select private.get_auth_tenant_id()) and 
        (select private.get_auth_role()) = 'gerente'
      )
    );

-- 5. Habilitar Replicação em Tempo Real no Supabase
alter publication supabase_realtime add table public.notifications;

-- 6. Função de Trigger do Postgres para Notificações Automáticas
create or replace function public.handle_appointment_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
  v_service_name text;
  v_professional_name text;
  v_formatted_time text;
  v_title text;
  v_message text;
  v_type text;
begin
  -- Buscar nomes relacionados usando qualificadores de schema explícitos
  select name into v_customer_name from public.customers where id = new.customer_id;
  select name into v_service_name from public.services where id = new.service_id;
  select name into v_professional_name from public.professionals where id = new.professional_id;
  
  -- Formatar data/hora no padrão brasileiro (America/Sao_Paulo)
  v_formatted_time := to_char(new.start_time at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI');

  -- Caso 1: Novo Agendamento (INSERT)
  if tg_op = 'INSERT' then
    v_type := 'appointment_created';
    v_title := 'Novo Agendamento';
    v_message := v_customer_name || ' agendou ' || v_service_name || ' com ' || v_professional_name || ' para ' || v_formatted_time || '.';
    
    -- Notificação para o Gerente
    insert into public.notifications (tenant_id, professional_id, type, title, message)
    values (new.tenant_id, null, v_type, v_title, v_message);
    
    -- Notificação para o Barbeiro
    insert into public.notifications (tenant_id, professional_id, type, title, message)
    values (new.tenant_id, new.professional_id, v_type, v_title, v_message);

  -- Caso 2: Atualização (UPDATE)
  elsif tg_op = 'UPDATE' then
    -- Subcaso A: Cancelamento
    if new.status = 'canceled' and old.status <> 'canceled' then
      v_type := 'appointment_canceled';
      v_title := 'Agendamento Cancelado';
      v_message := 'O agendamento de ' || v_customer_name || ' (' || v_service_name || ') em ' || v_formatted_time || ' foi cancelado.';
      
      -- Notificação para o Gerente
      insert into public.notifications (tenant_id, professional_id, type, title, message)
      values (new.tenant_id, null, v_type, v_title, v_message);
      
      -- Notificação para o Barbeiro
      insert into public.notifications (tenant_id, professional_id, type, title, message)
      values (new.tenant_id, new.professional_id, v_type, v_title, v_message);
      
    -- Subcaso B: Reagendamento (mudança do horário de início)
    elsif new.start_time <> old.start_time then
      v_type := 'appointment_rescheduled';
      v_title := 'Agendamento Reagendado';
      v_message := 'O agendamento de ' || v_customer_name || ' com ' || v_professional_name || ' foi alterado para ' || v_formatted_time || '.';
      
      -- Notificação para o Gerente
      insert into public.notifications (tenant_id, professional_id, type, title, message)
      values (new.tenant_id, null, v_type, v_title, v_message);
      
      -- Notificação para o Barbeiro
      insert into public.notifications (tenant_id, professional_id, type, title, message)
      values (new.tenant_id, new.professional_id, v_type, v_title, v_message);
    end if;
  end if;
  
  return new;
end;
$$;

-- 7. Criação do Trigger associado à tabela public.appointments
create or replace trigger appointment_notification_trigger
after insert or update on public.appointments
for each row
execute function public.handle_appointment_notification();
