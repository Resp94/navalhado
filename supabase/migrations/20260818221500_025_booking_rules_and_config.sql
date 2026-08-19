-- =============================================================================
-- Migration: 20260818221500_025_booking_rules_and_config.sql
-- Descrição: Regras dinâmicas de agendamento na tabela tenants e funções RPC
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Novas colunas de configuração de agendamento em public.tenants
-- -----------------------------------------------------------------------------
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS slot_interval_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS min_booking_lead_time_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS min_cancellation_lead_time_minutes integer NOT NULL DEFAULT 120;

-- Adicionar constraints de validação de valor caso não existam
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_slot_interval_minutes'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT chk_tenants_slot_interval_minutes
      CHECK (slot_interval_minutes > 0 AND slot_interval_minutes <= 1440);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_min_booking_lead_time_minutes'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT chk_tenants_min_booking_lead_time_minutes
      CHECK (min_booking_lead_time_minutes >= 0 AND min_booking_lead_time_minutes <= 10080);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tenants_min_cancellation_lead_time_minutes'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT chk_tenants_min_cancellation_lead_time_minutes
      CHECK (min_cancellation_lead_time_minutes >= 0 AND min_cancellation_lead_time_minutes <= 10080);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Atualização de public.get_available_slots
-- -----------------------------------------------------------------------------
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
BEGIN
  -- Obter configurações do tenant
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

  -- 1. Obter duração do serviço
  IF p_professional_id IS NOT NULL THEN
    -- Se o serviço estiver desabilitado para o profissional, não há slots
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

  -- 3. Caso: Profissional Específico Selecionado
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

    RETURN QUERY 
    WITH slots AS (
      SELECT 
        gs AS slot_start, 
        gs + (v_duration || ' minutes')::interval AS slot_end 
      FROM generate_series(
        ((p_date::text || ' ' || v_start_time_str || ':00')::timestamp) AT TIME ZONE v_timezone, 
        ((p_date::text || ' ' || v_end_time_str || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval, 
        (v_slot_interval || ' minutes')::interval
      ) gs
    ) 
    SELECT to_char(s.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time
    FROM slots s 
    WHERE 
      -- Respeita a antecedência mínima configurada para agendamentos online
      s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)
      -- Não colide com o break do profissional
      AND (v_break_start_str IS NULL OR v_break_end_str IS NULL OR NOT (
        s.slot_start < ((p_date::text || ' ' || v_break_end_str || ':00')::timestamp) AT TIME ZONE v_timezone 
        AND s.slot_end > ((p_date::text || ' ' || v_break_start_str || ':00')::timestamp) AT TIME ZONE v_timezone
      )) 
      -- Não colide com agendamentos ativos
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a 
        WHERE a.professional_id = p_professional_id 
          AND a.status != 'canceled' 
          AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id) 
          AND a.start_time < s.slot_end 
          AND a.end_time > s.slot_start
      )
      -- Não colide com bloqueios de horário
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
    WITH slots AS (
      SELECT 
        gs AS slot_start, 
        gs + (v_duration || ' minutes')::interval AS slot_end
      FROM generate_series(
        ((p_date::text || ' ' || v_tenant_start_str || ':00')::timestamp) AT TIME ZONE v_timezone,
        ((p_date::text || ' ' || v_tenant_end_str || ':00')::timestamp) AT TIME ZONE v_timezone - (v_duration || ' minutes')::interval,
        (v_slot_interval || ' minutes')::interval
      ) gs
    )
    SELECT DISTINCT to_char(s.slot_start AT TIME ZONE v_timezone, 'HH24:MI') AS slot_time
    FROM slots s
    WHERE 
      -- Respeita a antecedência mínima configurada
      s.slot_start >= (now() + (v_min_booking_lead_time || ' minutes')::interval)
      -- Existe pelo menos um profissional livre e habilitado para o serviço
      AND EXISTS (
        SELECT 1 
        FROM public.professionals prof
        LEFT JOIN public.professional_services ps
          ON ps.professional_id = prof.id
          AND ps.service_id = p_service_id
          AND ps.tenant_id = p_tenant_id
        WHERE prof.tenant_id = p_tenant_id 
          AND prof.is_active = true
          AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
          -- Profissional trabalha nesse dia
          AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
          AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
          -- O slot cabe na jornada do profissional
          AND s.slot_start >= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
          AND s.slot_end <= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
          -- Não colide com o descanso do profissional
          AND (
            prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL 
            OR prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL
            OR NOT (
              s.slot_start < ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
              AND s.slot_end > ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
            )
          )
          -- Sem agendamentos ativos concorrentes
          AND NOT EXISTS (
            SELECT 1 FROM public.appointments a
            WHERE a.professional_id = prof.id
              AND a.status != 'canceled'
              AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
              AND a.start_time < s.slot_end
              AND a.end_time > s.slot_start
          )
          -- Sem bloqueios de agenda concorrentes
          AND NOT EXISTS (
            SELECT 1 FROM public.blocked_slots b
            WHERE b.professional_id = prof.id
              AND b.start_time < s.slot_end
              AND b.end_time > s.slot_start
          )
      )
    ORDER BY slot_time;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Atualização de public.create_appointment_by_token
