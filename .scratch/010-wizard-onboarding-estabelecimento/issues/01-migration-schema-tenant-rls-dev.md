# 01 — Migration de Schema do Tenant, RLS e Aplicação no Banco Dev via MCP

**What to build:**
A migração de banco de dados que estende a tabela `public.tenants` com todos os campos necessários para suportar o endereço completo, coordenadas de geolocalização, métricas comerciais e a flag de conclusão do onboarding, com índice parcial de performance, permissões RLS granulares para atualização pelo Gestor do tenant e aplicação no banco de dados Dev (`selvxobcjbkligxighlp`).

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Arquivo de migração `20260815120000_013_establishment_onboarding_wizard.sql` criado em `supabase/migrations/` com as novas colunas em `public.tenants` (`cep`, `address_street`, `address_number`, `address_neighborhood`, `address_city`, `address_state`, `latitude`, `longitude`, `base_cut_price`, `acquisition_channel`, `onboarding_completed boolean default false not null`).
- [ ] Índice parcial de performance criado para buscas de onboarding pendente (`idx_tenants_onboarding_completed` em `tenants (id)` onde `onboarding_completed = false`).
- [ ] Políticas RLS de `SELECT` e `UPDATE` em `public.tenants` configuradas para permitir que usuários autenticados com role `gerente` ou `proprietario` atualizem seu próprio tenant.
- [ ] Concessões de colunas (`GRANT SELECT, UPDATE (...) ON public.tenants TO authenticated`) aplicadas.
- [ ] Migração aplicada e validada com sucesso exclusivamente no banco **Dev** (`selvxobcjbkligxighlp`) via Supabase MCP `execute_sql`.
- [ ] Nenhuma alteração executada no banco de produção.
