-- Migration: 20260817040000_022_hub_financeiro_commission_payouts_and_metrics.sql
-- Description: Hub Financeiro Operacional:
-- 1. Criação da tabela commission_payouts com RLS granular, índices cobrindo todas as chaves estrangeiras e subquery caching
-- 2. RPC atômica register_commission_payout para quitação de comissões aos profissionais
-- 3. Atualização da RPC get_tenant_financial_metrics para discriminar faturamento de serviços, venda de produtos (unidades e CMV) e repasses

-- 1. Criar tabela commission_payouts
CREATE TABLE IF NOT EXISTS public.commission_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL, -- 'pix', 'cash', 'transfer', 'other'
  notes text,
  paid_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices cobrindo todas as chaves estrangeiras (Supabase Postgres Best Practices)
CREATE INDEX IF NOT EXISTS idx_commission_payouts_tenant_id ON public.commission_payouts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_prof_id ON public.commission_payouts (professional_id);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_created_by ON public.commission_payouts (created_by);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_tenant_prof ON public.commission_payouts (tenant_id, professional_id, paid_at DESC);

-- Habilitar RLS Granular com Subquery Caching (SELECT auth.uid())
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.commission_payouts FROM public, anon;
GRANT SELECT, INSERT ON TABLE public.commission_payouts TO authenticated;

DROP POLICY IF EXISTS "commission_payouts_select_policy" ON public.commission_payouts;
CREATE POLICY "commission_payouts_select_policy" ON public.commission_payouts
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()))
    OR (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'proprietario'
  );

DROP POLICY IF EXISTS "commission_payouts_insert_policy" ON public.commission_payouts;
CREATE POLICY "commission_payouts_insert_policy" ON public.commission_payouts
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()))
    OR (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'proprietario'
  );

-- 2. RPC de Registro Atômico de Quitação
CREATE OR REPLACE FUNCTION public.register_commission_payout(
  p_professional_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_notes text DEFAULT NULL,
  p_paid_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_user_tenant uuid;
  v_target_tenant uuid;
  v_payout_id uuid;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT role, tenant_id INTO v_user_role, v_user_tenant
  FROM public.users
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('gerente', 'proprietario') THEN
    RAISE EXCEPTION 'Acesso negado. Apenas gerentes e proprietários podem registrar pagamentos de comissão.' USING errcode = '42501';
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    IF v_user_role <> 'proprietario' AND v_user_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'Acesso negado para esta unidade.' USING errcode = '42501';
    END IF;
    v_target_tenant := p_tenant_id;
  ELSE
    v_target_tenant := v_user_tenant;
  END IF;

  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Unidade não informada.' USING errcode = '22023';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.' USING errcode = '22023';
  END IF;

  -- Inserir quitação
  INSERT INTO public.commission_payouts (
    tenant_id,
    professional_id,
    amount,
    payment_method,
    notes,
    paid_at,
    created_by
  ) VALUES (
    v_target_tenant,
    p_professional_id,
    p_amount,
    p_payment_method,
    p_notes,
    COALESCE(p_paid_at, timezone('utc'::text, now())),
    v_user_id
  )
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout_id,
    'amount', p_amount,
    'professional_id', p_professional_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid) TO authenticated;

