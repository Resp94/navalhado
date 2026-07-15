-- Migração: Horário de Funcionamento dos Tenants e Intervalo de Almoço dos Profissionais
-- Criada em: 2026-07-15
-- Arquivo: supabase/migrations/20260715140000_business_hours_and_lunch_breaks.sql

-- 1. Adicionar coluna business_hours na tabela tenants com horário de funcionamento padrão (Segunda a Sábado 08:00 às 20:00, Domingo fechado)
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '{
    "monday": {"start": "08:00", "end": "20:00", "active": true},
    "tuesday": {"start": "08:00", "end": "20:00", "active": true},
    "wednesday": {"start": "08:00", "end": "20:00", "active": true},
    "thursday": {"start": "08:00", "end": "20:00", "active": true},
    "friday": {"start": "08:00", "end": "20:00", "active": true},
    "saturday": {"start": "08:00", "end": "20:00", "active": true},
    "sunday": {"start": "08:00", "end": "20:00", "active": false}
  }'::jsonb;

-- 2. Atualizar a função get_available_slots para ler o horário de funcionamento do tenant e considerar o break do profissional
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
    v_break_start_str text;
    v_break_end_str text;
    v_timezone text;
    v_tenant_start_str text;
    v_tenant_end_str text;
    v_tenant_active boolean;
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
        -- Obter horários de trabalho e descanso (break) dele para o dia
        SELECT 
            weekly_schedule->v_day_of_week->>'start',
            weekly_schedule->v_day_of_week->>'end',
            weekly_schedule->v_day_of_week->>'break_start',
            weekly_schedule->v_day_of_week->>'break_end'
        INTO v_start_time_str, v_end_time_str, v_break_start_str, v_break_end_str
        FROM public.professionals
        WHERE id = p_professional_id AND tenant_id = p_tenant_id AND is_active = true;

        IF v_start_time_str IS NULL OR v_end_time_str IS NULL THEN
            RETURN;
        END IF;

        -- Gerar slots e filtrar por conflito, tempo passado e horário de break do profissional
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
          -- Filtra o break do profissional se estiver definido
          AND (
            v_break_start_str IS NULL OR v_break_end_str IS NULL OR
            NOT (s.slot_start < ((p_date::text || ' ' || v_break_end_str || ':00')::timestamp) AT TIME ZONE v_timezone
                 AND s.slot_end > ((p_date::text || ' ' || v_break_start_str || ':00')::timestamp) AT TIME ZONE v_timezone)
          )
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
        -- Obter horário de funcionamento do tenant para o dia da semana
        SELECT 
            business_hours->v_day_of_week->>'start',
            business_hours->v_day_of_week->>'end',
            COALESCE((business_hours->v_day_of_week->>'active')::boolean, false)
        INTO v_tenant_start_str, v_tenant_end_str, v_tenant_active
        FROM public.tenants
        WHERE id = p_tenant_id;

        IF NOT v_tenant_active OR v_tenant_start_str IS NULL OR v_tenant_end_str IS NULL THEN
            RETURN;
        END IF;

        -- Retorna os horários em que existe pelo menos um profissional ativo livre
        RETURN QUERY
        WITH slots AS (
            SELECT gs AS slot_start, gs + (v_duration || ' minutes')::interval AS slot_end
            FROM generate_series(
                ((p_date::text || ' ' || v_tenant_start_str || ':00')::timestamp) AT TIME ZONE v_timezone,
                ((p_date::text || ' ' || v_tenant_end_str || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval,
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
            -- O slot não pode sobrepor com o break do profissional
            AND (
                prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL OR
                prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL OR
                NOT (s.slot_start < ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
                     AND s.slot_end > ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone)
            )
            -- E ele não deve ter conflitos com agendamentos
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
