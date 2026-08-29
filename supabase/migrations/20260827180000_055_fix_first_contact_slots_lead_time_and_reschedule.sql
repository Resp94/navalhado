-- =============================================================================
-- Migration: 20260827180000_055_fix_first_contact_slots_lead_time_and_reschedule.sql
-- Descrição: 
--   1. Unificação canônica de get_available_slots e get_available_slots_by_token
--   2. Atualização de registration_origin padrão ('agenda') em public.customers
--   3. Isolamento estrito de trg_customer_welcome_balcao para cadastros balcão
--   4. Refatoração de reschedule_appointment_by_token para UPDATE atômico direto
--   5. Atualização do job pg_cron de lembretes com timeout seguro de 15s
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Unificar get_available_slots e limpar assinaturas sobrecarregadas
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_available_slots(uuid, date, uuid, uuid);
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
AS $function$
DECLARE
  v_duration integer;
  v_day_of_week text;
  v_day_bh_key text;
  v_start_time_str text;
  v_end_time_str text;
  v_break_start_str text;
  v_break_end_str text;
  v_timezone text;
  v_slot_interval integer;
  v_min_booking_lead_time integer;
  v_max_booking_ahead_days integer;
  v_tenant_start_str text;
  v_tenant_end_str text;
  v_tenant_active boolean;
  v_has_break boolean;
  v_now_in_tz timestamp;
  v_diff_days integer;
BEGIN
  -- 1. Obter configurações do tenant
  SELECT 
    COALESCE(timezone, 'America/Sao_Paulo'),
    COALESCE(slot_interval_minutes, 30),
    COALESCE(min_booking_lead_time_minutes, 30),
    COALESCE(max_booking_ahead_days, 60)
  INTO 
    v_timezone,
    v_slot_interval,
    v_min_booking_lead_time,
    v_max_booking_ahead_days
  FROM public.tenants 
  WHERE id = p_tenant_id;

  IF v_timezone IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado.';
  END IF;

  -- Validar limite de dias no futuro e passado
  v_now_in_tz := now() AT TIME ZONE v_timezone;
  v_diff_days := (p_date - (v_now_in_tz::date));
  IF v_diff_days < 0 OR v_diff_days > v_max_booking_ahead_days THEN
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
      COALESCE(weekly_schedule->v_day_of_week->>'start', weekly_schedule->v_day_bh_key->>'start'), 
      COALESCE(weekly_schedule->v_day_of_week->>'end', weekly_schedule->v_day_bh_key->>'end'), 
      COALESCE(weekly_schedule->v_day_of_week->>'break_start', weekly_schedule->v_day_bh_key->>'break_start'), 
      COALESCE(weekly_schedule->v_day_of_week->>'break_end', weekly_schedule->v_day_bh_key->>'break_end') 
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
    SELECT 
      COALESCE(business_hours->v_day_of_week->>'start', business_hours->v_day_bh_key->>'open', business_hours->v_day_bh_key->>'start', '08:00'),
      COALESCE(business_hours->v_day_of_week->>'end', business_hours->v_day_bh_key->>'close', business_hours->v_day_bh_key->>'end', '20:00'),
      COALESCE((business_hours->v_day_of_week->>'active')::boolean, (business_hours->v_day_bh_key->>'active')::boolean, true)
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
        COALESCE(prof.weekly_schedule->v_day_of_week->>'start', prof.weekly_schedule->v_day_bh_key->>'start') AS p_start,
        COALESCE(prof.weekly_schedule->v_day_of_week->>'end', prof.weekly_schedule->v_day_bh_key->>'end') AS p_end,
        COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') AS p_bstart,
        COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end') AS p_bend,
        COALESCE(ps.custom_duration_minutes, v_duration) AS p_dur,
        (
          COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') IS NOT NULL 
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end') IS NOT NULL 
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') < COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end')
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_start', prof.weekly_schedule->v_day_bh_key->>'break_start') > COALESCE(prof.weekly_schedule->v_day_of_week->>'start', prof.weekly_schedule->v_day_bh_key->>'start')
          AND COALESCE(prof.weekly_schedule->v_day_of_week->>'break_end', prof.weekly_schedule->v_day_bh_key->>'break_end') < COALESCE(prof.weekly_schedule->v_day_of_week->>'end', prof.weekly_schedule->v_day_bh_key->>'end')
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
        AND COALESCE(prof.weekly_schedule->v_day_of_week->>'start', prof.weekly_schedule->v_day_bh_key->>'start') IS NOT NULL
        AND COALESCE(prof.weekly_schedule->v_day_of_week->>'end', prof.weekly_schedule->v_day_bh_key->>'end') IS NOT NULL
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
$function$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Atualizar get_available_slots_by_token
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid);

