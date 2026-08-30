# 04 — Calcular último horário dentro dos limites

**What to build:** O sistema deve calcular o último início elegível a partir das configurações atuais, sem hardcode e sem exigir que o serviço termine antes do fechamento.

**Blocked by:** 02 — Aplicar escala e pausas exatas do profissional; 03 — Aplicar duração efetiva e conflitos temporais.

**Status:** ready-for-agent

- [ ] Com retorno às `15:00`, grade de 40 minutos e fechamento às `19:00`, o último início é `18:20`.
- [ ] Com retorno às `14:00`, grade de 40 minutos e fechamento às `19:00`, o resultado acompanha a nova cadência e pode ser `18:40`.
- [ ] O fechamento limita o início do slot, não o término do serviço.
- [ ] Um serviço iniciado às `18:20` pode terminar depois das `19:00` quando essa for a regra configurada.
- [ ] O horário exatamente igual ao fechamento não aparece como início normal.
- [ ] Alterar abertura, pausa, fechamento, intervalo ou antecedência altera o resultado sem mudança de código.
- [ ] Os exemplos são testes derivados de configurações e não constantes da implementação.
