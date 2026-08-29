-- Corrige a criação de clientes pelo primeiro contato do WhatsApp.
-- O nome token_acesso também é uma coluna do RETURNS TABLE; por isso o
-- RETURNING precisa qualificar as colunas da tabela de destino.

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

  INSERT INTO public.customers AS customer_target (
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
  RETURNING customer_target.id,
            customer_target.token_acesso,
            customer_target.cadastro_completo
  INTO v_customer_id, v_token, v_cadastro_completo;

  RETURN QUERY SELECT v_customer_id, v_token, v_cadastro_completo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_whatsapp_customer(uuid, text, text)
  TO authenticated, service_role;
