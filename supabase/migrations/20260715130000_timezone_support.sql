-- Migração: Suporte a Fuso Horário Dinâmico e Controle de Horários Retroativos
-- Criada em: 2026-07-15

-- 1. Adicionar colunas timezone e address na tabela tenants
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS address text;

-- 2. Atualizar a função get_available_slots para usar fuso horário dinâmico e filtrar slots passados
CREATE OR REPLACE FUNCTION public.get_available_slots(
    p_tenant_id uuid,
    p_professional_id uuid,
    p_service_id uuid,
    p_date date,
    p_exclude_appointment_id uuid DEFAULT NULL
)
RETURNS TABLE (
    slot_time text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_duration integer;
    v_day_of_week text;
    v_start_time_str text;
    v_end_time_str text;
    v_timezone text;
BEGIN
    -- Obter o fuso horário da barbearia (tenant)
    SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_timezone
    FROM public.tenants
    WHERE id = p_tenant_id;

    -- 1. Obter a duração do serviço
    SELECT duration_minutes INTO v_duration 
    FROM public.services 
    WHERE id = p_service_id AND tenant_id = p_tenant_id AND is_active = true;

    IF v_duration IS NULL THEN
        RETURN;
    END IF;

    -- 2. Determinar o dia da semana em inglês
    SELECT CASE extract(dow from p_date)
        WHEN 0 THEN 'sunday'
        WHEN 1 THEN 'monday'
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        WHEN 6 THEN 'saturday'
    END INTO v_day_of_week;

    -- 3. Se um profissional específico for selecionado
    IF p_professional_id IS NOT NULL THEN
        -- Obter horários de trabalho dele para o dia
        SELECT 
            weekly_schedule->v_day_of_week->>'start',
            weekly_schedule->v_day_of_week->>'end'
        INTO v_start_time_str, v_end_time_str
        FROM public.professionals
        WHERE id = p_professional_id AND tenant_id = p_tenant_id AND is_active = true;

        IF v_start_time_str IS NULL OR v_end_time_str IS NULL THEN
            RETURN;
        END IF;

        -- Gerar slots e filtrar por conflito e tempo passado
        RETURN QUERY
        WITH slots AS (
            SELECT gs AS slot_start, gs + (v_duration || ' minutes')::interval AS slot_end
            FROM generate_series(
                ((p_date::text || ' ' || v_start_time_str || ':00')::timestamp) AT TIME ZONE v_timezone,
                ((p_date::text || ' ' || v_end_time_str || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval,
                '30 minutes'::interval
            ) gs
        )
        SELECT to_char(s.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time
        FROM slots s
        WHERE s.slot_start > now() -- Filtra horários que já passaram
          AND NOT EXISTS (
            SELECT 1 
            FROM public.appointments a
            WHERE a.professional_id = p_professional_id
              AND a.status != 'canceled'
              AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
              AND a.start_time < s.slot_end
              AND a.end_time > s.slot_start
        );

    -- 4. Se for "Tanto faz" (p_professional_id IS NULL)
    ELSE
        -- Retorna os horários em que existe pelo menos um profissional ativo livre
        RETURN QUERY
        WITH slots AS (
            SELECT gs AS slot_start, gs + (v_duration || ' minutes')::interval AS slot_end
            FROM generate_series(
                ((p_date::text || ' 07:00:00')::timestamp) AT TIME ZONE v_timezone,
                ((p_date::text || ' 22:00:00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval,
                '30 minutes'::interval
            ) gs
        )
        SELECT DISTINCT to_char(s.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time
        FROM slots s
        JOIN public.professionals prof ON prof.tenant_id = p_tenant_id AND prof.is_active = true
        WHERE 
            s.slot_start > now() -- Filtra horários que já passaram
            -- O profissional precisa estar trabalhando nesse dia
            AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
            AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
            -- O slot precisa estar dentro do horário de trabalho dele
            AND s.slot_start >= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
            AND s.slot_end <= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
            -- E ele não deve ter conflitos
            AND NOT EXISTS (
                SELECT 1 
                FROM public.appointments a
                WHERE a.professional_id = prof.id
                  AND a.status != 'canceled'
                  AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
                  AND a.start_time < s.slot_end
                  AND a.end_time > s.slot_start
            )
        ORDER BY slot_time;
    END IF;
END;
$$;

-- 3. Atualizar o wrapper de agendamento por token para respeitar o fuso da barbearia
CREATE OR REPLACE FUNCTION public.create_appointment_by_token(
    p_token uuid,
    p_service_id uuid,
    p_professional_id uuid,
    p_date date,
    p_slot text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start_time timestamp with time zone;
    v_timezone text;
    v_tenant_id uuid;
BEGIN
    -- Obter o tenant_id a partir do token de acesso do cliente
    SELECT tenant_id INTO v_tenant_id
    FROM public.customers
    WHERE token_acesso = p_token;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
    END IF;

    -- Obter o timezone do tenant
    SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_timezone
    FROM public.tenants
    WHERE id = v_tenant_id;

    v_start_time := ((p_date::text || ' ' || p_slot || ':00')::timestamp) AT TIME ZONE v_timezone;
    RETURN public.create_appointment_by_token(p_token, p_professional_id, p_service_id, v_start_time);
END;
$$;

-- 4. Atualizar reagendamento para usar timezone dinâmico
CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(
    p_token uuid,
    p_old_appointment_id uuid,
    p_new_service_id uuid,
    p_new_professional_id uuid,
    p_new_date date,
    p_new_slot text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_start_time timestamp with time zone;
    v_new_appointment_id uuid;
    v_timezone text;
    v_tenant_id uuid;
BEGIN
    -- Obter o tenant_id a partir do token de acesso do cliente
    SELECT tenant_id INTO v_tenant_id
    FROM public.customers
    WHERE token_acesso = p_token;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
    END IF;

    -- Obter o timezone do tenant
    SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_timezone
    FROM public.tenants
    WHERE id = v_tenant_id;

    -- 1. Converter a nova data/slot para timestamp com o timezone do tenant
    v_new_start_time := ((p_new_date::text || ' ' || p_new_slot || ':00')::timestamp) AT TIME ZONE v_timezone;

    -- 2. Cancelar o agendamento antigo
    PERFORM public.cancel_appointment_by_token(p_token, p_old_appointment_id, 'Reagendamento concluído para novo horário');

    -- 3. Criar o novo agendamento
    v_new_appointment_id := public.create_appointment_by_token(p_token, p_new_professional_id, p_new_service_id, v_new_start_time);

    RETURN v_new_appointment_id;
END;
$$;

-- 5. Bloquear cancelamento de agendamentos no passado
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(
    p_token uuid,
    p_appointment_id uuid,
    p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_tenant_id uuid;
    v_token_expirado_em timestamp with time zone;
BEGIN
    -- 1. Validar cliente por token
    SELECT id, tenant_id, token_expirado_em INTO v_customer_id, v_tenant_id, v_token_expirado_em
    FROM public.customers
    WHERE token_acesso = p_token;

    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
    END IF;

    IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
        RAISE EXCEPTION 'Seu acesso expirou. Por favor, solicite um novo link.';
    END IF;

    -- 2. Verificar se o agendamento pertence a este cliente
    IF NOT EXISTS (
        SELECT 1 FROM public.appointments
        WHERE id = p_appointment_id AND customer_id = v_customer_id
    ) THEN
        RAISE EXCEPTION 'Agendamento não encontrado ou não pertence a este cliente.';
    END IF;

    -- 2.5 Verificar se o agendamento está no futuro
    IF NOT EXISTS (
        SELECT 1 FROM public.appointments
        WHERE id = p_appointment_id AND start_time > now()
    ) THEN
        RAISE EXCEPTION 'Não é possível cancelar ou alterar um agendamento que já ocorreu.';
    END IF;

    -- 3. Cancelar agendamento
    UPDATE public.appointments
    SET 
        status = 'canceled',
        cancellation_reason = p_reason,
        updated_at = now()
    WHERE id = p_appointment_id;

    RETURN true;
END;
$$;

-- 6. Formatar notificações no timezone correto do tenant
CREATE OR REPLACE FUNCTION public.handle_appointment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_name text;
  v_service_name text;
  v_professional_name text;
  v_formatted_time text;
  v_title text;
  v_message text;
  v_type text;
  v_timezone text;
BEGIN
  -- Buscar nomes relacionados usando qualificadores de schema explícitos
  SELECT name INTO v_customer_name FROM public.customers WHERE id = new.customer_id;
  SELECT name INTO v_service_name FROM public.services WHERE id = new.service_id;
  SELECT name INTO v_professional_name FROM public.professionals WHERE id = new.professional_id;
  
  -- Buscar o fuso horário do tenant
  SELECT COALESCE(timezone, 'America/Sao_Paulo') INTO v_timezone FROM public.tenants WHERE id = new.tenant_id;

  -- Formatar data/hora no padrão do fuso do tenant
  v_formatted_time := to_char(new.start_time AT TIME ZONE v_timezone, 'DD/MM/YYYY "às" HH24:MI');

  -- Caso 1: Novo Agendamento (INSERT)
  IF tg_op = 'INSERT' THEN
    v_type := 'appointment_created';
    v_title := 'Novo Agendamento';
    v_message := v_customer_name || ' agendou ' || v_service_name || ' com ' || v_professional_name || ' para ' || v_formatted_time || '.';
    
    -- Notificação para o Gerente
    INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
    VALUES (new.tenant_id, null, v_type, v_title, v_message);
    
    -- Notificação para o Barbeiro
    INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
    VALUES (new.tenant_id, new.professional_id, v_type, v_title, v_message);

  -- Caso 2: Atualização (UPDATE)
  ELSIF tg_op = 'UPDATE' THEN
    -- Subcaso A: Cancelamento
    IF new.status = 'canceled' AND old.status <> 'canceled' THEN
      v_type := 'appointment_canceled';
      v_title := 'Agendamento Cancelado';
      v_message := 'O agendamento de ' || v_customer_name || ' (' || v_service_name || ') em ' || v_formatted_time || ' foi cancelado.';
      
      -- Notificação para o Gerente
      INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
      VALUES (new.tenant_id, null, v_type, v_title, v_message);
      
      -- Notificação para o Barbeiro
      INSERT INTO public.notifications (tenant_id, professional_id, type, title, message)
      VALUES (new.tenant_id, new.professional_id, v_type, v_title, v_message);
    END IF;
  END IF;

  RETURN new;
END;
$$;
