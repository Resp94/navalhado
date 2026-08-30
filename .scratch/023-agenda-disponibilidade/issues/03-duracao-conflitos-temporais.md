# 03 — Aplicar duração efetiva e conflitos temporais

**What to build:** A disponibilidade deve refletir a duração real do atendimento e remover horários que conflitem com appointments, bloqueios, pausas ou antecedência mínima.

**Blocked by:** 01 — Consolidar o contrato de disponibilidade do tenant.

**Status:** completed

- [x] A duração base vem do serviço selecionado.
- [x] A duração personalizada do profissional substitui a duração base quando estiver configurada e habilitada.
- [x] O término do appointment é calculado com a duração efetiva.
- [x] Appointments cancelados não bloqueiam disponibilidade.
- [x] Appointments ativos que se sobrepõem bloqueiam o horário.
- [x] Bloqueios do profissional ou do tenant bloqueiam o horário quando houver sobreposição.
- [x] Serviços que cruzam uma pausa são tratados como indisponíveis conforme a regra temporal.
- [x] A antecedência mínima usa o timezone e a configuração do tenant.
- [x] O mesmo cálculo é usado na consulta de disponibilidade e na confirmação da reserva.
- [x] O comportamento é coberto por testes para durações diferentes e conflitos combinados.
