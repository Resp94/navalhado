# 04 — Refatoração Transparente do Fluxo de Agendamento (FluxoAgendamento.tsx)

**What to build:** Migração da camada de busca de dados, horários livres e confirmação de agendamento em `FluxoAgendamento.tsx` para o repositório `CanalClienteRepository` via `useCanalCliente()`, mantendo 100% da integridade visual e comportamental do layout.

**Blocked by:** 03 — Adaptador Supabase e Custom Hook useCanalCliente.

**Status:** completed

- [x] Refatorar a busca de catálogo e profissionais para usar `useCanalCliente()`.
- [x] Refatorar a consulta de horários disponíveis para usar `consultarHorariosDisponiveis()`.
- [x] Refatorar a criação e reagendamento de agendamento para usar o repositório.
- [x] Manter 100% idênticos o layout visual, elementos JSX, classes CSS, modal e estados visuais da tela.

