-- Migration: 041_fix_slug_and_token_ambiguity
-- Description: Corrige ambiguidade de colunas PL/pgSQL c.token_acesso e c.tenant_id em get_or_create_provisional_customer_by_slug e complete_customer_registration, e expande colunas de get_customer_details_by_token
-- Date: 2026-08-24

CREATE OR REPLACE FUNCTION public.get_or_create_provisional_customer_by_slug(
  p_slug TEXT,
  p_existing_token UUID DEFAULT NULL
)
RETURNS TABLE(
  token_acesso UUID,
  customer_id UUID,
  customer_name TEXT,
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

DROP FUNCTION IF EXISTS public.get_customer_details_by_token(uuid);

CREATE OR REPLACE FUNCTION public.get_customer_details_by_token(p_token uuid)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  customer_phone text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  tenant_address text,
  slot_interval_minutes integer,
  min_booking_lead_time_minutes integer,
  min_cancellation_lead_time_minutes integer,
  tenant_slug text,
  cadastro_completo boolean,
  tenant_timezone text,
  business_hours jsonb,
  logo_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS customer_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.phone AS tenant_phone,
    t.address AS tenant_address,
    COALESCE(t.slot_interval_minutes, 30)::INTEGER AS slot_interval_minutes,
    COALESCE(t.min_booking_lead_time_minutes, 15)::INTEGER AS min_booking_lead_time_minutes,
    COALESCE(t.min_cancellation_lead_time_minutes, 120)::INTEGER AS min_cancellation_lead_time_minutes,
    t.slug AS tenant_slug,
    c.cadastro_completo AS cadastro_completo,
    COALESCE(t.timezone, 'America/Sao_Paulo') AS tenant_timezone,
    t.business_hours AS business_hours,
    t.logo_url AS logo_url
  FROM public.customers c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado. Token inválido ou expirado.' USING errcode = 'P0002';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_customer_details_by_token(uuid) TO anon, authenticated, service_role;

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

  -- Se forneceu telefone, verificar se já existe OUTRO cliente com este telefone no mesmo tenant
  IF v_normalized_phone IS NOT NULL THEN
    SELECT * INTO v_existing_cust
    FROM public.customers c
    WHERE c.tenant_id = v_current_cust.tenant_id
      AND c.telefone_normalizado = v_normalized_phone
      AND c.id <> v_current_cust.id;

    -- Se já existe outro cliente com esse telefone:
    IF FOUND THEN
      -- Atualiza o nome e o cadastro do cliente existente com o telefone
      UPDATE public.customers
      SET name = v_name,
          cadastro_completo = true,
          updated_at = timezone('utc'::text, now())
      WHERE id = v_existing_cust.id
      RETURNING * INTO v_existing_cust;

      -- Se o cliente atual era provisório e não tem agendamentos/comandas associados, removemos o provisório redundante
      IF v_current_cust.cadastro_completo = false THEN
        IF NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.customer_id = v_current_cust.id)
           AND NOT EXISTS (SELECT 1 FROM public.comandas cmd WHERE cmd.customer_id = v_current_cust.id) THEN
          DELETE FROM public.customers WHERE id = v_current_cust.id;
        END IF;
      END IF;

      -- Retornamos os dados do cliente canônico (com seu token_acesso)
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
  END IF;

  -- Se não há conflito de telefone ou o telefone pertence a este próprio registro:
  UPDATE public.customers
  SET name = v_name,
      phone = COALESCE(v_clean_phone, phone),
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
