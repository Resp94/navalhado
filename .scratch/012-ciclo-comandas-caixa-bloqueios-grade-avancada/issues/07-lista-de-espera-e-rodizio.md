# 07 — Lista de Espera Diária e Sugestão de Rodízio de Balcão

**What to build:**
Criar o módulo de Lista de Espera Diária (`waiting_list`) com notificação e encaixe em cancelamentos de horários, além de incorporar a lógica de sugestão de rodízio de barbeiros para clientes sem preferência no modal de encaixe rápido.

**Blocked by:** 06 — Grid Concorrente de Encaixes (Split 50%/50%), Visão Semanal e Mini-Calendário.

**Status:** ready-for-agent

- [x] Criar gaveta/painel lateral de Lista de Espera para cadastro de clientes aguardando vaga no mesmo dia.
- [x] Implementar gatilho de notificação ao cancelar agendamento com botão de 1 clique para encaixar o primeiro da lista de espera.
- [x] Implementar algoritmo de rodízio balanceado sugerindo o próximo barbeiro (menos cortes hoje / mais tempo ocioso) no modal de Encaixe.
- [x] Testes unitários para lista de espera e rodízio.
