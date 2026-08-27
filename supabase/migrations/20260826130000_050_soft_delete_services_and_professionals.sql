-- Migration: 050_soft_delete_services_and_professionals
-- Description: Adiciona coluna deleted_at em services e professionals para suportar soft delete preservando histórico financeiro e de atendimentos.

-- 1. Adicionar colunas deleted_at
ALTER TABLE public.services 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.professionals 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Índices parciais de alta performance para registros não excluídos
CREATE INDEX IF NOT EXISTS idx_services_active_not_deleted 
  ON public.services(tenant_id, is_active) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_professionals_active_not_deleted 
  ON public.professionals(tenant_id, is_active) 
  WHERE deleted_at IS NULL;

-- 3. Atualizar get_available_slots para filtrar profissionais e serviços não excluídos
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_tenant_id uuid,
  p_date date,
  p_service_id uuid,
  p_professional_id uuid DEFAULT NULL
)
RETURNS TABLE (slot_time text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_timezone text;
  v_day_of_week text;
  v_day_bh_active boolean;
  v_day_bh_open text;
  v_day_bh_close text;
  v_duration int;
  v_slot_interval int;
  v_min_booking_lead_time int;
  v_max_booking_ahead_days int;
  v_now_in_tz timestamp;
  v_req_date_in_tz timestamp;
  v_diff_days int;
  v_start_time_str text;
  v_end_time_str text;
  v_break_start_str text;
  v_break_end_str text;
  v_has_break boolean;
BEGIN
  -- 1. Obter timezone, horários de funcionamento e regras da barbearia
  SELECT 
    coalesce(timezone, 'America/Sao_Paulo'),
    coalesce((business_hours->>(lower(to_char(p_date, 'FMDay'))))::jsonb->>'active', 'false')::boolean,
    coalesce((business_hours->>(lower(to_char(p_date, 'FMDay'))))::jsonb->>'open', '08:00'),
    coalesce((business_hours->>(lower(to_char(p_date, 'FMDay'))))::jsonb->>'close', '20:00'),
    coalesce(slot_interval_minutes, 30),
    coalesce(min_booking_lead_time_minutes, 30),
    coalesce(max_booking_ahead_days, 60)
  INTO 
    v_timezone,
    v_day_bh_active,
    v_day_bh_open,
    v_day_bh_close,
    v_slot_interval,
    v_min_booking_lead_time,
    v_max_booking_ahead_days
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado.';
  END IF;

  -- Se a barbearia estiver fechada neste dia da semana
  IF NOT v_day_bh_active THEN
    RETURN;
  END IF;

  -- Validar limite de antecedência máxima
  v_now_in_tz := now() AT TIME ZONE v_timezone;
  v_req_date_in_tz := (p_date::text || ' 00:00:00')::timestamp;
  v_diff_days := (p_date - (v_now_in_tz::date));

  IF v_diff_days < 0 OR v_diff_days > v_max_booking_ahead_days THEN
    RETURN;
  END IF;

  -- Obter duração do serviço solicitado (apenas se ativo e não excluído)
  SELECT duration_minutes INTO v_duration
  FROM public.services
  WHERE id = p_service_id AND tenant_id = p_tenant_id AND is_active = true AND deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  SELECT CASE extract(dow from p_date)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END INTO v_day_of_week;

  -- 2. Caso: Profissional Específico Selecionado
  IF p_professional_id IS NOT NULL THEN
    SELECT 
      weekly_schedule->v_day_of_week->>'start', 
      weekly_schedule->v_day_of_week->>'end', 
      weekly_schedule->v_day_of_week->>'break_start', 
      weekly_schedule->v_day_of_week->>'break_end' 
    INTO 
      v_start_time_str, 
      v_end_time_str, 
      v_break_start_str, 
      v_break_end_str 
    FROM public.professionals 
    WHERE id = p_professional_id 
      AND tenant_id = p_tenant_id 
      AND is_active = true 
      AND deleted_at IS NULL;

    IF v_start_time_str IS NULL OR v_end_time_str IS NULL THEN 
      RETURN; 
    END IF;

    v_has_break := (
      v_break_start_str IS NOT NULL 
      AND v_break_end_str IS NOT NULL 
      AND v_break_start_str < v_break_end_str
      AND v_break_start_str > v_start_time_str
      AND v_break_end_str < v_end_time_str
    );

    RETURN QUERY 
    WITH raw_slots AS (
      -- Período da Manhã
      SELECT 
        gs AS slot_start, 
        gs + (v_duration || ' minutes')::interval AS slot_end,
        CASE WHEN v_has_break THEN ((p_date::text || ' ' || v_break_start_str || ':00')::timestamp) AT TIME ZONE v_timezone ELSE ((p_date::text || ' ' || v_end_time_str || ':00')::timestamp) AT TIME ZONE v_timezone END AS period_limit
      FROM generate_series(
        ((p_date::text || ' ' || v_start_time_str || ':00')::timestamp) AT TIME ZONE v_timezone, 
        CASE 
          WHEN v_has_break THEN ((p_date::text || ' ' || v_break_start_str || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval
          ELSE ((p_date::text || ' ' || v_end_time_str || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval
        END, 
        (v_slot_interval || ' minutes')::interval
      ) gs

      UNION ALL

      -- Período da Tarde
      SELECT 
        gs AS slot_start, 
        gs + (v_duration || ' minutes')::interval AS slot_end,
        ((p_date::text || ' ' || v_end_time_str || ':00')::timestamp) AT TIME ZONE v_timezone AS period_limit
      FROM generate_series(
        ((p_date::text || ' ' || v_break_end_str || ':00')::timestamp) AT TIME ZONE v_timezone, 
        ((p_date::text || ' ' || v_end_time_str || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval, 
        (v_slot_interval || ' minutes')::interval
      ) gs
      WHERE v_has_break
    ) 
    SELECT to_char(s.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time
    FROM raw_slots s 
    WHERE 
      s.slot_end <= s.period_limit
      AND s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)
      AND (NOT v_has_break OR NOT (
        s.slot_start < ((p_date::text || ' ' || v_break_end_str || ':00')::timestamp) AT TIME ZONE v_timezone 
        AND s.slot_end > ((p_date::text || ' ' || v_break_start_str || ':00')::timestamp) AT TIME ZONE v_timezone
      )) 
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a 
        WHERE a.professional_id = p_professional_id 
          AND a.status != 'canceled' 
          AND a.start_time < s.slot_end 
          AND a.end_time > s.slot_start
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE (b.tenant_id = p_tenant_id AND (b.professional_id = p_professional_id OR b.professional_id IS NULL))
          AND b.start_time < s.slot_end
          AND b.end_time > s.slot_start
      )
    ORDER BY slot_time;

  -- 3. Caso: "Tanto faz" / Qualquer Profissional
  ELSE
    RETURN QUERY
    WITH prof_slots AS (
      SELECT 
        prof.id AS prof_id,
        gs AS slot_start,
        gs + (v_duration || ' minutes')::interval AS slot_end,
        CASE 
          WHEN (
            prof.weekly_schedule->v_day_of_week->>'break_start' IS NOT NULL 
            AND prof.weekly_schedule->v_day_of_week->>'break_end' IS NOT NULL
            AND prof.weekly_schedule->v_day_of_week->>'break_start' < prof.weekly_schedule->v_day_of_week->>'break_end'
            AND prof.weekly_schedule->v_day_of_week->>'break_start' > prof.weekly_schedule->v_day_of_week->>'start'
            AND prof.weekly_schedule->v_day_of_week->>'break_end' < prof.weekly_schedule->v_day_of_week->>'end'
          ) THEN ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
          ELSE ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
        END AS period_limit,
        (
          prof.weekly_schedule->v_day_of_week->>'break_start' IS NOT NULL 
          AND prof.weekly_schedule->v_day_of_week->>'break_end' IS NOT NULL
          AND prof.weekly_schedule->v_day_of_week->>'break_start' < prof.weekly_schedule->v_day_of_week->>'break_end'
          AND prof.weekly_schedule->v_day_of_week->>'break_start' > prof.weekly_schedule->v_day_of_week->>'start'
          AND prof.weekly_schedule->v_day_of_week->>'break_end' < prof.weekly_schedule->v_day_of_week->>'end'
        ) AS has_break,
        prof.weekly_schedule->v_day_of_week->>'break_start' AS break_start_str,
        prof.weekly_schedule->v_day_of_week->>'break_end' AS break_end_str
      FROM public.professionals prof
      LEFT JOIN public.professional_services ps
        ON ps.professional_id = prof.id 
        AND ps.service_id = p_service_id 
        AND ps.tenant_id = p_tenant_id
      CROSS JOIN LATERAL generate_series(
        ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone,
        CASE 
          WHEN (
            prof.weekly_schedule->v_day_of_week->>'break_start' IS NOT NULL 
            AND prof.weekly_schedule->v_day_of_week->>'break_end' IS NOT NULL
            AND prof.weekly_schedule->v_day_of_week->>'break_start' < prof.weekly_schedule->v_day_of_week->>'break_end'
            AND prof.weekly_schedule->v_day_of_week->>'break_start' > prof.weekly_schedule->v_day_of_week->>'start'
            AND prof.weekly_schedule->v_day_of_week->>'break_end' < prof.weekly_schedule->v_day_of_week->>'end'
          ) THEN ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval
          ELSE ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval
        END,
        (v_slot_interval || ' minutes')::interval
      ) gs
      WHERE prof.tenant_id = p_tenant_id 
        AND prof.is_active = true
        AND prof.deleted_at IS NULL
        AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
        AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL

      UNION ALL

      SELECT 
        prof.id AS prof_id,
        gs AS slot_start,
        gs + (v_duration || ' minutes')::interval AS slot_end,
        ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone AS period_limit,
        true AS has_break,
        prof.weekly_schedule->v_day_of_week->>'break_start' AS break_start_str,
        prof.weekly_schedule->v_day_of_week->>'break_end' AS break_end_str
      FROM public.professionals prof
      LEFT JOIN public.professional_services ps
        ON ps.professional_id = prof.id 
        AND ps.service_id = p_service_id 
        AND ps.tenant_id = p_tenant_id
      CROSS JOIN LATERAL generate_series(
        ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone,
        ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval,
        (v_slot_interval || ' minutes')::interval
      ) gs
      WHERE prof.tenant_id = p_tenant_id 
        AND prof.is_active = true
        AND prof.deleted_at IS NULL
        AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
        AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'break_start' IS NOT NULL 
        AND prof.weekly_schedule->v_day_of_week->>'break_end' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'break_start' < prof.weekly_schedule->v_day_of_week->>'break_end'
        AND prof.weekly_schedule->v_day_of_week->>'break_start' > prof.weekly_schedule->v_day_of_week->>'start'
        AND prof.weekly_schedule->v_day_of_week->>'break_end' < prof.weekly_schedule->v_day_of_week->>'end'
    )
    SELECT DISTINCT to_char(ps.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time
    FROM prof_slots ps
    WHERE 
      ps.slot_end <= ps.period_limit
      AND ps.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)
      AND (NOT ps.has_break OR NOT (
        ps.slot_start < ((p_date::text || ' ' || ps.break_end_str || ':00')::timestamp) AT TIME ZONE v_timezone 
        AND ps.slot_end > ((p_date::text || ' ' || ps.break_start_str || ':00')::timestamp) AT TIME ZONE v_timezone
      ))
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a 
        WHERE a.professional_id = ps.prof_id 
          AND a.status != 'canceled' 
          AND a.start_time < ps.slot_end 
          AND a.end_time > ps.slot_start
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE (b.tenant_id = p_tenant_id AND (b.professional_id = ps.prof_id OR b.professional_id IS NULL))
          AND b.start_time < ps.slot_end
          AND b.end_time > ps.slot_start
      )
    ORDER BY slot_time;
  END IF;
END;
$$;
