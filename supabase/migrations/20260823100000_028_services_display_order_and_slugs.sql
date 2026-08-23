-- =============================================================================
-- Migration: 028_services_display_order_and_slugs
-- Descrição: 1. Adiciona coluna display_order na tabela public.services para ordenação manual estratégica
--            2. Adiciona coluna slug na tabela public.tenants para links curtos de agendamento
--            3. Atualiza RPCs get_services_by_customer_token, get_public_tenant_by_slug e get_or_create_provisional_customer_by_slug
-- =============================================================================

-- 1. Coluna display_order na tabela public.services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- 2. Índice otimizado para ordenação de serviços por tenant
CREATE INDEX IF NOT EXISTS idx_services_tenant_display_order 
  ON public.services(tenant_id, display_order, created_at) 
  WHERE is_active = true;

-- 3. Coluna slug na tabela public.tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Função auxiliar para gerar slugs limpos
CREATE OR REPLACE FUNCTION private.slugify(value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result TEXT;
BEGIN
  IF value IS NULL OR btrim(value) = '' THEN
    RETURN NULL;
  END IF;
  
  v_result := translate(lower(value), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
  -- Substituir qualquer caractere não alfanumérico por hífen
  v_result := regexp_replace(v_result, '[^a-z0-9]+', '-', 'g');
  -- Remover hifens no início e fim
  v_result := regexp_replace(v_result, '^-+|-+$', '', 'g');
  
  RETURN v_result;
END;
$$;

-- Preencher slugs para tenants existentes que ainda não possuam slug
DO $$
DECLARE
  r RECORD;
  v_base_slug TEXT;
  v_slug TEXT;
  v_counter INTEGER;
BEGIN
  FOR r IN SELECT id, name FROM public.tenants WHERE slug IS NULL OR slug = '' LOOP
    v_base_slug := private.slugify(r.name);
    IF v_base_slug IS NULL OR v_base_slug = '' THEN
      v_base_slug := 'barbearia';
    END IF;
    
    v_slug := v_base_slug;
    v_counter := 1;
    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug AND id <> r.id) LOOP
      v_counter := v_counter + 1;
      v_slug := v_base_slug || '-' || v_counter;
    END LOOP;
    
    UPDATE public.tenants SET slug = v_slug WHERE id = r.id;
  END LOOP;
END;
$$;

-- Criar índice único de busca por slug em tenants
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);

-- 4. Atualizar RPC get_services_by_customer_token para retornar e ordenar por display_order
DROP FUNCTION IF EXISTS public.get_services_by_customer_token(UUID);

CREATE OR REPLACE FUNCTION public.get_services_by_customer_token(p_token UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  price NUMERIC,
  duration_minutes INTEGER,
  category TEXT,
  display_order INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Validar token e capturar tenant_id
  SELECT c.tenant_id INTO v_tenant_id
  FROM public.customers c
  WHERE c.token_acesso = p_token 
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em > now());

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado. Token inválido ou expirado.';
  END IF;

  RETURN QUERY
  SELECT 
    s.id, 
    s.name, 
    s.description, 
    s.price, 
    s.duration_minutes, 
    s.category,
    s.display_order
  FROM public.services s
  WHERE s.tenant_id = v_tenant_id
    AND s.is_active = true
  ORDER BY s.display_order ASC, s.created_at ASC, s.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_services_by_customer_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_services_by_customer_token(UUID) TO anon, authenticated, service_role;

-- 5. RPC get_public_tenant_by_slug para inicialização e links curtos
DROP FUNCTION IF EXISTS public.get_public_tenant_by_slug(TEXT);

CREATE OR REPLACE FUNCTION public.get_public_tenant_by_slug(p_slug TEXT)
RETURNS TABLE(
  tenant_id UUID,
  tenant_name TEXT,
  tenant_phone TEXT,
  tenant_slug TEXT,
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
  v_cleaned_slug TEXT := lower(btrim(p_slug));
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.phone AS tenant_phone,
    t.slug AS tenant_slug,
    t.logo_url,
    COALESCE(t.timezone, 'America/Sao_Paulo') AS timezone,
    t.business_hours,
    COALESCE(t.slot_interval_minutes, 30)::INTEGER,
    COALESCE(t.min_booking_lead_time_minutes, 15)::INTEGER,
    COALESCE(t.min_cancellation_lead_time_minutes, 120)::INTEGER
  FROM public.tenants t
  WHERE lower(t.slug) = v_cleaned_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_tenant_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_by_slug(TEXT) TO anon, authenticated, service_role;

-- 6. RPC get_or_create_provisional_customer_by_slug para inicializar cliente a partir do link curto
CREATE OR REPLACE FUNCTION public.get_or_create_provisional_customer_by_slug(p_slug TEXT)
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

  -- Criar cliente provisório para a barbearia
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

REVOKE ALL ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_provisional_customer_by_slug(TEXT) TO anon, authenticated, service_role;
