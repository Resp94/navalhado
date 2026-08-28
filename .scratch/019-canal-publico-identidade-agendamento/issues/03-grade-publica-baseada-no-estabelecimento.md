# 03 — Grade de horários baseada no estabelecimento

**What to build:** O visitante visualiza a grade pública de horários calculada a partir do expediente do estabelecimento, intervalo, duração do serviço, timezone e antecedência mínima.

**Blocked by:** 02 — Catálogo público e profissionais por serviço.

**Status:** ready-for-agent

- [ ] Os horários usam o expediente e o intervalo configurados no tenant, sem depender de um cliente criado previamente.
- [ ] A duração do serviço impede a oferta de horários que ultrapassem o encerramento do expediente.
- [ ] A antecedência mínima e o timezone do tenant são aplicados de forma consistente.
- [ ] Horários indisponíveis permanecem visíveis na grade com estado não selecionável quando essa for a regra da interface.
- [ ] Existem testes de borda para expediente, duração, intervalo, data atual e datas futuras.
