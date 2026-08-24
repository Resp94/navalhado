-- =============================================================================
-- Migration 037: Padronizar normalização de telefone em complete_customer_registration com private.normalize_br_phone
-- =============================================================================

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
  v_normalized_phone text := NULL;
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
    v_normalized_phone := private.normalize_br_phone(v_clean_phone);

    IF v_normalized_phone IS NULL THEN
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
