# 01 — Migração de Schema no Supabase e Infraestrutura de Roteamento Canônico

**What to build:**
Adicionar suporte no banco de dados para os metadados da agenda (`is_fitting`, `notes`, `origin`, status `in_progress` e `no_show`, constraint GIST anti-conflito e índices parciais) e configurar o roteamento canônico `/agenda` no frontend com redirecionamento de `/dashboard`, garantindo que o sistema continue 100% funcional.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] Arquivo de migração `20260815130000_014_agenda_enhancements_and_status.sql` criado e aplicado via Supabase MCP no projeto DEV (`selvxobcjbkligxighlp`).
- [x] Colunas `is_fitting`, `notes` e `origin` adicionadas à tabela `public.appointments`.
- [x] Constraints `appointments_status_check`, `appointments_origin_check` e `appointments_no_professional_overlap` atualizadas no Postgres.
- [x] Rota `/agenda` declarada em `App.tsx` com redirecionamento transparente de `/dashboard` para `/agenda`.
- [x] Destinos de navegação do Gerente atualizados em `GerenteLayout.tsx`, `AuthGuard.tsx`, `Login.tsx` e `OnboardingWizard.tsx`.
