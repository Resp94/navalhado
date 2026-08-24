-- Migration: 040_smart_customer_registration_merge
-- Description: Permite merge idempotente e seguro ao completar cadastro com telefone existente no tenant
-- Date: 2026-08-24

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
SET search_path TO ''
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
  FROM public.customers
  WHERE token_acesso = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOKEN_INVALID' USING errcode = 'P0002';
  END IF;

  IF v_current_cust.token_expirado_em IS NOT NULL AND v_current_cust.token_expirado_em < now() THEN
    RAISE EXCEPTION 'TOKEN_EXPIRED' USING errcode = '22023';
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = v_current_cust.tenant_id;

  -- Se forneceu telefone, verificar se já existe OUTRO cliente com este telefone no mesmo tenant
  IF v_normalized_phone IS NOT NULL THEN
    SELECT * INTO v_existing_cust
    FROM public.customers
    WHERE tenant_id = v_current_cust.tenant_id
      AND telefone_normalizado = v_normalized_phone
      AND id <> v_current_cust.id;

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
        IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE customer_id = v_current_cust.id)
           AND NOT EXISTS (SELECT 1 FROM public.comandas WHERE customer_id = v_current_cust.id) THEN
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
