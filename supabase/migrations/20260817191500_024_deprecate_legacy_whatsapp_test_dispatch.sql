-- =========================================================================
-- MIGRAÇÃO SQL: 024_deprecate_legacy_whatsapp_test_dispatch.sql
-- Descontinuação do disparo avulso legado e consolidação no simulador de templates
-- =========================================================================

-- Atualiza a documentação da tabela whatsapp_instances registrando a consolidação
comment on table public.whatsapp_instances is
  'Instâncias de WhatsApp por barbearia com suporte a personalização de modelos de notificação e disparos de teste via simulador.';
