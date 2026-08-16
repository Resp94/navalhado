# 07 — Testes Integrados E2E, Auditoria de Segurança Supabase e Validação Visual Final

**What to build:**
Executar a verificação integral da suíte de testes automatizados, realizar a auditoria de advisors de segurança e performance no Supabase e conduzir o teste visual completo de ponta a ponta no navegador na porta 5173.

**Blocked by:** 01 — Migração de Banco Versionada 018, 02 — Validação de Nome e Sobrenome, 03 — Central 360 do Cliente, 04 — Associação Granular de Serviços, 05 — Parametrização Comercial de Serviços, 06 — Módulo de Produtos e Gestão de Estoque

**Status:** ready-for-agent

- [ ] Executar toda a suíte de testes com `npm run test` garantindo 100% de sucesso em todos os arquivos de teste.
- [ ] Executar linter (`oxlint` / `npm run lint`) e checagem de tipos TypeScript (`tsc -b`).
- [ ] Rodar auditoria com `get_advisors` (security e performance) no Supabase DEV para confirmar que não existem vulnerabilidades de RLS ou índices faltantes.
- [ ] Conduzir a validação visual interativa no navegador em `http://localhost:5173` navegando por todas as telas do Gerente (Agenda, Clientes com Central 360, Equipe, Serviços, Produtos, Financeiro) e fluxo de agendamento público do cliente.