-- -----------------------------------------------------------------------------
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
SET search_path TO ''
AS $function$
DECLARE
  v_customer_id uuid;
  v_tenant_id uuid;
  v_token_expirado_em timestamptz;
  v_timezone text;
  v_min_booking_lead_time integer;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_duration integer;
  v_day_of_week text;
  v_final_professional_id uuid;
  v_appointment_id uuid;
BEGIN
  -- 1. Validar cliente por token
  SELECT c.id, c.tenant_id, c.token_expirado_em 
  INTO v_customer_id, v_tenant_id, v_token_expirado_em
  FROM public.customers c
  WHERE c.token_acesso = p_token;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou token inválido.';
  END IF;

  IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
    RAISE EXCEPTION 'Seu acesso expirou. Por favor, solicite um novo link.';
  END IF;

  -- 2. Obter timezone e antecedência mínima do tenant
  SELECT 
    COALESCE(timezone, 'America/Sao_Paulo'),
    COALESCE(min_booking_lead_time_minutes, 15)
  INTO 
    v_timezone,
    v_min_booking_lead_time
  FROM public.tenants 
  WHERE id = v_tenant_id;

  -- Calcular o timestamp do agendamento
  v_start_time := ((p_date::text || ' ' || p_slot || ':00')::timestamp) AT TIME ZONE v_timezone;

  -- Validação de antecedência mínima
  IF v_start_time < (now() + (v_min_booking_lead_time || ' minutes')::interval) THEN
    RAISE EXCEPTION 'Este horário não está mais disponível com a antecedência mínima necessária (% minutos).', v_min_booking_lead_time
      USING errcode = '22023';
  END IF;

  -- 3. Obter duração do serviço
  IF p_professional_id IS NOT NULL THEN
    SELECT COALESCE(ps.custom_duration_minutes, s.duration_minutes, 40)
    INTO v_duration
    FROM public.services s
    LEFT JOIN public.professional_services ps 
      ON ps.service_id = s.id 
      AND ps.professional_id = p_professional_id 
      AND ps.tenant_id = v_tenant_id 
      AND ps.is_enabled = true
    WHERE s.id = p_service_id 
      AND s.tenant_id = v_tenant_id 
      AND s.is_active = true;
  ELSE
    SELECT COALESCE(duration_minutes, 40)
    INTO v_duration
    FROM public.services 
    WHERE id = p_service_id 
      AND tenant_id = v_tenant_id 
      AND is_active = true;
  END IF;

  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'Serviço indisponível ou inexistente.';
  END IF;

  v_end_time := v_start_time + (v_duration || ' minutes')::interval;

  -- 4. Determinar dia da semana
  SELECT CASE extract(dow from v_start_time AT TIME ZONE v_timezone)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END INTO v_day_of_week;

  -- 5. Selecionar ou validar profissional
  IF p_professional_id IS NULL THEN
    -- Caso "Tanto faz": Seleciona o primeiro profissional ativo e livre
    SELECT prof.id INTO v_final_professional_id
    FROM public.professionals prof
    LEFT JOIN public.professional_services ps
      ON ps.professional_id = prof.id
      AND ps.service_id = p_service_id
      AND ps.tenant_id = v_tenant_id
    WHERE prof.tenant_id = v_tenant_id 
      AND prof.is_active = true
      AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
      AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
      AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
      AND v_start_time >= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
      AND v_end_time <= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
      AND (
        prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL 
        OR prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL
        OR NOT (
          v_start_time < ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
          AND v_end_time > ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.professional_id = prof.id
          AND a.status != 'canceled'
          AND a.start_time < v_end_time
          AND a.end_time > v_start_time
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE b.professional_id = prof.id
          AND b.start_time < v_end_time
          AND b.end_time > v_start_time
      )
    LIMIT 1;

    IF v_final_professional_id IS NULL THEN
      RAISE EXCEPTION 'Não há profissionais disponíveis para este horário. Por favor, escolha outro.';
    END IF;
  ELSE
    v_final_professional_id := p_professional_id;

    -- Validar profissional escolhido
    IF NOT EXISTS (
      SELECT 1 FROM public.professionals prof
      LEFT JOIN public.professional_services ps
        ON ps.professional_id = prof.id
        AND ps.service_id = p_service_id
        AND ps.tenant_id = v_tenant_id
      WHERE prof.id = v_final_professional_id 
        AND prof.tenant_id = v_tenant_id 
        AND prof.is_active = true
        AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
        AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
        AND v_start_time >= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
        AND v_end_time <= ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
        AND (
          prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL 
          OR prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL
          OR NOT (
            v_start_time < ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
            AND v_end_time > ((p_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
          )
        )
    ) THEN
      RAISE EXCEPTION 'O profissional selecionado não atende neste horário.';
    END IF;

    -- Prevenir colisão com agendamento ativo
    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.professional_id = v_final_professional_id
        AND a.status != 'canceled'
        AND a.start_time < v_end_time
        AND a.end_time > v_start_time
    ) THEN
      RAISE EXCEPTION 'O horário selecionado acabou de ser reservado. Escolha outro.';
    END IF;

    -- Prevenir colisão com bloqueio
    IF EXISTS (
      SELECT 1 FROM public.blocked_slots b
      WHERE b.professional_id = v_final_professional_id
        AND b.start_time < v_end_time
        AND b.end_time > v_start_time
    ) THEN
      RAISE EXCEPTION 'Este horário encontra-se bloqueado para agendamentos.';
    END IF;
  END IF;

  -- 6. Inserir agendamento
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
    v_start_time,
    v_end_time,
    'confirmed',
    'pending'
  ) RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_appointment_by_token(uuid, uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_by_token(uuid, uuid, uuid, date, text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Atualização de public.cancel_appointment_by_token
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(
  p_token uuid,
  p_appointment_id uuid,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer_id uuid;
  v_tenant_id uuid;
  v_token_expirado_em timestamptz;
  v_min_cancellation_lead_time integer;
  v_start_time timestamptz;
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

  -- 2. Obter dados do agendamento
  SELECT start_time INTO v_start_time
  FROM public.appointments
  WHERE id = p_appointment_id 
    AND customer_id = v_customer_id 
    AND tenant_id = v_tenant_id;

  IF v_start_time IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou não pertence a este cliente.';
  END IF;

  -- Bloquear cancelamento de agendamento que já ocorreu
  IF v_start_time <= now() THEN
    RAISE EXCEPTION 'Não é possível cancelar um agendamento que já ocorreu ou está em andamento.'
      USING errcode = '22023';
  END IF;

  -- 3. Obter regra de antecedência de cancelamento do tenant
  SELECT COALESCE(min_cancellation_lead_time_minutes, 120)
  INTO v_min_cancellation_lead_time
  FROM public.tenants
  WHERE id = v_tenant_id;

  -- Validar antecedência mínima para cancelamento online
  IF v_start_time < (now() + (v_min_cancellation_lead_time || ' minutes')::interval) THEN
    RAISE EXCEPTION 'APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED: O prazo para cancelamento online expirou (% minutos de antecedência mínima). Entre em contato diretamente com o profissional.', v_min_cancellation_lead_time
      USING errcode = '22023';
  END IF;

  -- 4. Cancelar agendamento
  UPDATE public.appointments
  SET 
    status = 'canceled',
    cancellation_reason = p_reason,
    updated_at = now()
  WHERE id = p_appointment_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_appointment_by_token(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, uuid, text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Atualização de public.reschedule_appointment_by_token
-- -----------------------------------------------------------------------------
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
SET search_path TO ''
AS $function$
DECLARE
  v_new_appointment_id uuid;
BEGIN
  -- 1. Cancelar o agendamento anterior (respeitará a trava de cancelamento)
  PERFORM public.cancel_appointment_by_token(p_token, p_old_appointment_id, 'Reagendamento concluído para novo horário');

  -- 2. Criar novo agendamento (respeitará a trava de antecedência e conflitos)
  v_new_appointment_id := public.create_appointment_by_token(
    p_token, 
    p_new_service_id, 
    p_new_professional_id, 
    p_new_date, 
    p_new_slot
  );

  RETURN v_new_appointment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Atualização de public.get_customer_appointments_by_token (com professional_phone)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_customer_appointments_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_customer_appointments_by_token(p_token uuid)
RETURNS TABLE(
  appointment_id uuid,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status text,
  payment_status text,
  cancellation_reason text,
  professional_name text,
  professional_id uuid,
  professional_phone text,
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
SET search_path TO ''
AS $function$
DECLARE
  v_customer_id uuid;
BEGIN
  -- Validar token e capturar customer_id
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.token_acesso = p_token 
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em > now());

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Token inválido ou expirado.';
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
    p.phone AS professional_phone,
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
  JOIN public.professionals p ON p.id = a.professional_id
  JOIN public.services s ON s.id = a.service_id
  JOIN public.tenants t ON t.id = a.tenant_id
  WHERE a.customer_id = v_customer_id
  ORDER BY a.start_time DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_customer_appointments_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_appointments_by_token(uuid) TO anon, authenticated, service_role;
