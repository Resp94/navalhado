-- =============================================================================
-- Migration 056: Fallback de business_hours em get_available_slots e ajuste de
--                get_available_slots_by_token para autoatendimento e reagendamento
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Atualizar get_available_slots com fallback gracioso para business_hours do tenant
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_available_slots(uuid, uuid, uuid, date, uuid);

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
AS $$
DECLARE
  v_timezone text;
  v_slot_interval integer;
  v_min_booking_lead_time integer;
  v_duration integer;
  v_day_of_week text;
  v_day_bh_key text;
  v_start_time_str text;
  v_end_time_str text;
  v_break_start_str text;
  v_break_end_str text;
  v_has_break boolean := false;
  v_tenant_start_str text;
  v_tenant_end_str text;
  v_tenant_active boolean;
BEGIN
  -- 1. Obter configurações do Tenant (Timezone, Intervalo de Slot, Antecedência Mínima)
  SELECT 
    COALESCE(t.timezone, 'America/Sao_Paulo'),
    COALESCE(t.slot_interval_minutes, 30),
    COALESCE(t.min_booking_lead_time_minutes, 15)
  INTO v_timezone, v_slot_interval, v_min_booking_lead_time
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_timezone IS NULL THEN
    RETURN;
  END IF;

  -- Determinar chave do dia da semana (inglês para professional.weekly_schedule)
  SELECT CASE extract(dow from p_date)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END INTO v_day_of_week;

  -- Chave em português para tenant.business_hours
  SELECT CASE extract(dow from p_date)
    WHEN 0 THEN 'domingo'
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
  END INTO v_day_bh_key;

  -- Obter horário de funcionamento geral da barbearia
  SELECT 
    COALESCE(business_hours->v_day_of_week->>'start', business_hours->v_day_bh_key->>'open', business_hours->v_day_bh_key->>'start', '08:00'),
    COALESCE(business_hours->v_day_of_week->>'end', business_hours->v_day_bh_key->>'close', business_hours->v_day_bh_key->>'end', '20:00'),
    COALESCE((business_hours->v_day_of_week->>'active')::boolean, (business_hours->v_day_bh_key->>'active')::boolean, true)
  INTO v_tenant_start_str, v_tenant_end_str, v_tenant_active
  FROM public.tenants
  WHERE id = p_tenant_id;

  -- Se a barbearia estiver fechada neste dia, retorna vazio
  IF v_tenant_active IS FALSE THEN
    RETURN;
  END IF;

  -- 2. Obter duração do serviço (não excluído e ativo)
  IF p_professional_id IS NOT NULL THEN
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
      AND s.is_active = true
      AND s.deleted_at IS NULL;
  ELSE
    SELECT COALESCE(duration_minutes, 40)
    INTO v_duration
    FROM public.services 
    WHERE id = p_service_id 
      AND tenant_id = p_tenant_id 
      AND is_active = true
      AND deleted_at IS NULL;
  END IF;

  IF v_duration IS NULL THEN 
    RETURN; 
  END IF;

  -- 3. Caso: Profissional Específico
  IF p_professional_id IS NOT NULL THEN
    SELECT 
      COALESCE(
        weekly_schedule->v_day_of_week->>'start',
        weekly_schedule->v_day_bh_key->>'start',
        v_tenant_start_str,
        '08:00'
      ), 
      COALESCE(
        weekly_schedule->v_day_of_week->>'end',
        weekly_schedule->v_day_bh_key->>'end',
        v_tenant_end_str,
        '20:00'
      ), 
      COALESCE(weekly_schedule->v_day_of_week->>'break_start', weekly_schedule->v_day_bh_key->>'break_start'), 
      COALESCE(weekly_schedule->v_day_of_week->>'break_end', weekly_schedule->v_day_bh_key->>'break_end'),
      COALESCE(
        (weekly_schedule->v_day_of_week->>'active')::boolean,
        (weekly_schedule->v_day_bh_key->>'active')::boolean,
        true
      )
    INTO 
      v_start_time_str, 
      v_end_time_str, 
      v_break_start_str, 
      v_break_end_str,
      v_tenant_active
    FROM public.professionals 
    WHERE id = p_professional_id 
      AND tenant_id = p_tenant_id 
      AND is_active = true
      AND deleted_at IS NULL;

    -- Se o profissional não trabalha neste dia específico (folga ativa = false)
    IF v_tenant_active IS FALSE OR v_start_time_str IS NULL OR v_end_time_str IS NULL THEN 
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
      -- Período da Manhã / Integral
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

      -- Período da Tarde (após break)
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
          AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id) 
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

  -- 4. Caso: "Tanto faz" / Qualquer Profissional
  ELSE
    IF v_tenant_start_str IS NULL OR v_tenant_end_str IS NULL THEN
      RETURN;
    END IF;

    RETURN QUERY
    WITH prof_avail AS (
      SELECT 
        prof.id AS prof_id,
        COALESCE(prof.weekly_schedule->v_day_of_week->>'start', prof.weekly_schedule->v_day_bh_key->>'start', v_tenant_start_str, '08:00') AS p_start,
        COALESCE(prof.weekly_schedule->v_day_of_week->>'end', prof.weekly_schedule->v_day_bh_key->>'end', v_tenant_end_str, '20:00') AS p_end,
        COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') AS p_bstart,
        COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end') AS p_bend,
        COALESCE(ps.custom_duration_minutes, v_duration) AS p_dur,
        (
          COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') IS NOT NULL 
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end') IS NOT NULL 
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') < COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end')
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') > COALESCE(prof.weekly_schedule->v_day_of_week->>'start', prof.weekly_schedule->v_day_bh_key->>'start', v_tenant_start_str, '08:00')
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end') < COALESCE(prof.weekly_schedule->v_day_of_week->>'end', prof.weekly_schedule->v_day_bh_key->>'end', v_tenant_end_str, '20:00')
        ) AS p_has_break
      FROM public.professionals prof
      LEFT JOIN public.professional_services ps
        ON ps.professional_id = prof.id
        AND ps.service_id = p_service_id
        AND ps.tenant_id = p_tenant_id
      WHERE prof.tenant_id = p_tenant_id 
        AND prof.is_active = true
        AND prof.deleted_at IS NULL
        AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
        AND COALESCE((prof.weekly_schedule->v_day_of_week->>'active')::boolean, (prof.weekly_schedule->v_day_bh_key->>'active')::boolean, true) IS TRUE
    ),
    raw_slots AS (
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
      AND s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)
      AND (
        NOT s.p_has_break
        OR NOT (
          s.slot_start < ((p_date::text || ' ' || s.p_bend || ':00')::timestamp) AT TIME ZONE v_timezone
          AND s.slot_end > ((p_date::text || ' ' || s.p_bstart || ':00')::timestamp) AT TIME ZONE v_timezone
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.professional_id = s.prof_id
          AND a.status != 'canceled'
          AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
          AND a.start_time < s.slot_end
          AND a.end_time > s.slot_start
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE (b.tenant_id = p_tenant_id AND (b.professional_id = s.prof_id OR b.professional_id IS NULL))
          AND b.start_time < s.slot_end
          AND b.end_time > s.slot_start
      )
    ORDER BY slot_time;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Atualizar get_available_slots_by_token para suportar tokens provisórios e autoatendimento
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid);

CREATE OR REPLACE FUNCTION public.get_available_slots_by_token(
  p_token uuid,
  p_service_id uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_date date DEFAULT CURRENT_DATE,
  p_exclude_appointment_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(slot_time text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_customer_id uuid;
  v_tenant_id uuid;
BEGIN
  -- Identificar cliente e tenant pelo token de acesso
  SELECT c.id, c.tenant_id
  INTO v_customer_id, v_tenant_id
  FROM public.customers c
  WHERE c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em > now());

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer token' USING errcode = 'P0001';
  END IF;

  -- Se um appointment a excluir foi passado, valida se ele pertence ao mesmo tenant
  IF p_exclude_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_exclude_appointment_id
      AND a.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Appointment not found for this establishment' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT slots.slot_time
  FROM public.get_available_slots(
    v_tenant_id,
    p_professional_id,
    p_service_id,
    p_date,
    p_exclude_appointment_id
  ) AS slots;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid) TO anon, authenticated, service_role;
