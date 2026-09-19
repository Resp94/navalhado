# 05: Cancelar Agendamento por RPC

**What to build:** o gestor cancela um Agendamento pela Agenda Geral informando o motivo, e o banco confere o estado de origem. Agendamento concluído, já cancelado ou com falta não pode ser cancelado. A Comanda aberta do Agendamento continua sendo cancelada junto, como hoje.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** ready-for-agent

- [ ] RPC de cancelar aceita só `pending`, `confirmed` e `in_progress`
- [ ] Motivo do cancelamento obrigatório e gravado
- [ ] Comanda aberta do Agendamento cancelada na mesma operação
- [ ] Agenda Geral cancela só pelo AgendaRepository
- [ ] pgTAP: estados proibidos recusados, Comanda cancelada, acesso de outro tenant recusado
- [ ] Vitest do novo método do AgendaRepository
- [ ] `npm run lint`, `npm test` e `npm run build` passam
