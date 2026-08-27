-- Migration: 053_lookup_customer_by_phone_rpc
-- Description: Cria RPC segura para reconhecimento e preenchimento de dados de clientes cadastrados pelo telefone no fluxo de agendamento público
-- Date: 2026-08-26

CREATE OR REPLACE FUNCTION public.lookup_customer_by_phone(
  p_token uuid,
  p_phone text
)
RETURNS TABLE(
  found boolean,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  cadastro_completo boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id uuid;
  v_normalized_phone text;
  v_cust public.customers%ROWTYPE;
BEGIN
  -- 1. Obter tenant_id a partir do token de sessão pública/provisória
  SELECT c.tenant_id INTO v_tenant_id
  FROM public.customers c
  WHERE c.token_acesso = p_token
    AND (c.token_expirado_em IS NULL OR c.token_expirado_em >= now());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_INVALID' USING errcode = 'P0002';
  END IF;

  -- 2. Normalizar o telefone de busca
  v_normalized_phone := private.normalize_br_phone(p_phone);
  IF v_normalized_phone IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, false;
    RETURN;
  END IF;

  -- 3. Buscar cliente existente cadastrado com este telefone dentro deste tenant
  SELECT * INTO v_cust
  FROM public.customers c
  WHERE c.tenant_id = v_tenant_id
    AND c.telefone_normalizado = v_normalized_phone
    AND c.name IS NOT NULL
    AND c.name <> 'Cliente'
  ORDER BY c.cadastro_completo DESC, c.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT true, v_cust.id, v_cust.name, v_cust.phone, v_cust.cadastro_completo;
  ELSE
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, NULL::text, false;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_customer_by_phone(uuid, text) TO anon, authenticated, service_role;
