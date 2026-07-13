-- =========================================================================
-- MIGRAÇÃO SQL: Funções RPC para o Canal de Clientes (Sem Login)
-- Data: 2026-07-13
-- =========================================================================

-- Garantir que o schema public e private existem
create schema if not exists public;
create schema if not exists private;

-- -------------------------------------------------------------------------
-- 1. get_customer_info_by_token
-- -------------------------------------------------------------------------
-- Retorna informações consolidadas do cliente e da barbearia associada
-- se o token de acesso for válido e não estiver expirado.
create or replace function public.get_customer_info_by_token(p_token uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result json;
begin
  select json_build_object(
    'customer_name', c.name,
    'customer_id', c.id,
    'tenant_id', c.tenant_id,
    'tenant_name', t.name,
    'tenant_logo', t.logo_url
  ) into v_result
  from public.customers c
  join public.tenants t on t.id = c.tenant_id
  where c.token_acesso = p_token
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_result is null then
    raise exception 'Token inválido ou expirado.';
  end if;

  return v_result;
end;
$$;

-- -------------------------------------------------------------------------
-- 2. get_customer_appointments_by_token
-- -------------------------------------------------------------------------
-- Retorna a lista de agendamentos realizados pelo cliente correspondente
-- ao token de acesso fornecido.
create or replace function public.get_customer_appointments_by_token(p_token uuid)
returns table(
  appointment_id uuid,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status text,
  payment_status text,
  cancellation_reason text,
  professional_name text,
  professional_id uuid,
  service_name text,
  service_id uuid,
  service_price numeric,
  service_duration integer,
  tenant_name text,
  tenant_id uuid,
  tenant_phone text,
  customer_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  -- Validar token e capturar customer_id
  select c.id into v_customer_id
  from public.customers c
  where c.token_acesso = p_token 
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_customer_id is null then
    raise exception 'Acesso negado. Token inválido ou expirado.';
  end if;

  return query
  select 
    a.id as appointment_id,
    a.start_time,
    a.end_time,
    a.status,
    a.payment_status,
    a.cancellation_reason,
    p.name as professional_name,
    p.id as professional_id,
    s.name as service_name,
    s.id as service_id,
    s.price as service_price,
    s.duration_minutes as service_duration,
    t.name as tenant_name,
    t.id as tenant_id,
    t.phone as tenant_phone,
    c.name as customer_name
  from public.appointments a
  join public.customers c on a.customer_id = c.id
  join public.professionals p on p.id = a.professional_id
  join public.services s on s.id = a.service_id
  join public.tenants t on t.id = a.tenant_id
  where a.customer_id = v_customer_id
  order by a.start_time desc;
end;
$$;

-- -------------------------------------------------------------------------
-- 3. get_services_by_customer_token
-- -------------------------------------------------------------------------
-- Retorna todos os serviços ativos da barbearia (tenant) associada ao token.
create or replace function public.get_services_by_customer_token(p_token uuid)
returns table(
  id uuid,
  name text,
  description text,
  price numeric,
  duration_minutes integer,
  category text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  -- Validar token e capturar tenant_id
  select c.tenant_id into v_tenant_id
  from public.customers c
  where c.token_acesso = p_token 
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_tenant_id is null then
    raise exception 'Acesso negado. Token inválido ou expirado.';
  end if;

  return query
  select 
    s.id, 
    s.name, 
    s.description, 
    s.price, 
    s.duration_minutes, 
    s.category
  from public.services s
  where s.tenant_id = v_tenant_id
    and s.is_active = true
  order by s.category, s.name;
end;
$$;

-- -------------------------------------------------------------------------
-- 4. get_professionals_by_customer_token
-- -------------------------------------------------------------------------
-- Retorna todos os profissionais ativos da barbearia (tenant) associada ao token.
create or replace function public.get_professionals_by_customer_token(p_token uuid)
returns table(
  id uuid,
  name text,
  phone text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  -- Validar token e capturar tenant_id
  select c.tenant_id into v_tenant_id
  from public.customers c
  where c.token_acesso = p_token
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_tenant_id is null then
    raise exception 'Acesso negado. Token inválido ou expirado.';
  end if;

  return query
  select 
    p.id, 
    p.name, 
    p.phone
  from public.professionals p
  where p.tenant_id = v_tenant_id
    and p.is_active = true
  order by p.name;
end;
$$;

-- -------------------------------------------------------------------------
-- 5. get_available_slots
-- -------------------------------------------------------------------------
-- Calcula slots disponíveis de 30 minutos em um dia específico (timezone America/Sao_Paulo).
-- Se p_professional_id for informado, calcula para o profissional.
-- Se for NULL, agrupa e retorna slots com pelo menos um profissional ativo e livre.
create or replace function public.get_available_slots(
  p_token uuid,
  p_professional_id uuid,
  p_date date
)
returns table(slot_start timestamp with time zone, slot_end timestamp with time zone)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_day_of_week text;
begin
  -- 1. Validar o token e obter o tenant_id
  select c.tenant_id into v_tenant_id
  from public.customers c
  where c.token_acesso = p_token
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_tenant_id is null then
    raise exception 'Acesso negado. Token inválido ou expirado.';
  end if;

  -- 2. Descobrir o dia da semana em inglês (locale-independent)
  v_day_of_week := case extract(dow from p_date)
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    when 6 then 'saturday'
  end;

  -- 3. Gerar slots de 30 minutos e filtrar contra agendamentos existentes
  return query
  with active_profs as (
    select p.id as prof_id, p.weekly_schedule
    from public.professionals p
    where p.tenant_id = v_tenant_id
      and p.is_active = true
      and (p_professional_id is null or p.id = p_professional_id)
  ),
  prof_schedules as (
    select 
      ap.prof_id,
      (ap.weekly_schedule->v_day_of_week->>'start')::time as work_start,
      (ap.weekly_schedule->v_day_of_week->>'end')::time as work_end
    from active_profs ap
    where ap.weekly_schedule is not null 
      and ap.weekly_schedule ? v_day_of_week
  ),
  slots as (
    select 
      ps.prof_id,
      (g) at time zone 'America/Sao_Paulo' as s_start,
      (g + interval '30 minutes') at time zone 'America/Sao_Paulo' as s_end
    from prof_schedules ps,
    generate_series(
      p_date + ps.work_start,
      p_date + ps.work_end - interval '30 minutes',
      interval '30 minutes'
    ) g
  )
  select distinct s.s_start as slot_start, s.s_end as slot_end
  from slots s
  where not exists (
    select 1 from public.appointments a
    where a.professional_id = s.prof_id
      and a.status in ('confirmed', 'pending')
      and a.start_time < s.s_end
      and a.end_time > s.s_start
  )
  and s.s_start > now()
  order by slot_start;
end;
$$;

-- -------------------------------------------------------------------------
-- 6. create_appointment_by_token
-- -------------------------------------------------------------------------
-- Cria um agendamento para o cliente após validar seu token.
-- Valida conflito de horários e previne agendamentos retroativos.
create or replace function public.create_appointment_by_token(
  p_token uuid,
  p_professional_id uuid,
  p_service_id uuid,
  p_start_time timestamp with time zone
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_customer_id uuid;
  v_duration integer;
  v_end_time timestamp with time zone;
  v_appointment_id uuid;
begin
  -- 1. Validar o token e obter dados do cliente
  select c.tenant_id, c.id into v_tenant_id, v_customer_id
  from public.customers c
  where c.token_acesso = p_token
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_tenant_id is null then
    raise exception 'Acesso negado. Token inválido ou expirado.';
  end if;

  -- 2. Validar se o profissional pertence ao tenant e está ativo
  if not exists (
    select 1 from public.professionals p
    where p.id = p_professional_id 
      and p.tenant_id = v_tenant_id 
      and p.is_active = true
  ) then
    raise exception 'Profissional indisponível ou inexistente.';
  end if;

  -- 3. Obter duração do serviço para computar o horário de fim do agendamento
  select s.duration_minutes into v_duration
  from public.services s
  where s.id = p_service_id 
    and s.tenant_id = v_tenant_id 
    and s.is_active = true;

  if v_duration is null then
    raise exception 'Serviço indisponível ou inexistente.';
  end if;

  -- Impedir agendamento no passado
  if p_start_time < now() then
    raise exception 'Não é possível agendar em uma data/hora no passado.';
  end if;

  v_end_time := p_start_time + (v_duration || ' minutes')::interval;

  -- 4. Prevenir conflito de horário na base
  if exists (
    select 1 from public.appointments a
    where a.professional_id = p_professional_id
      and a.status in ('confirmed', 'pending')
      and a.start_time < v_end_time
      and a.end_time > p_start_time
  ) then
    raise exception 'O horário selecionado acabou de ser reservado. Escolha outro.';
  end if;

  -- 5. Inserir agendamento
  insert into public.appointments (
    tenant_id,
    customer_id,
    professional_id,
    service_id,
    start_time,
    end_time,
    status,
    payment_status
  ) values (
    v_tenant_id,
    v_customer_id,
    p_professional_id,
    p_service_id,
    p_start_time,
    v_end_time,
    'confirmed', -- Agendamento já confirmado
    'pending'
  ) returning id into v_appointment_id;

  return v_appointment_id;
end;
$$;

-- -------------------------------------------------------------------------
-- 7. cancel_appointment_by_token
-- -------------------------------------------------------------------------
-- Permite ao cliente cancelar um agendamento ativo próprio usando seu token.
create or replace function public.cancel_appointment_by_token(
  p_token uuid,
  p_appointment_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_customer_id uuid;
begin
  -- 1. Validar o token e obter dados do cliente
  select c.tenant_id, c.id into v_tenant_id, v_customer_id
  from public.customers c
  where c.token_acesso = p_token
    and (c.token_expirado_em is null or c.token_expirado_em > now());

  if v_tenant_id is null then
    raise exception 'Acesso negado. Token inválido ou expirado.';
  end if;

  -- 2. Atualizar o agendamento correspondente (garantindo que seja do cliente autenticado)
  update public.appointments a
  set status = 'canceled',
      cancellation_reason = p_reason,
      updated_at = now()
  where a.id = p_appointment_id
    and a.tenant_id = v_tenant_id
    and a.customer_id = v_customer_id
    and a.status in ('confirmed', 'pending');

  if not found then
    raise exception 'Agendamento não encontrado ou indisponível para cancelamento.';
  end if;

  return true;
end;
$$;
