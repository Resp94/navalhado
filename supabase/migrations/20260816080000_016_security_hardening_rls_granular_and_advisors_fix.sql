-- =============================================================================
-- Migration 016: Security Hardening, Granular RLS Policies & Performance Indexes
-- Description:
--   1. Realoca extensões para o schema 'extensions' (ex: pg_net).
--   2. Cria índices de cobertura para foreign keys pendentes.
--   3. Remove overloads legados e restringe privilégios de execução de funções
--      internas e administrativas (SECURITY DEFINER).
--   4. Converte todas as políticas RLS permissivas 'ALL' das novas tabelas da
--      Spec 012 em políticas granulares (SELECT, INSERT, UPDATE, DELETE)
--      com base na autoridade do tenant e papel (gerente/barbeiro/proprietario).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensões: Realocação para o schema extensions
-- -----------------------------------------------------------------------------
DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 2. Performance: Índices de Cobertura para Foreign Keys
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_subscription_id 
  ON public.invoices(tenant_subscription_id);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_plan_id 
  ON public.tenant_subscriptions(plan_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_idempotency_instance_tenant 
  ON public.whatsapp_message_idempotency(whatsapp_instance_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_idempotency_appointment_tenant 
  ON public.whatsapp_message_idempotency(appointment_id, tenant_id);

-- -----------------------------------------------------------------------------
-- 3. Limpeza de Funções Legadas
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_appointment_by_token(uuid, uuid, uuid, timestamp with time zone);

-- -----------------------------------------------------------------------------
-- 4. Hardening de Privilégios de Execução (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

-- Funções de Trigger e Internas (Bloqueadas para API pública/autenticada)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_appointment_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_appointment_whatsapp_trigger() FROM PUBLIC, anon, authenticated;

-- Funções de Webhook / Service Role
REVOKE EXECUTE ON FUNCTION public.find_or_create_whatsapp_customer(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_whatsapp_customer(uuid, text, text) TO service_role;

-- Funções Administrativas / Gerenciais (Apenas usuários autenticados)
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_financial_metrics(timestamp with time zone, timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, date, uuid) TO authenticated;

-- Funções do Canal do Cliente (Baseadas em validação estrita de Token)
REVOKE EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(uuid, uuid, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_customer_registration(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_customer_registration(uuid, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_appointment_by_token(uuid, uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_by_token(uuid, uuid, uuid, date, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots_by_token(uuid, uuid, uuid, date, uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_customer_appointments_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_appointments_by_token(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_customer_details_by_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_details_by_token(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_professionals_by_customer_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_professionals_by_customer_token(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_services_by_customer_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_services_by_customer_token(uuid) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(uuid, uuid, uuid, uuid, date, text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Políticas Granulares de RLS (SELECT, INSERT, UPDATE, DELETE)
-- -----------------------------------------------------------------------------

-- 5.1 Tabela: products (Produtos / Estoque)
DROP POLICY IF EXISTS "Users can manage products in their tenant" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

CREATE POLICY "products_select_policy"
  ON public.products FOR SELECT
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR (tenant_id = (SELECT private.get_auth_tenant_id())));

CREATE POLICY "products_insert_policy"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

CREATE POLICY "products_update_policy"
  ON public.products FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))))
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "products_delete_policy"
  ON public.products FOR DELETE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

-- 5.2 Tabela: cash_sessions (Sessões de Caixa Diário)
DROP POLICY IF EXISTS "Users can manage cash_sessions in their tenant" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_select_policy" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert_policy" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update_policy" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_delete_policy" ON public.cash_sessions;

CREATE POLICY "cash_sessions_select_policy"
  ON public.cash_sessions FOR SELECT
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR (tenant_id = (SELECT private.get_auth_tenant_id())));

CREATE POLICY "cash_sessions_insert_policy"
  ON public.cash_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

CREATE POLICY "cash_sessions_update_policy"
  ON public.cash_sessions FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')))
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

CREATE POLICY "cash_sessions_delete_policy"
  ON public.cash_sessions FOR DELETE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

-- 5.3 Tabela: comandas (Comandas de Atendimento)
DROP POLICY IF EXISTS "Users can manage comandas in their tenant" ON public.comandas;
DROP POLICY IF EXISTS "comandas_select_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_insert_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_update_policy" ON public.comandas;
DROP POLICY IF EXISTS "comandas_delete_policy" ON public.comandas;

CREATE POLICY "comandas_select_policy"
  ON public.comandas FOR SELECT
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR (tenant_id = (SELECT private.get_auth_tenant_id())));

CREATE POLICY "comandas_insert_policy"
  ON public.comandas FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "comandas_update_policy"
  ON public.comandas FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))))
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "comandas_delete_policy"
  ON public.comandas FOR DELETE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

-- 5.4 Tabela: comanda_itens (Itens da Comanda)
DROP POLICY IF EXISTS "Users can manage comanda_itens in their tenant" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_select_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_insert_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_update_policy" ON public.comanda_itens;
DROP POLICY IF EXISTS "comanda_itens_delete_policy" ON public.comanda_itens;

CREATE POLICY "comanda_itens_select_policy"
  ON public.comanda_itens FOR SELECT
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR (tenant_id = (SELECT private.get_auth_tenant_id())));

CREATE POLICY "comanda_itens_insert_policy"
  ON public.comanda_itens FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "comanda_itens_update_policy"
  ON public.comanda_itens FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))))
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "comanda_itens_delete_policy"
  ON public.comanda_itens FOR DELETE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

