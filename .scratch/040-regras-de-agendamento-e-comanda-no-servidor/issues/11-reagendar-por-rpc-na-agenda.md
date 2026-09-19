# 11: Reagendar por RPC na Agenda Geral

**What to build:** o gestor reagenda um Agendamento para outro horário ou profissional pela Agenda Geral, e o banco aplica as mesmas checagens da criação: expediente, escala, Bloqueio de Horário e conflito. Só Agendamento `pending` ou `confirmed` pode ser reagendado, e o fim é recalculado pela duração do novo profissional.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** ready-for-agent

- [ ] RPC de reagendar com guarda de estado de origem
- [ ] Mesmas validações de agenda da criação, reaproveitadas, não copiadas
- [ ] Fim recalculado pela Associação Profissional-Serviço do novo profissional
- [ ] Evento de Agendamento de reagendamento continua saindo
- [ ] Agenda Geral reagenda só pelo AgendaRepository
- [ ] pgTAP: estados proibidos, conflito, bloqueio e fora do expediente recusados; acesso de outro tenant recusado
- [ ] `npm run lint`, `npm test` e `npm run build` passam
