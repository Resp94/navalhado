-- =========================================================================
-- MIGRATION: RPCs para o Canal de Clientes
-- =========================================================================

-- 1. Obter agendamentos futuros do cliente por token
CREATE OR REPLACE FUNCTION public.get_customer_appointments_by_token(token uuid)
RETURNS TABLE (
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_token_expirado_em timestamp with time zone;
BEGIN
    -- Verificar se o token existe e obter dados
    SELECT id, token_expirado_em INTO v_customer_id, v_token_expirado_em
    FROM public.customers
    WHERE token_acesso = token;

    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'TOKEN_INVALID' USING HINT = 'O token de acesso não foi encontrado.';
    END IF;

    IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
        RAISE EXCEPTION 'TOKEN_EXPIRED' USING HINT = 'O token de acesso expirou.';
    END IF;

    RETURN QUERY
    SELECT 
        a.id AS appointment_id,
        a.start_time,
        a.end_time,
        a.status,
        a.payment_status,
        a.cancellation_reason,
        p.name AS professional_name,
        p.id AS professional_id,
        s.name AS service_name,
        s.id AS service_id,
        s.price AS service_price,
        s.duration_minutes AS service_duration,
        t.name AS tenant_name,
        t.id AS tenant_id,
        t.phone AS tenant_phone,
        c.name AS customer_name
    FROM public.appointments a
    JOIN public.customers c ON a.customer_id = c.id
    JOIN public.professionals p ON a.professional_id = p.id
    JOIN public.services s ON a.service_id = s.id
    JOIN public.tenants t ON a.tenant_id = t.id
    WHERE c.token_acesso = token
      AND a.start_time >= (now() - interval '1 hour') -- mostra agendamentos futuros ou muito recentes
    ORDER BY a.start_time ASC;
END;
$$;

-- 2. Obter slots disponíveis de horários
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
BEGIN
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

        -- Gerar slots e filtrar por conflito
        RETURN QUERY
        WITH slots AS (
            SELECT gs AS slot_start, gs + (v_duration || ' minutes')::interval AS slot_end
            FROM generate_series(
                (p_date::text || ' ' || v_start_time_str || ':00Z')::timestamp with time zone,
                (p_date::text || ' ' || v_end_time_str || ':00Z')::timestamp with time zone - (v_duration || ' minutes')::interval,
                '30 minutes'::interval
            ) gs
        )
        SELECT to_char(s.slot_start, 'HH24:MI') AS slot_time
        FROM slots s
        WHERE NOT EXISTS (
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
                (p_date::text || ' 07:00:00Z')::timestamp with time zone,
                (p_date::text || ' 22:00:00Z')::timestamp with time zone - (v_duration || ' minutes')::interval,
                '30 minutes'::interval
            ) gs
        )
        SELECT DISTINCT to_char(s.slot_start, 'HH24:MI') AS slot_time
        FROM slots s
        JOIN public.professionals prof ON prof.tenant_id = p_tenant_id AND prof.is_active = true
        WHERE 
            -- O profissional precisa estar trabalhando nesse dia
            prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
            AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
            -- O slot precisa estar dentro do horário de trabalho dele
            AND s.slot_start >= (p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00Z')::timestamp with time zone
            AND s.slot_end <= (p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00Z')::timestamp with time zone
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

-- 3. Criar agendamento do cliente por token
CREATE OR REPLACE FUNCTION public.create_appointment_by_token(
    p_token uuid,
    p_professional_id uuid,
    p_service_id uuid,
    p_start_time timestamp with time zone
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_tenant_id uuid;
    v_token_expirado_em timestamp with time zone;
    v_duration integer;
    v_end_time timestamp with time zone;
    v_day_of_week text;
    v_final_professional_id uuid;
    v_appointment_id uuid;
BEGIN
    -- 1. Validar cliente por token
    SELECT id, tenant_id, token_expirado_em 
    INTO v_customer_id, v_tenant_id, v_token_expirado_em
    FROM public.customers
    WHERE token_acesso = p_token;

    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
    END IF;

    IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
        RAISE EXCEPTION 'Seu acesso expirou. Por favor, solicite um novo link.';
    END IF;

    -- 2. Obter duração do serviço
    SELECT duration_minutes INTO v_duration
    FROM public.services
    WHERE id = p_service_id AND tenant_id = v_tenant_id AND is_active = true;

    IF v_duration IS NULL THEN
        RAISE EXCEPTION 'Serviço não encontrado ou inativo.';
    END IF;

    v_end_time := p_start_time + (v_duration || ' minutes')::interval;

    -- 3. Determinar dia da semana do agendamento
    SELECT CASE extract(dow from p_start_time)
        WHEN 0 THEN 'sunday'
        WHEN 1 THEN 'monday'
        WHEN 2 THEN 'tuesday'
        WHEN 3 THEN 'wednesday'
        WHEN 4 THEN 'thursday'
        WHEN 5 THEN 'friday'
        WHEN 6 THEN 'saturday'
    END INTO v_day_of_week;

    -- 4. Definir ou validar o profissional
    IF p_professional_id IS NULL THEN
        -- Procurar um profissional ativo disponível
        SELECT prof.id INTO v_final_professional_id
        FROM public.professionals prof
        WHERE prof.tenant_id = v_tenant_id 
          AND prof.is_active = true
          -- Trabalha nesse dia
          AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
          AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
          -- O horário do agendamento cabe dentro do expediente dele
          AND p_start_time::time >= (prof.weekly_schedule->v_day_of_week->>'start')::time
          AND v_end_time::time <= (prof.weekly_schedule->v_day_of_week->>'end')::time
          -- Não tem conflito
          AND NOT EXISTS (
              SELECT 1 
              FROM public.appointments a
              WHERE a.professional_id = prof.id
                AND a.status != 'canceled'
                AND a.start_time < v_end_time
                AND a.end_time > p_start_time
          )
        LIMIT 1;

        IF v_final_professional_id IS NULL THEN
            RAISE EXCEPTION 'Não há profissionais disponíveis para este horário.';
        END IF;
    ELSE
        -- Validar se o profissional fornecido está disponível
        -- 1. Verifica se está ativo e pertence ao tenant
        IF NOT EXISTS (
            SELECT 1 FROM public.professionals 
            WHERE id = p_professional_id AND tenant_id = v_tenant_id AND is_active = true
        ) THEN
            RAISE EXCEPTION 'Profissional inválido ou inativo.';
        END IF;

        -- 2. Verifica se trabalha no dia e se cabe no expediente
        IF NOT EXISTS (
            SELECT 1 FROM public.professionals prof
            WHERE prof.id = p_professional_id
              AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
              AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
              AND p_start_time::time >= (prof.weekly_schedule->v_day_of_week->>'start')::time
              AND v_end_time::time <= (prof.weekly_schedule->v_day_of_week->>'end')::time
        ) THEN
            RAISE EXCEPTION 'Profissional não atende neste horário.';
        END IF;

        -- 3. Verifica conflitos
        IF EXISTS (
            SELECT 1 
            FROM public.appointments a
            WHERE a.professional_id = p_professional_id
              AND a.status != 'canceled'
              AND a.start_time < v_end_time
              AND a.end_time > p_start_time
        ) THEN
            RAISE EXCEPTION 'O profissional já possui um agendamento neste horário.';
        END IF;

        v_final_professional_id := p_professional_id;
    END IF;

    -- 5. Inserir o agendamento
    INSERT INTO public.appointments (
        tenant_id,
        customer_id,
        professional_id,
        service_id,
        start_time,
        end_time,
        status,
        payment_status
    ) VALUES (
        v_tenant_id,
        v_customer_id,
        v_final_professional_id,
        p_service_id,
        p_start_time,
        v_end_time,
        'confirmed',
        'pending'
    )
    RETURNING id INTO v_appointment_id;

    RETURN v_appointment_id;
END;
$$;

-- 4. Cancelar agendamento do cliente por token
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

-- 5. Obter detalhes do cliente e tenant por token
CREATE OR REPLACE FUNCTION public.get_customer_details_by_token(p_token uuid)
RETURNS TABLE (
    customer_id uuid,
    customer_name text,
    tenant_id uuid,
    tenant_name text,
    tenant_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_customer_name text;
    v_tenant_id uuid;
    v_tenant_name text;
    v_tenant_phone text;
    v_token_expirado_em timestamp with time zone;
END;
$$;

-- Ops, vamos escrever o corpo correto da função
CREATE OR REPLACE FUNCTION public.get_customer_details_by_token(p_token uuid)
RETURNS TABLE (
    customer_id uuid,
    customer_name text,
    tenant_id uuid,
    tenant_name text,
    tenant_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_customer_id uuid;
    v_customer_name text;
    v_tenant_id uuid;
    v_tenant_name text;
    v_tenant_phone text;
    v_token_expirado_em timestamp with time zone;
BEGIN
    SELECT c.id, c.name, c.tenant_id, t.name, t.phone, c.token_expirado_em
    INTO v_customer_id, v_customer_name, v_tenant_id, v_tenant_name, v_tenant_phone, v_token_expirado_em
    FROM public.customers c
    JOIN public.tenants t ON c.tenant_id = t.id
    WHERE c.token_acesso = p_token;

    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'TOKEN_INVALID' USING HINT = 'O token de acesso não foi encontrado.';
    END IF;

    IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
        RAISE EXCEPTION 'TOKEN_EXPIRED' USING HINT = 'O token de acesso expirou.';
    END IF;

    RETURN QUERY
    SELECT v_customer_id, v_customer_name, v_tenant_id, v_tenant_name, v_tenant_phone;
END;
$$;

-- 10. Wrapper para create_appointment_by_token aceitando p_date e p_slot
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
BEGIN
    v_start_time := ((p_date::text || ' ' || p_slot || ':00')::timestamp) AT TIME ZONE 'America/Sao_Paulo';
    RETURN public.create_appointment_by_token(p_token, p_professional_id, p_service_id, v_start_time);
END;
$$;

-- 11. Função reschedule_appointment_by_token aceitando p_new_date e p_new_slot
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
BEGIN
    -- 1. Converter a nova data/slot para timestamp com timezone America/Sao_Paulo
    v_new_start_time := ((p_new_date::text || ' ' || p_new_slot || ':00')::timestamp) AT TIME ZONE 'America/Sao_Paulo';

    -- 2. Cancelar o agendamento antigo
    PERFORM public.cancel_appointment_by_token(p_token, p_old_appointment_id, 'Reagendamento concluído para novo horário');

    -- 3. Criar o novo agendamento (isto valida conflitos e expediente automaticamente)
    v_new_appointment_id := public.create_appointment_by_token(p_token, p_new_professional_id, p_new_service_id, v_new_start_time);

    RETURN v_new_appointment_id;
END;
$$;
