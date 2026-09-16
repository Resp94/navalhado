-- Padroniza o isolamento das funções SECURITY DEFINER já existentes.
-- Os corpos usam referências qualificadas; o search_path vazio impede shadowing.
alter function public.adjust_product_stock(uuid, text, integer, numeric, text, uuid)
  set search_path = '';
alter function public.register_commission_payout(uuid, numeric, text, text, timestamptz, uuid)
  set search_path = '';
alter function public.settle_comanda(uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb)
  set search_path = '';
alter function public.reopen_comanda(uuid, uuid)
  set search_path = '';
alter function public.close_cash_session(uuid, uuid, numeric, text)
  set search_path = '';
alter function public.get_tenant_financial_metrics(timestamptz, timestamptz, uuid)
  set search_path = '';
alter function public.create_commission_obligations_from_closed_comanda()
  set search_path = '';
alter function public.backfill_financial_history(uuid, integer)
  set search_path = '';
alter function public.get_professional_commission_balance(uuid, timestamptz, timestamptz, uuid)
  set search_path = '';
alter function public.register_cash_session_adjustment(uuid, uuid, numeric, text)
  set search_path = '';
alter function public.validate_comanda_item_references()
  set search_path = '';
alter function public.settle_comanda_idempotent(uuid, uuid, uuid, uuid, uuid, numeric, numeric, uuid, jsonb, jsonb)
  set search_path = '';
alter function public.get_tenant_current_commission_balance(uuid)
  set search_path = '';
