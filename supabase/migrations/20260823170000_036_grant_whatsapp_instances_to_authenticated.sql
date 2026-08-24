-- =============================================================================
-- Migration 036: Conceder permissões de SELECT e UPDATE na tabela whatsapp_instances para usuários autenticados (com RLS)
-- =============================================================================

GRANT SELECT, UPDATE ON public.whatsapp_instances TO authenticated;
