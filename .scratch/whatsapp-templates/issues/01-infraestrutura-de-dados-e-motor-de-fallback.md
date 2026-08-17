# 01 — Infraestrutura de Dados e Motor de Fallback Seguro de Mensagens

**What to build:** 
A fundação completa de dados e a camada pura de formatação e interpolação de mensagens personalizadas com garantia de não-regressão. O sistema passa a persistir 5 colunas de templates dedicadas por barbearia na tabela `whatsapp_instances` (`template_confirmation`, `template_reschedule`, `template_cancellation`, `template_reminder`, `template_first_contact`) com restrição de tamanho máximo de 2.000 caracteres, respeitando as políticas de RLS e concessões de segurança. O módulo de formatação pura é capaz de substituir dinamicamente todas as variáveis declaradas (`{cliente}`, `{barbearia}`, `{servico}`, `{profissional}`, `{data}`, `{horario}`, `{link}`) e, caso qualquer campo seja nulo ou vazio, recorrer imediatamente ao dicionário de textos canônicos de fábrica (`DEFAULT_TEMPLATES`).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Migração versionada no PostgreSQL adicionando as 5 colunas `TEXT` na tabela `whatsapp_instances` com restrições `CHECK (length <= 2000)`.
- [ ] Concessões de colunas (`GRANT SELECT` e `GRANT UPDATE`) atualizadas para a role `authenticated` mantendo o isolamento multi-tenant por RLS.
- [ ] Dicionário imutável `DEFAULT_TEMPLATES` com os 5 textos canônicos originais do sistema.
- [ ] Função pura `interpolateTemplate` que substitui com precisão tokens no formato `{chave}` por seus valores correspondentes.
- [ ] Função pura de validação `validateTemplateHasLink` que verifica a presença da tag `{link}` (case-insensitive).
- [ ] Testes unitários puros com 100% de aprovação cobrindo interpolação, fallback de valores nulos e validação de link.
