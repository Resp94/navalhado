# 11: Reagendar por RPC na Agenda Geral

**What to build:** o gestor reagenda um Agendamento para outro horário ou profissional pela Agenda Geral, e o banco aplica as mesmas checagens da criação: expediente, escala, Bloqueio de Horário e conflito. Só Agendamento `pending` ou `confirmed` pode ser reagendado, e o fim é recalculado pela duração do novo profissional.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** done

- [x] RPC de reagendar com guarda de estado de origem
- [x] Mesmas validações de agenda da criação, reaproveitadas, não copiadas
- [x] Fim recalculado pela Associação Profissional-Serviço do novo profissional
- [x] Evento de Agendamento de reagendamento continua saindo
- [x] Agenda Geral reagenda só pelo AgendaRepository
- [x] pgTAP: estados proibidos, conflito, bloqueio e fora do expediente recusados; acesso de outro tenant recusado
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Nota da implementação:** conflito com outro agendamento ativo (constraint `appointments_no_professional_overlap`) e expediente, escala e intervalo (gatilho `validate_appointment_schedule_boundaries`) já são impostos pelo banco no `UPDATE`; a RPC os reaproveita e só traduz a violação de exclusão em "O horário selecionado já está ocupado.". A RPC confere, além do estado de origem, o Bloqueio de Horário (sem guarda no banco para o gestor), horário passado (exceto encaixe) e o profissional ativo que executa o serviço. O reagendamento do modal de comanda passa pelo `AgendaRepository.reagendar` no ticket 12. A Agenda Geral ainda mantém as checagens de expediente e escala no cliente como feedback antecipado.
