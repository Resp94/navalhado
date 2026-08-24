-- Migration: 044_fix_appointment_payment_status_and_customer_identity
-- Description: Corrige payment_status no agendamento por token, adiciona customer_phone na resolução por slug e preserva identidade ao agendar para terceiros
-- Date: 2026-08-24

-- 1. get_or_create_provisional_customer_by_slug: adiciona customer_phone nos retornos
DROP FUNCTION IF EXISTS public.get_or_create_provisional_customer_by_slug(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.get_or_create_provisional_customer_by_slug(
  p_slug TEXT,
  p_existing_token UUID DEFAULT NULL
)
RETURNS TABLE(
  token_acesso UUID,
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_slug TEXT,
  cadastro_completo BOOLEAN,
  logo_url TEXT,
  timezone TEXT,
  business_hours JSONB,
  slot_interval_minutes INTEGER,
  min_booking_lead_time_minutes INTEGER,
  min_cancellation_lead_time_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant RECORD;
  v_cust public.customers%ROWTYPE;
BEGIN
  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- Se fornecido token existente, tenta reaproveitar o cliente daquele tenant se não expirado
  IF p_existing_token IS NOT NULL THEN
    SELECT * INTO v_cust
    FROM public.customers c
    WHERE c.token_acesso = p_existing_token
      AND c.tenant_id = v_tenant.id
      AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now());

    IF FOUND THEN
      RETURN QUERY
      SELECT 
        v_cust.token_acesso,
        v_cust.id AS customer_id,
        v_cust.name AS customer_name,
        v_cust.phone AS customer_phone,
        v_tenant.id AS tenant_id,
        v_tenant.name AS tenant_name,
        v_tenant.phone AS tenant_phone,
        v_tenant.slug AS tenant_slug,
        v_cust.cadastro_completo,
        v_tenant.logo_url,
        COALESCE(v_tenant.timezone, 'America/Sao_Paulo') AS timezone,
        v_tenant.business_hours,
        COALESCE(v_tenant.slot_interval_minutes, 30)::INTEGER,
        COALESCE(v_tenant.min_booking_lead_time_minutes, 15)::INTEGER,
        COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::INTEGER;
      RETURN;
    END IF;
  END IF;

  -- Caso contrário, criar novo cliente provisório para a barbearia
  INSERT INTO public.customers (tenant_id, name, cadastro_completo)
  VALUES (v_tenant.id, 'Cliente', false)
  RETURNING * INTO v_cust;

  RETURN QUERY
  SELECT 
    v_cust.token_acesso,
    v_cust.id AS customer_id,
    v_cust.name AS customer_name,
    v_cust.phone AS customer_phone,
    v_tenant.id AS tenant_id,
    v_tenant.name AS tenant_name,
    v_tenant.phone AS tenant_phone,
    v_tenant.slug AS tenant_slug,
    v_cust.cadastro_completo,
    v_tenant.logo_url,
    COALESCE(v_tenant.timezone, 'America/Sao_Paulo') AS timezone,
    v_tenant.business_hours,
    COALESCE(v_tenant.slot_interval_minutes, 30)::INTEGER,
    COALESCE(v_tenant.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::INTEGER;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT, UUID) TO anon, authenticated, service_role;

-- 2. complete_customer_registration: resolução inteligente de merge e suporte a agendamento para terceiros
DROP FUNCTION IF EXISTS public.complete_customer_registration(uuid, text, text);

CREATE OR REPLACE FUNCTION public.complete_customer_registration(
  p_token uuid,
  p_name text,
  p_phone text DEFAULT NULL::text
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  customer_phone text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  cadastro_completo boolean,
  token_acesso uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(p_name);
  v_clean_phone text := NULL;
  v_normalized_phone text := NULL;
  v_current_cust public.customers%ROWTYPE;
  v_existing_cust public.customers%ROWTYPE;
  v_new_cust public.customers%ROWTYPE;
  v_tenant public.tenants%ROWTYPE;
BEGIN
  -- Validação de Nome e Sobrenome (mínimo de 2 palavras)
  IF v_name IS NULL 
     OR char_length(v_name) NOT BETWEEN 2 AND 100 
     OR array_length(regexp_split_to_array(v_name, '\s+'), 1) < 2 
  THEN
    RAISE EXCEPTION 'CUSTOMER_NAME_INVALID' USING errcode = '22023';
  END IF;

  -- Formatação e validação de telefone
  IF p_phone IS NOT NULL AND btrim(p_phone) <> '' THEN
    v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
    v_normalized_phone := private.normalize_br_phone(v_clean_phone);

    IF v_normalized_phone IS NULL THEN
      RAISE EXCEPTION 'CUSTOMER_PHONE_INVALID' USING errcode = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'CUSTOMER_PHONE_REQUIRED' USING errcode = '22023';
  END IF;

  -- Buscar cliente atual pelo token
  SELECT * INTO v_current_cust
  FROM public.customers c
  WHERE c.token_acesso = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_INVALID' USING errcode = 'P0002';
  END IF;

  IF v_current_cust.token_expirado_em IS NOT NULL AND v_current_cust.token_expirado_em < now() THEN
    RAISE EXCEPTION 'TOKEN_EXPIRED' USING errcode = '22023';
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_current_cust.tenant_id;

  -- Verificar se já existe OUTRO cliente com este telefone no mesmo tenant
  SELECT * INTO v_existing_cust
  FROM public.customers c
  WHERE c.tenant_id = v_current_cust.tenant_id
    AND c.telefone_normalizado = v_normalized_phone
    AND c.id <> v_current_cust.id;

  IF FOUND THEN
    -- Se já existe outro cliente com esse telefone, atualiza o nome dele e reaproveita a conta canônica
    UPDATE public.customers
    SET name = v_name,
        cadastro_completo = true,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_existing_cust.id
    RETURNING * INTO v_existing_cust;

    -- Se o cliente atual era provisório e não tem agendamentos/comandas, descarta o provisório redundante
    IF v_current_cust.cadastro_completo = false THEN
      IF NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.customer_id = v_current_cust.id)
         AND NOT EXISTS (SELECT 1 FROM public.comandas cmd WHERE cmd.customer_id = v_current_cust.id) THEN
        DELETE FROM public.customers WHERE id = v_current_cust.id;
      END IF;
    END IF;

    RETURN QUERY SELECT 
      v_existing_cust.id,
      v_existing_cust.name,
      v_existing_cust.phone,
      v_tenant.id,
      v_tenant.name,
      v_tenant.phone,
      true,
      v_existing_cust.token_acesso;
    RETURN;
  END IF;

  -- Se o cliente atual já era completo e informou um telefone diferente (agendando para outra pessoa):
  IF v_current_cust.cadastro_completo = true 
     AND v_current_cust.telefone_normalizado IS NOT NULL 
     AND v_current_cust.telefone_normalizado <> v_normalized_phone THEN
    
    -- Cria um novo perfil de cliente para essa pessoa sem sobrescrever o usuário principal
    INSERT INTO public.customers (
      tenant_id,
      name,
      phone,
      cadastro_completo
    ) VALUES (
      v_tenant.id,
      v_name,
      v_clean_phone,
      true
    )
    RETURNING * INTO v_new_cust;

    RETURN QUERY SELECT 
      v_new_cust.id,
      v_new_cust.name,
      v_new_cust.phone,
      v_tenant.id,
      v_tenant.name,
      v_tenant.phone,
      true,
      v_new_cust.token_acesso;
    RETURN;
  END IF;

  -- Caso padrão: atualiza o cliente atual (provisório ou atualização de dados próprios)
  UPDATE public.customers
  SET name = v_name,
      phone = v_clean_phone,
      cadastro_completo = true,
      updated_at = timezone('utc'::text, now())
  WHERE id = v_current_cust.id
  RETURNING * INTO v_current_cust;

  RETURN QUERY SELECT 
    v_current_cust.id,
    v_current_cust.name,
    v_current_cust.phone,
    v_tenant.id,
    v_tenant.name,
    v_tenant.phone,
    true,
    v_current_cust.token_acesso;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_customer_registration(uuid, text, text) TO anon, authenticated, service_role;

-- 3. create_appointment_by_token: define payment_status = 'pending'
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
    'online',
    'Agendamento realizado pelo canal do cliente'
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_appointment_by_token(uuid, uuid, uuid, date, text) TO anon, authenticated, service_role;

-- 4. Limpeza preventiva de clientes provisórios sem vínculos
DELETE FROM public.customers
WHERE cadastro_completo = false
  AND name = 'Cliente'
  AND phone IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.customer_id = customers.id)
  AND NOT EXISTS (SELECT 1 FROM public.comandas c WHERE c.customer_id = customers.id);
