# 06 — Grid Concorrente de Encaixes (Split 50%/50%), Visão Semanal e Mini-Calendário

**What to build:**
Implementar o algoritmo de detecção de sobreposição na grade temporal para posicionar agendamentos concorrentes lado a lado (50% / 50% split), acompanhado pela alternância Visão Dia / Visão Semana por barbeiro e datepicker popover no header.

**Blocked by:** 04 — Modal de Checkout de Comandas com Múltiplos Itens e Divisão de Pagamento, 05 — Bloqueio de Horários na Grade e Atualização do RPC do Canal do Cliente.

**Status:** ready-for-agent

- [ ] Implementar algoritmo de detecção de colisões de horário na grade (`Agenda.tsx`), distribuindo `left` e `width` (50%/50%) para agendamentos simultâneos no mesmo barbeiro.
- [ ] Preservar estilização e interatividade de ambos os cards lado a lado sem sobreposição cega.
- [ ] Adicionar seletor de escopo `[ Dia ]` e `[ Semana ]` no cabeçalho.
- [ ] Renderizar visão semanal de 7 dias (Segunda a Domingo) quando um barbeiro estiver selecionado.
- [ ] Adicionar componente de mini-calendário/datepicker popover no cabeçalho para salto rápido de data.
- [ ] Testes unitários validando layout split 50%/50% e alternância de visões.
