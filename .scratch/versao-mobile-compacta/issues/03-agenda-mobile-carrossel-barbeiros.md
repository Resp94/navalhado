# 03 — Agenda Mobile do Gerente (Carrossel de Barbeiros + Linha do Tempo Vertical)

**What to build:**
Disponibilizar a visualização mobile da Agenda do Gerente, substituindo a grade multi-colunas do desktop por uma linha do tempo vertical cronológica com cartões legíveis de atendimento (horário, cliente, serviço, valor, status e botão de WhatsApp) e um seletor em carrossel horizontal de profissionais no topo (`[Todos] [Lucas] [Marcos]...`). O toque em qualquer slot/horário livre deve abrir o modal de novo agendamento ou encaixe rápido.

**Blocked by:** 01 — Infraestrutura de Layout Base, Bottom Navigation e Modais Bottom Sheet

**Status:** ready-for-agent

- [ ] Seletor de data compacto no topo permitindo navegar entre dias (Ontem, Hoje, Amanhã ou seletor de calendário).
- [ ] Carrossel deslizável de chips/fotos de profissionais no topo para filtrar a agenda por barbeiro específico ou ver todos de forma consolidada.
- [ ] Linha do tempo vertical do dia exibindo cartões de agendamento claros com alvos de toque mínimos de 44x44px.
- [ ] Cartões de agendamento mostram botões de ação rápida de status e atalho de disparo para o WhatsApp do cliente.
- [ ] Horários livres do expediente são visualmente identificáveis na lista e, ao serem tocados, abrem o modal de criação de agendamento/encaixe pré-preenchido com o horário e profissional selecionados.
