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

**Nota da implementação:** a RPC `cancel_appointment_by_manager`, o método `AgendaRepository.cancelar` e o handler de cancelamento da Agenda Geral estão prontos e testados, mas o modal "Cancelar Agendamento" da Agenda Geral hoje não é aberto por nenhuma tela (`MobileAgendaView` recebe `onOpenCancel` como `_onOpenCancel`, sem uso). O cancelamento que o gestor usa de fato é o botão "Cancelar atendimento" do modal de comanda, que chama `cancel_comanda_appointment` (sem motivo e sem guarda de estado do Agendamento). Migrar esse caminho para `AgendaRepository.cancelar` exige decidir a UX do motivo e fica no ticket 12.
