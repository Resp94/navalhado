-- =============================================================================
-- Migration 032: Palavras-chave WhatsApp, Telefone e Sessão em Link Público
-- =============================================================================

-- 1. Adicionar auto_reply_keywords na tabela whatsapp_instances
ALTER TABLE public.whatsapp_instances
ADD COLUMN IF NOT EXISTS auto_reply_keywords text DEFAULT 'agendar, marcar, horario, link, corte, barba, agenda, atendimento';

-- 2. Atualizar RPC complete_customer_registration com suporte a telefone e DDD
CREATE OR REPLACE FUNCTION public.complete_customer_registration(
  p_token uuid,
  p_name text,
  p_phone text DEFAULT NULL
)
RETURNS TABLE(
  customer_id uuid,
  customer_name text,
  customer_phone text,
  tenant_id uuid,
  tenant_name text,
  tenant_phone text,
  cadastro_completo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text := btrim(p_name);
  v_clean_phone text := NULL;
  v_row record;
BEGIN
  -- Validação de Nome e Sobrenome (mínimo de 2 palavras)
  IF v_name IS NULL 
     OR char_length(v_name) NOT BETWEEN 2 AND 100 
     OR array_length(regexp_split_to_array(v_name, '\s+'), 1) < 2 
  THEN
    RAISE EXCEPTION 'CUSTOMER_NAME_INVALID' USING errcode = '22023';
  END IF;

  -- Formatação e validação de telefone (se fornecido)
  IF p_phone IS NOT NULL AND btrim(p_phone) <> '' THEN
    v_clean_phone := regexp_replace(p_phone, '\D', '', 'g');
    -- Trata DDI 55 se ausente
    IF NOT v_clean_phone LIKE '55%' THEN
      IF length(v_clean_phone) = 10 THEN
        -- Adiciona 9 para celulares de 10 dígitos se DDD + 8 dígitos
        IF substring(v_clean_phone from 3 for 1) IN ('6', '7', '8', '9') THEN
          v_clean_phone := substring(v_clean_phone from 1 for 2) || '9' || substring(v_clean_phone from 3);
        END IF;
      END IF;
      IF length(v_clean_phone) IN (10, 11) THEN
        v_clean_phone := '55' || v_clean_phone;
      END IF;
    ELSE
      IF length(v_clean_phone) = 12 THEN
        IF substring(v_clean_phone from 5 for 1) IN ('6', '7', '8', '9') THEN
          v_clean_phone := substring(v_clean_phone from 1 for 4) || '9' || substring(v_clean_phone from 5);
        END IF;
      END IF;
    END IF;

    -- Deve ter padrão 55 + DDD (2 dígitos) + 8 ou 9 dígitos (12 ou 13 dígitos no total)
    IF length(v_clean_phone) NOT IN (12, 13) THEN
      RAISE EXCEPTION 'CUSTOMER_PHONE_INVALID' USING errcode = '22023';
    END IF;
  END IF;

  -- Atualização do cliente provisório
  UPDATE public.customers c
  SET name = v_name,
      phone = COALESCE(v_clean_phone, c.phone),
      cadastro_completo = true,
      updated_at = timezone('utc'::text, now())
  FROM public.tenants t
  WHERE c.tenant_id = t.id
    AND c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now())
    AND c.cadastro_completo = false
  RETURNING c.id as customer_id,
    c.name as customer_name,
    c.phone as customer_phone,
    c.tenant_id as tenant_id,
    t.name as tenant_name,
    t.phone as tenant_phone,
    c.cadastro_completo as cadastro_completo
  INTO v_row;

  IF FOUND THEN
    RETURN QUERY SELECT v_row.customer_id, v_row.customer_name, v_row.customer_phone,
      v_row.tenant_id, v_row.tenant_name, v_row.tenant_phone, v_row.cadastro_completo;
    RETURN;
  END IF;

  -- Se não encontrou cliente pendente, verifica se o token existe
  SELECT c.id, c.name, c.phone, c.tenant_id, t.name as tenant_name,
         t.phone as tenant_phone, c.cadastro_completo, c.token_expirado_em
  INTO v_row
  FROM public.customers c
  JOIN public.tenants t ON t.id = c.tenant_id
  WHERE c.token_acesso = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_INVALID' USING errcode = 'P0002';
  END IF;

  IF v_row.token_expirado_em IS NOT NULL AND v_row.token_expirado_em < now() THEN
    RAISE EXCEPTION 'TOKEN_EXPIRED' USING errcode = '22023';
  END IF;

  -- Se o cadastro já foi completado anteriormente, retorna idempotente com os dados atualizados
  UPDATE public.customers
  SET name = v_name,
      phone = COALESCE(v_clean_phone, phone),
      updated_at = timezone('utc'::text, now())
  WHERE id = v_row.id;

  RETURN QUERY SELECT v_row.id, v_name, COALESCE(v_clean_phone, v_row.phone),
    v_row.tenant_id, v_row.tenant_name, v_row.tenant_phone, true;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_customer_registration(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_customer_registration(uuid, text, text) TO anon, authenticated, service_role;

-- 3. Atualizar RPC get_or_create_provisional_customer_by_slug com suporte a reaproveitamento de token existente
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
  FROM public.tenants
  WHERE lower(slug) = lower(btrim(p_slug));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TENANT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- Se fornecido token existente, tenta reaproveitar o cliente daquele tenant se não expirado
  IF p_existing_token IS NOT NULL THEN
    SELECT * INTO v_cust
    FROM public.customers
    WHERE token_acesso = p_existing_token
      AND tenant_id = v_tenant.id
      AND (token_expirado_em IS NULL OR token_expirado_em >= now());

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

REVOKE ALL ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT, UUID) TO anon, authenticated, service_role;
