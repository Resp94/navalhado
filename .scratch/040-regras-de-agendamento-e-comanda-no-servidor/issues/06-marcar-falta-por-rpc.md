# 06: Marcar falta por RPC

**What to build:** o gestor marca falta (no-show) pela Agenda Geral, e o banco decide se pode: só Agendamento `pending` ou `confirmed`, e só depois do horário de início pelo relógio do banco no fuso do tenant. A Comanda aberta do Agendamento com falta é cancelada, como o texto de confirmação da tela já promete.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** ready-for-agent

- [ ] Antes de implementar: ler o gatilho de proteção de falta e confirmar o que ele faz hoje com a Comanda; registrar no ticket
- [ ] RPC de marcar falta recusa Agendamento antes do horário de início
- [ ] RPC recusa estado de origem diferente de `pending` e `confirmed`
- [ ] Comanda aberta cancelada na mesma operação
- [ ] Agenda Geral marca falta só pelo AgendaRepository
- [ ] pgTAP: antes do início recusado, estados proibidos recusados, Comanda cancelada, acesso de outro tenant recusado
- [ ] `npm run lint`, `npm test` e `npm run build` passam
