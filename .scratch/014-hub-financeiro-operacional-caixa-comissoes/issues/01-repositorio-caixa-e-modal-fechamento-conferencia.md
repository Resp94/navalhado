# 01 — Repositório de Caixa & Modal de Fechamento com Conferência

**What to build:**
Extensão do módulo de caixa (`CaixaRepository` e `SupabaseCaixaAdapter`) para suportar a listagem histórica de sessões de caixa (`listarHistorico`) e criação do componente acessível `FechamentoCaixaModal.tsx`, permitindo que o operador informe o valor físico contado na gaveta, visualize o confronto com as entradas em dinheiro do turno (calculando automaticamente quebras ou sobras de caixa) e finalize a sessão de caixa com observações.

**Blocked by:**
None — can start immediately.

**Status:** ready-for-agent

- [ ] Adicionar método `listarHistorico(tenantId: string, limit?: number)` em `ICaixaAdapter`, `SupabaseCaixaAdapter` e `CaixaRepository` ordenado por `opened_at DESC`.
- [ ] Criar componente acessível `FechamentoCaixaModal.tsx` com máscara monetária em BRL, exibição do fundo de troco inicial e cálculo de diferença entre o valor apurado e o valor contado na gaveta.
- [ ] Integrar chamada de `closeSession` via `CaixaRepository` persistindo `closing_amount`, `closed_by` e `notes`.
- [ ] Adicionar testes unitários em `CaixaRepository.test.ts` validando a nova funcionalidade de histórico e fechamento com conferência.