-- 3. Atualizar RPC get_tenant_financial_metrics para retornar métricas detalhadas (Serviços vs Produtos e Repasses)
CREATE OR REPLACE FUNCTION public.get_tenant_financial_metrics(
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_user_id uuid;
  v_user_tenant_id uuid;
  v_user_role text;
  v_target_tenant_id uuid;
  v_total_revenue numeric := 0.00;
  v_services_revenue numeric := 0.00;
  v_products_revenue numeric := 0.00;
  v_products_count integer := 0;
  v_products_cost numeric := 0.00;
  v_total_commission numeric := 0.00;
  v_paid_commission numeric := 0.00;
  v_pending_commission numeric := 0.00;
  v_net_revenue numeric := 0.00;
  v_revenue_by_method json;
  v_commissions_by_professional json;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT tenant_id, role INTO v_user_tenant_id, v_user_role
  FROM public.users
  WHERE id = v_user_id;

  IF v_user_role IS NULL OR v_user_role NOT IN ('gerente', 'proprietario') THEN
    RAISE EXCEPTION 'Acesso negado. Apenas gerentes e proprietários podem acessar métricas financeiras.' USING errcode = '42501';
  END IF;

  -- Resolver tenant_id de forma segura
  IF p_tenant_id IS NOT NULL THEN
    IF v_user_role <> 'proprietario' AND v_user_tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'Acesso negado para a unidade solicitada.' USING errcode = '42501';
    END IF;
    v_target_tenant_id := p_tenant_id;
  ELSE
    v_target_tenant_id := v_user_tenant_id;
  END IF;

  IF v_target_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Unidade (tenant_id) não informada.' USING errcode = '22023';
  END IF;

  -- 1. Faturamento Total
  SELECT COALESCE(SUM(c.total_amount), 0.00)
  INTO v_total_revenue
  FROM public.comandas c
  WHERE c.tenant_id = v_target_tenant_id
    AND c.status IN ('fechada', 'closed')
    AND c.closed_at >= p_start_date
    AND c.closed_at <= p_end_date;

  -- 2. Desdobramento de Itens (Serviços vs Produtos, Custos e Comissões)
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
  ),
  item_breakdown AS (
    SELECT 
      ci.id AS item_id,
      ci.professional_id,
      ci.quantity,
      ci.total_price,
      ci.item_type,
      ci.service_id,
      ci.product_id,
      COALESCE(prod.cost_price, 0.00) AS unit_cost,
      ROUND((ci.total_price * COALESCE(
        CASE 
          WHEN ci.item_type IN ('servico', 'service') OR ci.service_id IS NOT NULL THEN
            COALESCE(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0.0)
          WHEN ci.item_type IN ('produto', 'product') OR ci.product_id IS NOT NULL THEN
            COALESCE(prod.commission_percentage, 0.0)
          ELSE 0.0
        END, 0.0) / 100.0), 2) AS commission_amount
    FROM public.comanda_itens ci
    JOIN target_comandas tc ON tc.id = ci.comanda_id
    LEFT JOIN public.professionals prof ON prof.id = ci.professional_id
    LEFT JOIN public.services s ON s.id = ci.service_id
    LEFT JOIN public.professional_services ps ON ps.service_id = ci.service_id AND ps.professional_id = ci.professional_id AND ps.tenant_id = ci.tenant_id
    LEFT JOIN public.products prod ON prod.id = ci.product_id
  )
  SELECT 
    COALESCE(SUM(total_price) FILTER (WHERE item_type IN ('servico', 'service') OR service_id IS NOT NULL), 0.00),
    COALESCE(SUM(total_price) FILTER (WHERE item_type IN ('produto', 'product') OR product_id IS NOT NULL), 0.00),
    COALESCE(SUM(quantity) FILTER (WHERE item_type IN ('produto', 'product') OR product_id IS NOT NULL), 0),
    COALESCE(SUM(unit_cost * quantity) FILTER (WHERE item_type IN ('produto', 'product') OR product_id IS NOT NULL), 0.00),
    COALESCE(SUM(commission_amount), 0.00)
  INTO 
    v_services_revenue,
    v_products_revenue,
    v_products_count,
    v_products_cost,
    v_total_commission
  FROM item_breakdown;

  -- 3. Comissões Quitadas no Período
  SELECT COALESCE(SUM(amount), 0.00)
  INTO v_paid_commission
  FROM public.commission_payouts
  WHERE tenant_id = v_target_tenant_id
    AND paid_at >= p_start_date
    AND paid_at <= p_end_date;

  v_pending_commission := GREATEST(0.00, v_total_commission - v_paid_commission);
  v_net_revenue := v_total_revenue - v_total_commission - v_products_cost;

  -- 4. Faturamento por Método de Pagamento
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
  )
  SELECT COALESCE(json_object_agg(method, amount_sum), '{}'::json)
  INTO v_revenue_by_method
  FROM (
    SELECT 
      cp.payment_method AS method, 
      COALESCE(SUM(cp.amount), 0.00) AS amount_sum
    FROM public.comanda_pagamentos cp
    JOIN target_comandas tc ON tc.id = cp.comanda_id
    GROUP BY cp.payment_method
  ) s;

  -- 5. Comissões e Quantidade de Atendimentos por Profissional Ativo
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
  ),
  item_breakdown AS (
    SELECT 
      ci.id AS item_id,
      ci.professional_id,
      ci.total_price,
      ROUND((ci.total_price * COALESCE(
        CASE 
          WHEN ci.item_type IN ('servico', 'service') OR ci.service_id IS NOT NULL THEN
            COALESCE(ps.custom_commission_percentage, s.commission_percentage, prof.commission_percentage, 0.0)
          WHEN ci.item_type IN ('produto', 'product') OR ci.product_id IS NOT NULL THEN
            COALESCE(prod.commission_percentage, 0.0)
          ELSE 0.0
        END, 0.0) / 100.0), 2) AS commission_amount
    FROM public.comanda_itens ci
    JOIN target_comandas tc ON tc.id = ci.comanda_id
    LEFT JOIN public.professionals prof ON prof.id = ci.professional_id
    LEFT JOIN public.services s ON s.id = ci.service_id
    LEFT JOIN public.professional_services ps ON ps.service_id = ci.service_id AND ps.professional_id = ci.professional_id AND ps.tenant_id = ci.tenant_id
    LEFT JOIN public.products prod ON prod.id = ci.product_id
  ),
  prof_payouts AS (
    SELECT 
      professional_id,
      COALESCE(SUM(amount), 0.00) AS paid_amount
    FROM public.commission_payouts
    WHERE tenant_id = v_target_tenant_id
      AND paid_at >= p_start_date
      AND paid_at <= p_end_date
    GROUP BY professional_id
  ),
  prof_stats AS (
    SELECT 
      prof.id AS professional_id,
      prof.name AS professional_name,
      COALESCE(SUM(ib.commission_amount), 0.00) AS commission_sum,
      COALESCE(pp.paid_amount, 0.00) AS paid_sum,
      GREATEST(0.00, COALESCE(SUM(ib.commission_amount), 0.00) - COALESCE(pp.paid_amount, 0.00)) AS pending_sum,
      COUNT(ib.item_id) AS appointments_count
    FROM public.professionals prof
    LEFT JOIN item_breakdown ib ON ib.professional_id = prof.id
    LEFT JOIN prof_payouts pp ON pp.professional_id = prof.id
    WHERE prof.tenant_id = v_target_tenant_id
      AND prof.is_active = true
    GROUP BY prof.id, prof.name, pp.paid_amount
    ORDER BY commission_sum DESC, prof.name ASC
  )
  SELECT COALESCE(json_agg(json_build_object(
    'professional_id', professional_id,
    'professional_name', professional_name,
    'commission_sum', commission_sum,
    'paid_sum', paid_sum,
    'pending_sum', pending_sum,
    'appointments_count', appointments_count
  )), '[]'::json)
  INTO v_commissions_by_professional
  FROM prof_stats;

  RETURN json_build_object(
    'total_revenue', v_total_revenue,
    'services_revenue', v_services_revenue,
    'products_revenue', v_products_revenue,
    'products_count', v_products_count,
    'products_cost', v_products_cost,
    'total_commission', v_total_commission,
    'paid_commission', v_paid_commission,
    'pending_commission', v_pending_commission,
    'net_revenue', v_net_revenue,
    'revenue_by_method', v_revenue_by_method,
    'commissions_by_professional', v_commissions_by_professional
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone, uuid) TO authenticated;
