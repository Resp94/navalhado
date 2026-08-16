# 02 — Repositórios de Domínio (ComandaRepository, CaixaRepository, BloqueioRepository) e Testes

**What to build:**
Implementar os módulos profundos de repositório e adaptadores Supabase para gerenciar a lógica de Comandas, Sessões de Caixa e Bloqueios de Horários, acompanhados de testes unitários isolados.

**Blocked by:** 01 — Migração de Banco Versionada (Comandas, Caixa, Bloqueios, Produtos, RLS e Limpeza RPC).

**Status:** ready-for-agent

- [x] Implementar `ComandaRepository` com métodos para abrir comanda, adicionar/remover serviços e produtos, aplicar descontos, calcular troco e liquidar com múltiplos pagamentos.
- [x] Implementar `CaixaRepository` com métodos para consultar sessão ativa, abrir caixa com fundo de troco inicial e registrar fechamento consolidado.
- [x] Implementar `BloqueioRepository` com métodos para criar bloqueios pontuais e excluir bloqueios.
- [x] Implementar adaptadores Supabase desacoplados (`SupabaseComandaAdapter`, `SupabaseCaixaAdapter`, `SupabaseBloqueioAdapter`).
- [x] Criar suítes de testes unitários (`ComandaRepository.test.ts`, `CaixaRepository.test.ts`, `BloqueioRepository.test.ts`) cobrindo 100% dos cálculos e regras de negócio.
