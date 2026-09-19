# 06: Marcar falta por RPC

**What to build:** o gestor marca falta (no-show) pela Agenda Geral, e o banco decide se pode: só Agendamento `pending` ou `confirmed`, e só depois do horário de início pelo relógio do banco no fuso do tenant. A Comanda aberta do Agendamento com falta é cancelada, como o texto de confirmação da tela já promete.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** done

- [x] Antes de implementar: ler o gatilho de proteção de falta e confirmar o que ele faz hoje com a Comanda; registrar no ticket
- [x] RPC de marcar falta recusa Agendamento antes do horário de início
- [x] RPC recusa estado de origem diferente de `pending` e `confirmed`
- [x] Comanda aberta cancelada na mesma operação
- [x] Agenda Geral marca falta só pelo AgendaRepository
- [x] pgTAP: antes do início recusado, estados proibidos recusados, Comanda cancelada, acesso de outro tenant recusado
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Nota da implementação:** o gatilho `trg_auto_cancel_comanda_on_appointment_cancel` já cancela a Comanda aberta nos estados `canceled` e `no_show`, então a RPC só muda o estado do Agendamento e a Comanda é cancelada na mesma transação. A promessa do modal de confirmação já era cumprida pelo banco.
