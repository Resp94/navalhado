-- =============================================================================
-- Migration 052: Expandir restricao registration_origin para clientes
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customers_registration_origin_check'
  ) THEN
    ALTER TABLE public.customers DROP CONSTRAINT customers_registration_origin_check;
  END IF;

  ALTER TABLE public.customers
    ADD CONSTRAINT customers_registration_origin_check
    CHECK (registration_origin IN ('balcao', 'online', 'importacao', 'canal_cliente', 'whatsapp_bot'));
END $$;
