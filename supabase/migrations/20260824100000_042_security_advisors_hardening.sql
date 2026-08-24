-- Migration: 042_security_advisors_hardening
-- Description: Corrige search_path em fn_auto_create_comanda_for_appointment e restringe privilégios EXECUTE de funções internas e administrativas
-- Date: 2026-08-24

-- 1. Corrigir search_path mutável e revogar acesso público de fn_auto_create_comanda_for_appointment
CREATE OR REPLACE FUNCTION public.fn_auto_create_comanda_for_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comanda_id UUID;
  v_service_price NUMERIC(10,2) := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.comandas WHERE appointment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT price INTO v_service_price FROM public.services WHERE id = NEW.service_id;
  IF v_service_price IS NULL THEN
    v_service_price := 0;
  END IF;

  INSERT INTO public.comandas (
    tenant_id,
    appointment_id,
    customer_id,
    status,
    total_amount,
    discount_amount,
    tip_amount,
    created_at
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    NEW.customer_id,
    CASE WHEN NEW.payment_status = 'paid' OR NEW.status = 'completed' THEN 'fechada' ELSE 'aberta' END,
    v_service_price,
    0,
    0,
    COALESCE(NEW.created_at, timezone('utc'::text, now()))
  ) RETURNING id INTO v_comanda_id;

  IF NEW.service_id IS NOT NULL THEN
    INSERT INTO public.comanda_itens (
      comanda_id,
      tenant_id,
      item_type,
      service_id,
      professional_id,
      quantity,
      unit_price,
      total_price,
      created_at
    ) VALUES (
      v_comanda_id,
      NEW.tenant_id,
      'servico',
      NEW.service_id,
      NEW.professional_id,
      1,
      v_service_price,
      v_service_price,
      COALESCE(NEW.created_at, timezone('utc'::text, now()))
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_auto_create_comanda_for_appointment() FROM public, anon, authenticated;

-- 2. Revogar EXECUTE da role anon para funções internas e administrativas
REVOKE EXECUTE ON FUNCTION public.log_audit_event(text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.adjust_product_stock(uuid, text, integer, numeric, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(uuid, text, integer, numeric, text, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_commission_payout(uuid, numeric, text, text, timestamp with time zone, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_pending_return_reminders(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_return_reminders(uuid) TO service_role;
