-- Migration 095: Versiona a paridade já validada em DEV para o resumo diário.
-- Não altera dados operacionais. Recria somente a RPC com as guardas de tenant,
-- fuso horário e pagamentos pertencentes a comandas fechadas.

CREATE OR REPLACE FUNCTION public.get_daily_financial_summary(
  p_start_date date,
  p_end_date date,
  p_time_zone text,
  p_tenant_id uuid DEFAULT NULL,
  p_cash_session_id uuid DEFAULT NULL
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
  v_tenant_time_zone text;
  v_result json;
BEGIN
  v_user_id := (SELECT auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT tenant_id, role
    INTO v_user_tenant_id, v_user_role
  FROM public.users
  WHERE id = v_user_id
    AND is_active = true;

  IF v_user_role IS NULL OR v_user_role NOT IN ('gerente', 'proprietario') THEN
    RAISE EXCEPTION 'Acesso negado. Apenas gerentes e proprietários podem acessar o resumo financeiro.' USING errcode = '42501';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date THEN
    RAISE EXCEPTION 'O período financeiro diário é inválido.' USING errcode = '22023';
  END IF;

  IF p_tenant_id IS NOT NULL THEN
    IF v_user_role <> 'proprietario' AND v_user_tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'Acesso negado para a unidade solicitada.' USING errcode = '42501';
    END IF;
    v_target_tenant_id := p_tenant_id;
  ELSE
    v_target_tenant_id := v_user_tenant_id;
  END IF;

  SELECT timezone
    INTO v_tenant_time_zone
  FROM public.tenants
  WHERE id = v_target_tenant_id;

  IF v_tenant_time_zone IS NULL OR btrim(v_tenant_time_zone) = '' THEN
    RAISE EXCEPTION 'O fuso horário da barbearia é obrigatório.' USING errcode = '22023';
  END IF;

  IF p_time_zone IS NULL OR btrim(p_time_zone) = '' OR p_time_zone <> v_tenant_time_zone THEN
    RAISE EXCEPTION 'O fuso horário informado não corresponde ao configurado na barbearia.' USING errcode = '22023';
  END IF;

  PERFORM now() AT TIME ZONE v_tenant_time_zone;

  WITH days AS (
    SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date AS local_date
  ),
  closed_comandas AS (
    SELECT
      (c.closed_at AT TIME ZONE v_tenant_time_zone)::date AS local_date,
      COALESCE(SUM(c.total_amount), 0.00) AS realized_revenue,
      COUNT(*)::integer AS closed_comandas_count
    FROM public.comandas c
    WHERE c.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND c.closed_at >= (p_start_date::timestamp AT TIME ZONE v_tenant_time_zone)
      AND c.closed_at < ((p_end_date + 1)::timestamp AT TIME ZONE v_tenant_time_zone)
    GROUP BY (c.closed_at AT TIME ZONE v_tenant_time_zone)::date
  ),
  payments AS (
    SELECT
      (cp.paid_at AT TIME ZONE v_tenant_time_zone)::date AS local_date,
      COALESCE(SUM(cp.amount), 0.00) AS received_total,
      COALESCE(SUM(cp.amount) FILTER (WHERE cp.payment_method = 'cash'), 0.00) AS dinheiro,
      COALESCE(SUM(cp.amount) FILTER (WHERE cp.payment_method = 'pix'), 0.00) AS pix,
      COALESCE(SUM(cp.amount) FILTER (WHERE cp.payment_method IN ('credit_card', 'debit_card')), 0.00) AS cartao,
      COALESCE(SUM(cp.amount) FILTER (WHERE cp.payment_method = 'other'), 0.00) AS outros,
      COUNT(*)::integer AS payment_count
    FROM public.comanda_pagamentos cp
    JOIN public.comandas c
      ON c.id = cp.comanda_id
     AND c.tenant_id = cp.tenant_id
    WHERE cp.tenant_id = v_target_tenant_id
      AND c.status IN ('fechada', 'closed')
      AND cp.paid_at >= (p_start_date::timestamp AT TIME ZONE v_tenant_time_zone)
      AND cp.paid_at < ((p_end_date + 1)::timestamp AT TIME ZONE v_tenant_time_zone)
      AND (p_cash_session_id IS NULL OR cp.cash_session_id = p_cash_session_id)
    GROUP BY (cp.paid_at AT TIME ZONE v_tenant_time_zone)::date
  )
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'date', d.local_date,
        'realized_revenue', COALESCE(cc.realized_revenue, 0.00),
        'received_total', COALESCE(p.received_total, 0.00),
        'by_method', json_build_object(
          'dinheiro', COALESCE(p.dinheiro, 0.00),
          'pix', COALESCE(p.pix, 0.00),
          'cartao', COALESCE(p.cartao, 0.00),
          'outros', COALESCE(p.outros, 0.00)
        ),
        'closed_comandas_count', COALESCE(cc.closed_comandas_count, 0),
        'payment_count', COALESCE(p.payment_count, 0)
      )
      ORDER BY d.local_date
    ),
    '[]'::json
  )
  INTO v_result
  FROM days d
  LEFT JOIN closed_comandas cc ON cc.local_date = d.local_date
  LEFT JOIN payments p ON p.local_date = d.local_date;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_daily_financial_summary(date, date, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_daily_financial_summary(date, date, text, uuid, uuid) TO authenticated;