CREATE OR REPLACE FUNCTION public.get_available_slots_by_token(
  p_token uuid,
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
  v_customer_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT c.id, c.tenant_id
  INTO v_customer_id, v_tenant_id
  FROM public.customers c
  WHERE c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em > now());

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired customer token' USING errcode = 'P0001';
  END IF;

  IF p_exclude_appointment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = p_exclude_appointment_id
      AND a.customer_id = v_customer_id
      AND a.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Appointment does not belong to customer token' USING errcode = 'P0001';
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

-- -----------------------------------------------------------------------------
-- 3. Atualizar registration_origin e trigger de boas-vindas
-- -----------------------------------------------------------------------------
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_registration_origin_check;
ALTER TABLE public.customers ADD CONSTRAINT customers_registration_origin_check
  CHECK (registration_origin IN ('balcao', 'agenda', 'online', 'importacao', 'canal_cliente', 'whatsapp_bot'));

ALTER TABLE public.customers ALTER COLUMN registration_origin SET DEFAULT 'agenda';

CREATE OR REPLACE FUNCTION public.fn_customer_welcome_balcao_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payload jsonb;
  v_secret text := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1);
BEGIN
  IF NEW.registration_origin = 'balcao'
     AND NEW.phone IS NOT NULL
     AND btrim(NEW.phone) <> ''
     AND NEW.welcome_sent_at IS NULL THEN

    v_payload := jsonb_build_object(
      'event', 'customer_welcome_balcao',
      'event_type', 'customer_welcome_balcao',
      'customer_id', NEW.id,
      'tenant_id', NEW.tenant_id
    );

    PERFORM net.http_post(
      url := 'https://selvxobcjbkligxighlp.supabase.co/functions/v1/whatsapp-integration/send-notification',
      body := v_payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-db-trigger-secret', v_secret
      ),
      timeout_milliseconds := 5000
    );
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RPCs de inserção com origens de cadastro explícitas
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.find_or_create_whatsapp_customer(uuid, text, text);

