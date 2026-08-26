# 03 — Bloqueio Manual de Horários na Agenda

**What to build:** Permitir bloquear horários diretamente na agenda do gestor através de um modal unificado (com opções de slot pontual, intervalo personalizado ou dia inteiro e seleção de motivo), refletindo visualmente o card de bloqueio com ação de remoção e subtraindo os slots da oferta de agendamentos no canal do cliente.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Criar interface unificada no modal da Agenda (`Agenda.tsx`) para inclusão de bloqueios manuais ao clicar em um horário disponível ou através de botão de ação rápida.
- [ ] Suportar seleção de: Profissional, Data, e escolha entre *Horário Específico (slot)*, *Intervalo Customizado (início/fim)* ou *Dia Inteiro (`is_all_day: true`)*.
- [ ] Incluir seleção de motivos pré-definidos (*Almoço*, *Compromisso Pessoal*, *Manutenção*, *Folga*, etc.) ou texto livre.
- [ ] Persistir o bloqueio na tabela `public.blocked_slots` e recarregar a grade via Realtime / `fetchBlockedSlots`.
- [ ] Garantir que os slots bloqueados fiquem indisponíveis para agendamentos online de clientes (RPC `get_available_slots`).
- [ ] Permitir a exclusão do bloqueio diretamente pelo clique no card na Agenda.
- [ ] Atualizar testes unitários em `Agenda.test.tsx`.
