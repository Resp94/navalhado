-- Migration: 045_fix_appointment_origin_check
-- Description: Ajusta origin para client_channel em create_appointment_by_token e flexibiliza appointments_origin_check para aceitar online
-- Date: 2026-08-24

-- 1. Flexibilizar constraint appointments_origin_check
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_origin_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_origin_check 
  CHECK (origin = ANY (ARRAY['manual'::text, 'whatsapp'::text, 'client_channel'::text, 'online'::text]));

-- 2. Atualizar create_appointment_by_token com origin = 'client_channel' e payment_status = 'pending'
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
        WHERE (b.tenant_id = v_tenant_id AND (b.professional_id = prof.id OR b.professional_id IS NULL))
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
      WHERE (b.tenant_id = v_tenant_id AND (b.professional_id = v_final_professional_id OR b.professional_id IS NULL))
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
    payment_status,
    origin,
    notes
  ) VALUES (
    v_tenant_id,
    v_customer_id,
    v_final_professional_id,
    p_service_id,
    v_start_time,
    v_end_time,
    'confirmed',
    'pending',
    'client_channel',
    'Agendamento realizado pelo canal do cliente'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_appointment_by_token(uuid, uuid, uuid, date, text) TO anon, authenticated, service_role;
