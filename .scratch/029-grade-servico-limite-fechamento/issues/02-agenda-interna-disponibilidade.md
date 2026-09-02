# 02 — Disponibilidade normal na Agenda interna

**What to build:** A Agenda do gerente e do barbeiro deve continuar mostrando a régua visual do expediente, mas impedir que o fluxo normal use horários cuja duração não cabe no fechamento, com o mesmo comportamento no desktop e no mobile.

**Blocked by:** 01 — Regra compartilhada de duração e limite de fechamento.

**Status:** ready-for-agent

- [ ] Manter na régua interna os horários gerados pela escala efetiva e pelo intervalo configurado, inclusive o último horário visual antes do fechamento quando ele for referência operacional.
- [ ] Garantir que a regra funcione com qualquer intervalo configurado, sem hardcode de 40 minutos ou de um horário específico.
- [ ] No modal de agendamento normal, bloquear um slot quando o serviço escolhido não terminar até o menor fechamento aplicável.
- [ ] Com um profissional selecionado, usar somente os serviços ativos atribuídos a ele e suas durações efetivas.
- [ ] Com vários profissionais ou seleção ampla, permitir o horário normal somente quando existir uma combinação profissional-serviço que caiba no período.
- [ ] Manter horários passados, bloqueados, ocupados, em intervalo ou sem antecedência mínima indisponíveis para o fluxo normal.
- [ ] Aplicar a mesma validação ao reagendamento normal e à escolha de encaixe pela grade.
- [ ] Manter encaixe personalizado fora da grade, fora da escala e fora do expediente quando o gerente escolher explicitamente esse modo.
- [ ] Preservar cards já persistidos fora do expediente, exibindo-os no horário real sem removê-los da Agenda.
- [ ] Garantir paridade entre Agenda desktop e Agenda mobile para régua, seleção, bloqueio e mensagens de indisponibilidade.
- [ ] Preservar duração, timezone, comanda, pagamento, status, cores, ações de falta e regras de mensageria existentes.
- [ ] Cobrir a diferença entre slot visual e slot elegível com testes de componente e regressão dos fluxos atuais.