-- 5.5 Tabela: comanda_pagamentos (Pagamentos da Comanda)
DROP POLICY IF EXISTS "Users can manage comanda_pagamentos in their tenant" ON public.comanda_pagamentos;
DROP POLICY IF EXISTS "comanda_pagamentos_select_policy" ON public.comanda_pagamentos;
DROP POLICY IF EXISTS "comanda_pagamentos_insert_policy" ON public.comanda_pagamentos;
DROP POLICY IF EXISTS "comanda_pagamentos_update_policy" ON public.comanda_pagamentos;
DROP POLICY IF EXISTS "comanda_pagamentos_delete_policy" ON public.comanda_pagamentos;

CREATE POLICY "comanda_pagamentos_select_policy"
  ON public.comanda_pagamentos FOR SELECT
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR (tenant_id = (SELECT private.get_auth_tenant_id())));

CREATE POLICY "comanda_pagamentos_insert_policy"
  ON public.comanda_pagamentos FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "comanda_pagamentos_update_policy"
  ON public.comanda_pagamentos FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')))
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

CREATE POLICY "comanda_pagamentos_delete_policy"
  ON public.comanda_pagamentos FOR DELETE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));

-- 5.6 Tabela: blocked_slots (Bloqueios de Horário na Grade)
DROP POLICY IF EXISTS "Users can manage blocked_slots in their tenant" ON public.blocked_slots;
DROP POLICY IF EXISTS "blocked_slots_select_policy" ON public.blocked_slots;
DROP POLICY IF EXISTS "blocked_slots_insert_policy" ON public.blocked_slots;
DROP POLICY IF EXISTS "blocked_slots_update_policy" ON public.blocked_slots;
DROP POLICY IF EXISTS "blocked_slots_delete_policy" ON public.blocked_slots;

CREATE POLICY "blocked_slots_select_policy"
  ON public.blocked_slots FOR SELECT
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR (tenant_id = (SELECT private.get_auth_tenant_id())));

CREATE POLICY "blocked_slots_insert_policy"
  ON public.blocked_slots FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR (((SELECT private.get_auth_role()) = 'barbeiro') AND (SELECT private.is_own_professional(blocked_slots.professional_id))))));

CREATE POLICY "blocked_slots_update_policy"
  ON public.blocked_slots FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR (((SELECT private.get_auth_role()) = 'barbeiro') AND (SELECT private.is_own_professional(blocked_slots.professional_id))))))
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR (((SELECT private.get_auth_role()) = 'barbeiro') AND (SELECT private.is_own_professional(blocked_slots.professional_id))))));

CREATE POLICY "blocked_slots_delete_policy"
  ON public.blocked_slots FOR DELETE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR (((SELECT private.get_auth_role()) = 'barbeiro') AND (SELECT private.is_own_professional(blocked_slots.professional_id))))));

-- 5.7 Tabela: waiting_list (Fila / Lista de Espera Diária)
DROP POLICY IF EXISTS "Users can manage waiting_list in their tenant" ON public.waiting_list;
DROP POLICY IF EXISTS "waiting_list_select_policy" ON public.waiting_list;
DROP POLICY IF EXISTS "waiting_list_insert_policy" ON public.waiting_list;
DROP POLICY IF EXISTS "waiting_list_update_policy" ON public.waiting_list;
DROP POLICY IF EXISTS "waiting_list_delete_policy" ON public.waiting_list;

CREATE POLICY "waiting_list_select_policy"
  ON public.waiting_list FOR SELECT
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR (tenant_id = (SELECT private.get_auth_tenant_id())));

CREATE POLICY "waiting_list_insert_policy"
  ON public.waiting_list FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "waiting_list_update_policy"
  ON public.waiting_list FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))))
  WITH CHECK ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND (((SELECT private.get_auth_role()) = 'gerente') OR ((SELECT private.get_auth_role()) = 'barbeiro'))));

CREATE POLICY "waiting_list_delete_policy"
  ON public.waiting_list FOR DELETE
  TO authenticated
  USING ((SELECT private.is_saas_admin()) OR ((tenant_id = (SELECT private.get_auth_tenant_id())) AND ((SELECT private.get_auth_role()) = 'gerente')));
