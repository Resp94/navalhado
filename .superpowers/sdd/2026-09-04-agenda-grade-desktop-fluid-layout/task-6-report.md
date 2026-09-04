# Task 6 — Tornar o desempate das lanes determinístico

## Implementado

- `src/lib/agenda-layout.ts`: preservada a ordenação por `startMs` e pela prioridade de regulares antes de encaixes; adicionado desempate determinístico por `id`.
- `src/lib/__tests__/agenda-layout.test.ts`: adicionado teste com três cards regulares concorrentes em duas ordens de entrada, garantindo saída idêntica.
- `src/pages/gerente/Agenda.tsx`: atualizado somente o comentário para indicar lanes percentuais genéricas.

## Validação

- `npm test -- src/lib/__tests__/agenda-layout.test.ts --run` — 1 arquivo, 6 testes aprovados.
- `npm test -- src/pages/__tests__/Agenda.test.tsx --run` — 1 arquivo, 26 testes aprovados.

Nenhuma alteração foi feita em CSS, mobile, handlers, API ou regras de negócio.
