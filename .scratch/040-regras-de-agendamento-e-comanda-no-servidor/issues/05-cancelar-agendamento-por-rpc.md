# 05: Cancelar Agendamento por RPC

**What to build:** o gestor cancela um Agendamento pela Agenda Geral informando o motivo, e o banco confere o estado de origem. Agendamento concluído, já cancelado ou com falta não pode ser cancelado. A Comanda aberta do Agendamento continua sendo cancelada junto, como hoje.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** done

- [x] RPC de cancelar aceita só `pending`, `confirmed` e `in_progress`
- [x] Motivo do cancelamento obrigatório e gravado
- [x] Comanda aberta do Agendamento cancelada na mesma operação
- [x] Agenda Geral cancela só pelo AgendaRepository
- [x] pgTAP: estados proibidos recusados, Comanda cancelada, acesso de outro tenant recusado
- [x] Vitest do novo método do AgendaRepository
- [x] `npm run lint`, `npm test` e `npm run build` passam
