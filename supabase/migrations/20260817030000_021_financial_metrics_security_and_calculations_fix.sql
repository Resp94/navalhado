-- Migration: 20260817030000_021_financial_metrics_security_and_calculations_fix.sql
-- Description: Correção definitiva da RPC get_tenant_financial_metrics:
-- 1. Corrige nome da coluna total_amount em comandas e status 'fechada'/'closed'
-- 2. Elimina produto cartesiano / multiplicação de faturamento por itens
-- 3. Calcula comissões dinâmicas por item (serviço/produto/profissional) no período especificado
-- 4. Suporte seguro a proprietários e gerentes com parâmetro opcional p_tenant_id

DROP FUNCTION IF EXISTS public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone);

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
  v_total_commission numeric := 0.00;
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

  -- 1. Faturamento Total a partir das comandas fechadas
  SELECT COALESCE(SUM(c.total_amount), 0.00)
  INTO v_total_revenue
  FROM public.comandas c
  WHERE c.tenant_id = v_target_tenant_id
    AND c.status IN ('fechada', 'closed')
    AND c.closed_at >= p_start_date
    AND c.closed_at <= p_end_date;

  -- 2. Comissões dos Itens Fechados no Período
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
  ),
  item_commissions AS (
    SELECT 
      ci.id AS item_id,
      ci.professional_id,
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
  SELECT COALESCE(SUM(commission_amount), 0.00)
  INTO v_total_commission
  FROM item_commissions;

  v_net_revenue := v_total_revenue - v_total_commission;

  -- 3. Faturamento por Método de Pagamento
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

  -- 4. Comissões e Quantidade de Atendimentos por Profissional Ativo
  WITH target_comandas AS (
    SELECT c.id
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= p_start_date
      AND c.closed_at <= p_end_date
  ),
  item_commissions AS (
    SELECT 
      ci.id AS item_id,
      ci.professional_id,
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
  prof_stats AS (
    SELECT 
      prof.id AS professional_id,
      prof.name AS professional_name,
      COALESCE(SUM(ic.commission_amount), 0.00) AS commission_sum,
      COUNT(ic.item_id) AS appointments_count
    FROM public.professionals prof
    LEFT JOIN item_commissions ic ON ic.professional_id = prof.id
    WHERE prof.tenant_id = v_target_tenant_id
      AND prof.is_active = true
    GROUP BY prof.id, prof.name
    ORDER BY commission_sum DESC, prof.name ASC
  )
  SELECT COALESCE(json_agg(json_build_object(
    'professional_id', professional_id,
    'professional_name', professional_name,
    'commission_sum', commission_sum,
    'appointments_count', appointments_count
  )), '[]'::json)
  INTO v_commissions_by_professional
  FROM prof_stats;

  RETURN json_build_object(
    'total_revenue', v_total_revenue,
    'total_commission', v_total_commission,
    'net_revenue', v_net_revenue,
    'revenue_by_method', v_revenue_by_method,
    'commissions_by_professional', v_commissions_by_professional
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone, uuid) TO authenticated;
