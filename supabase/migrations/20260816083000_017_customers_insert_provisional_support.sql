-- =============================================================================
-- Migration 017: Allow Provisional Customer Insertion for Authenticated Staff
-- Description:
--   Atualiza a politica customers_insert_policy para permitir que usuarios
--   autenticados do tenant possam cadastrar clientes com cadastro_completo = false
--   (clientes provisorios / encaixes rapidos de balcao) ou true.
-- =============================================================================

DROP POLICY IF EXISTS customers_insert_policy ON public.customers;

CREATE POLICY customers_insert_policy ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT private.is_saas_admin())
  OR tenant_id = (SELECT private.get_auth_tenant_id())
);
