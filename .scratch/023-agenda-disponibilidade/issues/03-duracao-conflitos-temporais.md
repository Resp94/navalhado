# 03 — Aplicar duração efetiva e conflitos temporais

**What to build:** A disponibilidade deve refletir a duração real do atendimento e remover horários que conflitem com appointments, bloqueios, pausas ou antecedência mínima.

**Blocked by:** 01 — Consolidar o contrato de disponibilidade do tenant.

**Status:** ready-for-agent

- [ ] A duração base vem do serviço selecionado.
- [ ] A duração personalizada do profissional substitui a duração base quando estiver configurada e habilitada.
- [ ] O término do appointment é calculado com a duração efetiva.
- [ ] Appointments cancelados não bloqueiam disponibilidade.
- [ ] Appointments ativos que se sobrepõem bloqueiam o horário.
- [ ] Bloqueios do profissional ou do tenant bloqueiam o horário quando houver sobreposição.
- [ ] Serviços que cruzam uma pausa são tratados como indisponíveis conforme a regra temporal.
- [ ] A antecedência mínima usa o timezone e a configuração do tenant.
- [ ] O mesmo cálculo é usado na consulta de disponibilidade e na confirmação da reserva.
- [ ] O comportamento é coberto por testes para durações diferentes e conflitos combinados.
