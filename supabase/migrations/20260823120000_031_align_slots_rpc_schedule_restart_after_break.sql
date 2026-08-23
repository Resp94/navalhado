-- =============================================================================
-- Migration: 031_align_slots_rpc_schedule_restart_after_break
-- Descricao: Atualiza public.get_available_slots para reiniciar a grade no horario
--            de retorno do intervalo (break_end), garantindo que horarios cheios
--            de retorno (ex: 13:00 ou 15:00) estejam disponiveis e a contagem de
--            intervalo (ex: 40 min) parta estritamente dali.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_tenant_id uuid,
  p_professional_id uuid,
  p_service_id uuid,
  p_date date,
  p_exclude_appointment_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(slot_time text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_duration integer;
  v_day_of_week text;
  v_start_time_str text;
  v_end_time_str text;
  v_break_start_str text;
  v_break_end_str text;
  v_timezone text;
  v_slot_interval integer;
  v_min_booking_lead_time integer;
  v_tenant_start_str text;
  v_tenant_end_str text;
  v_tenant_active boolean;
  v_has_break boolean;
BEGIN
  -- Obter configuracoes do tenant
  SELECT 
    COALESCE(timezone, 'America/Sao_Paulo'),
    COALESCE(slot_interval_minutes, 30),
    COALESCE(min_booking_lead_time_minutes, 15)
  INTO 
    v_timezone,
    v_slot_interval,
    v_min_booking_lead_time
  FROM public.tenants 
  WHERE id = p_tenant_id;

  -- 1. Obter duracao do servico
  IF p_professional_id IS NOT NULL THEN
    -- Se o servico estiver desabilitado para o profissional, nao ha slots
    IF EXISTS (
      SELECT 1 FROM public.professional_services ps
      WHERE ps.professional_id = p_professional_id
        AND ps.service_id = p_service_id
        AND ps.tenant_id = p_tenant_id
        AND ps.is_enabled = false
    ) THEN
      RETURN;
    END IF;

    SELECT COALESCE(ps.custom_duration_minutes, s.duration_minutes, 40)
    INTO v_duration
    FROM public.services s
    LEFT JOIN public.professional_services ps 
      ON ps.service_id = s.id 
      AND ps.professional_id = p_professional_id 
      AND ps.tenant_id = p_tenant_id
      AND ps.is_enabled = true
    WHERE s.id = p_service_id 
      AND s.tenant_id = p_tenant_id 
      AND s.is_active = true;
  ELSE
    SELECT COALESCE(duration_minutes, 40)
    INTO v_duration
    FROM public.services 
    WHERE id = p_service_id 
      AND tenant_id = p_tenant_id 
      AND is_active = true;
  END IF;

  IF v_duration IS NULL THEN 
    RETURN; 
  END IF;

  -- 2. Determinar o dia da semana em ingles
  SELECT CASE extract(dow from p_date) 
    WHEN 0 THEN 'sunday' 
    WHEN 1 THEN 'monday' 
    WHEN 2 THEN 'tuesday' 
    WHEN 3 THEN 'wednesday' 
    WHEN 4 THEN 'thursday' 
    WHEN 5 THEN 'friday' 
    WHEN 6 THEN 'saturday' 
  END INTO v_day_of_week;

  -- 3. Caso: Profissional Especifico Selecionado
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
    WHERE id = p_professional_id AND tenant_id = p_tenant_id AND is_active = true;

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
      -- Periodo da Manha (ou expediente completo se sem intervalo)
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

      -- Periodo da Tarde: reinicia estritamente no horario de retorno do intervalo (v_break_end_str)
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
      -- Respeita o limite do periodo (manha termina antes do intervalo, tarde antes do fim da jornada)
      s.slot_end <= s.period_limit
      -- Respeita a antecedencia minima configurada para agendamentos online
      AND s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)
      -- Nao colide com o break do profissional
      AND (NOT v_has_break OR NOT (
        s.slot_start < ((p_date::text || ' ' || v_break_end_str || ':00')::timestamp) AT TIME ZONE v_timezone 
        AND s.slot_end > ((p_date::text || ' ' || v_break_start_str || ':00')::timestamp) AT TIME ZONE v_timezone
      )) 
      -- Nao colide com agendamentos ativos
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a 
        WHERE a.professional_id = p_professional_id 
          AND a.status != 'canceled' 
          AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id) 
          AND a.start_time < s.slot_end 
          AND a.end_time > s.slot_start
      )
      -- Nao colide com bloqueios de horario
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE b.professional_id = p_professional_id
          AND b.start_time < s.slot_end
          AND b.end_time > s.slot_start
      )
    ORDER BY slot_time;

  -- 4. Caso: "Tanto faz" (p_professional_id IS NULL)
  ELSE
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

    RETURN QUERY
    WITH prof_avail AS (
      SELECT 
        prof.id AS prof_id,
        prof.weekly_schedule->v_day_of_week->>'start' AS p_start,
        prof.weekly_schedule->v_day_of_week->>'end' AS p_end,
        prof.weekly_schedule->v_day_of_week->>'break_start' AS p_bstart,
        prof.weekly_schedule->v_day_of_week->>'break_end' AS p_bend,
        COALESCE(ps.custom_duration_minutes, v_duration) AS p_dur,
        (
          prof.weekly_schedule->v_day_of_week->>'break_start' IS NOT NULL 
          AND prof.weekly_schedule->v_day_of_week->>'break_end' IS NOT NULL 
          AND (prof.weekly_schedule->v_day_of_week->>'break_start') < (prof.weekly_schedule->v_day_of_week->>'break_end')
          AND (prof.weekly_schedule->v_day_of_week->>'break_start') > (prof.weekly_schedule->v_day_of_week->>'start')
          AND (prof.weekly_schedule->v_day_of_week->>'break_end') < (prof.weekly_schedule->v_day_of_week->>'end')
        ) AS p_has_break
      FROM public.professionals prof
      LEFT JOIN public.professional_services ps
        ON ps.professional_id = prof.id
        AND ps.service_id = p_service_id
        AND ps.tenant_id = p_tenant_id
      WHERE prof.tenant_id = p_tenant_id 
        AND prof.is_active = true
        AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
        AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
    ),
    raw_slots AS (
      -- Slots da Manha de cada profissional
      SELECT 
        pa.prof_id,
        gs AS slot_start,
        gs + (pa.p_dur || ' minutes')::interval AS slot_end,
        CASE WHEN pa.p_has_break THEN ((p_date::text || ' ' || pa.p_bstart || ':00')::timestamp) AT TIME ZONE v_timezone ELSE ((p_date::text || ' ' || pa.p_end || ':00')::timestamp) AT TIME ZONE v_timezone END AS period_limit,
        pa.p_bstart,
        pa.p_bend,
        pa.p_has_break
      FROM prof_avail pa
      CROSS JOIN LATERAL generate_series(
        ((p_date::text || ' ' || pa.p_start || ':00')::timestamp) AT TIME ZONE v_timezone,
        CASE 
          WHEN pa.p_has_break THEN ((p_date::text || ' ' || pa.p_bstart || ':00')::timestamp) AT TIME ZONE v_timezone - (pa.p_dur || ' minutes')::interval
          ELSE ((p_date::text || ' ' || pa.p_end || ':00')::timestamp) AT TIME ZONE v_timezone - (pa.p_dur || ' minutes')::interval
        END,
        (v_slot_interval || ' minutes')::interval
      ) gs

      UNION ALL

      -- Slots da Tarde de cada profissional: reiniciando estritamente no break_end
      SELECT 
        pa.prof_id,
        gs AS slot_start,
        gs + (pa.p_dur || ' minutes')::interval AS slot_end,
        ((p_date::text || ' ' || pa.p_end || ':00')::timestamp) AT TIME ZONE v_timezone AS period_limit,
        pa.p_bstart,
        pa.p_bend,
        pa.p_has_break
      FROM prof_avail pa
      CROSS JOIN LATERAL generate_series(
        ((p_date::text || ' ' || pa.p_bend || ':00')::timestamp) AT TIME ZONE v_timezone,
        ((p_date::text || ' ' || pa.p_end || ':00')::timestamp) AT TIME ZONE v_timezone - (pa.p_dur || ' minutes')::interval,
        (v_slot_interval || ' minutes')::interval
      ) gs
      WHERE pa.p_has_break
    )
    SELECT DISTINCT to_char(s.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time
    FROM raw_slots s
    WHERE 
      s.slot_end <= s.period_limit
      -- Respeita a antecedencia minima configurada
      AND s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)
      -- Nao colide com o descanso do profissional
      AND (
        NOT s.p_has_break
        OR NOT (
          s.slot_start < ((p_date::text || ' ' || s.p_bend || ':00')::timestamp) AT TIME ZONE v_timezone
          AND s.slot_end > ((p_date::text || ' ' || s.p_bstart || ':00')::timestamp) AT TIME ZONE v_timezone
        )
      )
      -- Sem agendamentos ativos concorrentes para este profissional
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.professional_id = s.prof_id
          AND a.status != 'canceled'
          AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
          AND a.start_time < s.slot_end
          AND a.end_time > s.slot_start
      )
      -- Sem bloqueios de agenda concorrentes para este profissional
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE b.professional_id = s.prof_id
          AND b.start_time < s.slot_end
          AND b.end_time > s.slot_start
      )
    ORDER BY slot_time;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) TO authenticated, service_role;
