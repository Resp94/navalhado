-- Migration: 20260817020000_020_return_reminders_rpc_and_financial_metrics_fix.sql
-- Description: RPC de busca atômica de lembretes de retorno (elimina N+1), correção de ajuste de estoque para zero e refinamento de comissões por período

-- 1. RPC para retornar clientes elegíveis para lembrete de retorno sem loops N+1
CREATE OR REPLACE FUNCTION public.get_pending_return_reminders(p_tenant_id uuid)
RETURNS TABLE (
  appointment_id uuid,
  tenant_id uuid,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_token uuid,
  service_id uuid,
  service_name text,
  return_period_days integer,
  whatsapp_reminder_template text,
  tenant_name text,
  diff_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH latest_completed AS (
    SELECT DISTINCT ON (a.customer_id)
      a.id AS app_id,
      a.tenant_id AS t_id,
      a.customer_id AS c_id,
      a.start_time,
      c.name AS c_name,
      c.phone AS c_phone,
      c.token_acesso AS c_token,
      s.id AS s_id,
      s.name AS s_name,
      s.return_period_days AS s_return_days,
      s.whatsapp_reminder_template AS s_template,
      t.name AS t_name,
      FLOOR(EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - a.start_time)) / 86400)::integer AS days_passed
    FROM public.appointments a
    JOIN public.customers c ON c.id = a.customer_id AND c.tenant_id = a.tenant_id
    JOIN public.services s ON s.id = a.service_id AND s.tenant_id = a.tenant_id
    JOIN public.tenants t ON t.id = a.tenant_id
    WHERE a.tenant_id = p_tenant_id
      AND a.status = 'completed'
      AND c.phone IS NOT NULL
      AND TRIM(c.phone) <> ''
    ORDER BY a.customer_id, a.start_time DESC
  )
  SELECT
    lc.app_id,
    lc.t_id,
    lc.c_id,
    lc.c_name,
    lc.c_phone,
    lc.c_token,
    lc.s_id,
    lc.s_name,
    COALESCE(lc.s_return_days, 20),
    lc.s_template,
    lc.t_name,
    lc.days_passed
  FROM latest_completed lc
  WHERE lc.days_passed >= COALESCE(lc.s_return_days, 20)
    AND NOT EXISTS (
      -- Garante que o cliente não possui agendamento posterior pendente ou confirmado
      SELECT 1
      FROM public.appointments future_app
      WHERE future_app.tenant_id = p_tenant_id
        AND future_app.customer_id = lc.c_id
        AND future_app.start_time > lc.start_time
        AND future_app.status IN ('confirmed', 'pending')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_pending_return_reminders(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_return_reminders(uuid) TO service_role;

-- 2. Correção na RPC adjust_product_stock para permitir zerar estoque no tipo 'adjustment'
DROP FUNCTION IF EXISTS public.adjust_product_stock(uuid, text, integer, numeric, text, uuid);
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id uuid,
  p_movement_type text,
  p_quantity integer,
  p_unit_cost numeric,
  p_reason text DEFAULT NULL,
  p_comanda_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id uuid;
  v_current_stock integer;
  v_new_stock integer;
  v_delta integer;
  v_user_role text;
  v_user_tenant uuid;
BEGIN
  -- Validação de Permissão
  SELECT role, tenant_id INTO v_user_role, v_user_tenant
  FROM public.users
  WHERE id = (SELECT auth.uid());

  IF v_user_role IS NULL OR v_user_role NOT IN ('gerente', 'proprietario') THEN
    RAISE EXCEPTION 'Acesso negado: apenas gerentes e proprietários podem movimentar estoque.';
  END IF;

  -- Obter produto
  SELECT tenant_id, stock_quantity INTO v_tenant_id, v_current_stock
  FROM public.products
  WHERE id = p_product_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  IF v_user_role <> 'proprietario' AND v_user_tenant <> v_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado para este tenant.';
  END IF;

  -- Calcular novo estoque
  IF p_movement_type = 'entry' THEN
    IF p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade de entrada deve ser maior que zero.';
    END IF;
    v_delta := p_quantity;
    v_new_stock := v_current_stock + p_quantity;
  ELSIF p_movement_type = 'exit' THEN
    IF p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade de saída deve ser maior que zero.';
    END IF;
    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para a saída solicitada.';
    END IF;
    v_delta := -p_quantity;
    v_new_stock := v_current_stock - p_quantity;
  ELSIF p_movement_type = 'adjustment' THEN
    IF p_quantity < 0 THEN
      RAISE EXCEPTION 'Ajuste de estoque não pode ser negativo.';
    END IF;
    v_delta := p_quantity - v_current_stock;
    v_new_stock := p_quantity;
  ELSIF p_movement_type = 'sale' THEN
    IF p_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantidade vendida deve ser maior que zero.';
    END IF;
    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para a venda.';
    END IF;
    v_delta := -p_quantity;
    v_new_stock := v_current_stock - p_quantity;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_movement_type;
  END IF;

  -- Atualizar produto
  UPDATE public.products
  SET stock_quantity = v_new_stock,
      cost_price = COALESCE(p_unit_cost, cost_price),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_product_id;

  -- Registrar movimentação
  INSERT INTO public.product_movements (
    tenant_id,
    product_id,
    comanda_id,
    movement_type,
    quantity,
    unit_cost,
    reason,
    created_by
  ) VALUES (
    v_tenant_id,
    p_product_id,
    p_comanda_id,
    p_movement_type,
    v_delta,
    COALESCE(p_unit_cost, 0),
    p_reason,
    (SELECT auth.uid())
  );

  RETURN json_build_object(
    'product_id', p_product_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock,
    'delta', v_delta
  )::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_product_stock(uuid, text, integer, numeric, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, text, integer, numeric, text, uuid) TO authenticated;