CREATE OR REPLACE FUNCTION public.find_or_create_whatsapp_customer(
  p_tenant_id uuid,
  p_phone text,
  p_name text DEFAULT 'Cliente'
)
RETURNS TABLE (
  customer_id uuid,
  token_acesso uuid,
  cadastro_completo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id uuid;
  v_token uuid;
  v_cadastro_completo boolean;
  v_norm_phone text;
BEGIN
  v_norm_phone := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_norm_phone) = 10 OR length(v_norm_phone) = 11 THEN
    v_norm_phone := '55' || v_norm_phone;
  END IF;

  SELECT c.id, c.token_acesso, c.cadastro_completo
  INTO v_customer_id, v_token, v_cadastro_completo
  FROM public.customers c
  WHERE c.tenant_id = p_tenant_id
    AND (
      c.telefone_normalizado = v_norm_phone
      OR c.phone = p_phone
      OR c.phone = v_norm_phone
    )
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    RETURN QUERY SELECT v_customer_id, v_token, v_cadastro_completo;
    RETURN;
  END IF;

  INSERT INTO public.customers (
    tenant_id,
    name,
    phone,
    telefone_normalizado,
    cadastro_completo,
    registration_origin
  )
  VALUES (
    p_tenant_id,
    COALESCE(p_name, 'Cliente'),
    p_phone,
    v_norm_phone,
    false,
    'whatsapp_bot'
  )
  RETURNING id, token_acesso, cadastro_completo
  INTO v_customer_id, v_token, v_cadastro_completo;

  RETURN QUERY SELECT v_customer_id, v_token, v_cadastro_completo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_whatsapp_customer(uuid, text, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Atualização de get_or_create_provisional_customer_by_slug
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_or_create_provisional_customer_by_slug(text, uuid);

CREATE OR REPLACE FUNCTION public.get_or_create_provisional_customer_by_slug(
  p_slug text,
  p_existing_token uuid DEFAULT NULL
)
RETURNS TABLE(
  token_acesso uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  tenant_slug text,
  cadastro_completo boolean,
  logo_url text,
  timezone text,
  business_hours jsonb,
  slot_interval_minutes integer,
  min_booking_lead_time_minutes integer,
  min_cancellation_lead_time_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant record;
  v_cust public.customers%ROWTYPE;
BEGIN
  SELECT * INTO v_tenant
  FROM public.tenants t
  WHERE lower(t.slug) = lower(btrim(p_slug));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

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
        COALESCE(v_tenant.slot_interval_minutes, 30)::integer,
        COALESCE(v_tenant.min_booking_lead_time_minutes, 30)::integer,
        COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::integer;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.customers (tenant_id, name, cadastro_completo, registration_origin)
  VALUES (v_tenant.id, 'Cliente', false, 'online')
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
    COALESCE(v_tenant.slot_interval_minutes, 30)::integer,
    COALESCE(v_tenant.min_booking_lead_time_minutes, 30)::integer,
    COALESCE(v_tenant.min_cancellation_lead_time_minutes, 120)::integer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_provisional_customer_by_slug(text, uuid) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Refatoração de reschedule_appointment_by_token para UPDATE atômico direto
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text);

CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(
  p_token uuid,
  p_appointment_id uuid,
  p_new_service_id uuid,
  p_new_professional_id uuid,
  p_new_date date,
  p_new_slot text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer_id uuid;
  v_tenant_id uuid;
  v_token_expirado_em timestamptz;
  v_min_cancellation_lead_time integer;
  v_min_booking_lead_time integer;
  v_timezone text;
  v_old_start_time timestamptz;
  v_old_status text;
  v_new_start_time timestamptz;
  v_new_end_time timestamptz;
  v_duration integer;
  v_day_of_week text;
  v_final_professional_id uuid;
BEGIN
  -- 1. Validar cliente por token
  SELECT c.id, c.tenant_id, c.token_expirado_em
  INTO v_customer_id, v_tenant_id, v_token_expirado_em
  FROM public.customers c
  WHERE c.token_acesso = p_token;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado ou token inválido.' USING errcode = 'P0002';
  END IF;

  IF v_token_expirado_em IS NOT NULL AND v_token_expirado_em < now() THEN
    RAISE EXCEPTION 'Seu acesso expirou. Por favor, solicite um novo link.' USING errcode = '22023';
  END IF;

  -- 2. Validar agendamento original
  SELECT a.start_time, a.status
  INTO v_old_start_time, v_old_status
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.customer_id = v_customer_id
    AND a.tenant_id = v_tenant_id;

  IF v_old_start_time IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING errcode = 'P0002';
  END IF;

  IF v_old_status = 'canceled' THEN
    RAISE EXCEPTION 'Agendamento cancelado não pode ser reagendado.' USING errcode = '22023';
  END IF;

  -- 3. Obter configurações do tenant
  SELECT 
    COALESCE(timezone, 'America/Sao_Paulo'),
    COALESCE(min_cancellation_lead_time_minutes, 120),
    COALESCE(min_booking_lead_time_minutes, 30)
  INTO 
    v_timezone,
    v_min_cancellation_lead_time,
    v_min_booking_lead_time
  FROM public.tenants
  WHERE id = v_tenant_id;

  -- Validar janela de cancelamento/reagendamento no agendamento antigo
  IF v_old_start_time < (now() + (v_min_cancellation_lead_time || ' minutes')::interval) THEN
    RAISE EXCEPTION 'O prazo limite para reagendar este agendamento expirou (% minutos antes). Entre em contato diretamente com o estabelecimento.', v_min_cancellation_lead_time
      USING errcode = '22023';
  END IF;

  -- 4. Calcular e validar novo horário
  v_new_start_time := ((p_new_date::text || ' ' || p_new_slot || ':00')::timestamp) AT TIME ZONE v_timezone;

  IF v_new_start_time < (now() + (v_min_booking_lead_time || ' minutes')::interval) THEN
    RAISE EXCEPTION 'Este horário não está mais disponível com a antecedência mínima necessária (% minutos).', v_min_booking_lead_time
      USING errcode = '22023';
  END IF;

  -- 5. Obter duração do serviço
  SELECT COALESCE(duration_minutes, 40)
  INTO v_duration
  FROM public.services
  WHERE id = p_new_service_id
    AND tenant_id = v_tenant_id
    AND is_active = true
    AND deleted_at IS NULL;

  IF v_duration IS NULL THEN
    RAISE EXCEPTION 'Serviço indisponível ou inexistente.' USING errcode = 'P0002';
  END IF;

  v_new_end_time := v_new_start_time + (v_duration || ' minutes')::interval;

  -- Determinar dia da semana
  SELECT CASE extract(dow from v_new_start_time AT TIME ZONE v_timezone)
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END INTO v_day_of_week;

  -- 6. Selecionar ou validar profissional
  IF p_new_professional_id IS NULL THEN
    SELECT prof.id INTO v_final_professional_id
    FROM public.professionals prof
    LEFT JOIN public.professional_services ps
      ON ps.professional_id = prof.id
      AND ps.service_id = p_new_service_id
      AND ps.tenant_id = v_tenant_id
    WHERE prof.tenant_id = v_tenant_id
      AND prof.is_active = true
      AND prof.deleted_at IS NULL
      AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
      AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
      AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
      AND v_new_start_time >= ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
      AND v_new_end_time <= ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
      AND (
        prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL 
        OR prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL
        OR NOT (
          v_new_start_time < ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
          AND v_new_end_time > ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.professional_id = prof.id
          AND a.id <> p_appointment_id
          AND a.status != 'canceled'
          AND a.start_time < v_new_end_time
          AND a.end_time > v_new_start_time
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.blocked_slots b
        WHERE (b.tenant_id = v_tenant_id AND (b.professional_id = prof.id OR b.professional_id IS NULL))
          AND b.start_time < v_new_end_time
          AND b.end_time > v_new_start_time
      )
    ORDER BY prof.name ASC
    LIMIT 1;

    IF v_final_professional_id IS NULL THEN
      RAISE EXCEPTION 'Não há profissionais disponíveis para este horário.' USING errcode = '22023';
    END IF;
  ELSE
    v_final_professional_id := p_new_professional_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.professionals prof
      LEFT JOIN public.professional_services ps
        ON ps.professional_id = prof.id
        AND ps.service_id = p_new_service_id
        AND ps.tenant_id = v_tenant_id
      WHERE prof.id = v_final_professional_id
        AND prof.tenant_id = v_tenant_id
        AND prof.is_active = true
        AND prof.deleted_at IS NULL
        AND (ps.is_enabled IS NULL OR ps.is_enabled = true)
        AND prof.weekly_schedule->v_day_of_week->>'start' IS NOT NULL
        AND prof.weekly_schedule->v_day_of_week->>'end' IS NOT NULL
        AND v_new_start_time >= ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'start') || ':00')::timestamp) AT TIME ZONE v_timezone
        AND v_new_end_time <= ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'end') || ':00')::timestamp) AT TIME ZONE v_timezone
        AND (
          prof.weekly_schedule->v_day_of_week->>'break_start' IS NULL 
          OR prof.weekly_schedule->v_day_of_week->>'break_end' IS NULL
          OR NOT (
            v_new_start_time < ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_end') || ':00')::timestamp) AT TIME ZONE v_timezone
            AND v_new_end_time > ((p_new_date::text || ' ' || (prof.weekly_schedule->v_day_of_week->>'break_start') || ':00')::timestamp) AT TIME ZONE v_timezone
          )
        )
    ) THEN
      RAISE EXCEPTION 'O profissional selecionado não atende neste horário ou não executa o serviço.' USING errcode = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.professional_id = v_final_professional_id
        AND a.id <> p_appointment_id
        AND a.status != 'canceled'
        AND a.start_time < v_new_end_time
        AND a.end_time > v_new_start_time
    ) THEN
      RAISE EXCEPTION 'O horário selecionado já está ocupado.' USING errcode = '22023';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.blocked_slots b
      WHERE (b.tenant_id = v_tenant_id AND (b.professional_id = v_final_professional_id OR b.professional_id IS NULL))
        AND b.start_time < v_new_end_time
        AND b.end_time > v_new_start_time
      ) THEN
      RAISE EXCEPTION 'O horário selecionado está bloqueado na agenda.' USING errcode = '22023';
    END IF;
  END IF;

  -- 7. Executar UPDATE direto no agendamento
  UPDATE public.appointments
  SET 
    service_id = p_new_service_id,
    professional_id = v_final_professional_id,
    start_time = v_new_start_time,
    end_time = v_new_end_time,
    reminder_sent = false,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_appointment_id
    AND tenant_id = v_tenant_id;

  RETURN p_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. Atualização do job pg_cron de lembretes com timeout seguro de 15s
-- -----------------------------------------------------------------------------
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-whatsapp-reminders';

SELECT cron.schedule(
  'process-whatsapp-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://selvxobcjbkligxighlp.supabase.co/functions/v1/whatsapp-integration/process-reminders',
    headers := json_build_object(
      'Content-Type', 'application/json',
      'x-db-trigger-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'whatsapp_db_trigger_secret' LIMIT 1)
    )::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
