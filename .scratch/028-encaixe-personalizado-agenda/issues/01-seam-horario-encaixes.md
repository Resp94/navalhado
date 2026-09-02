# 01 — Seam de horário para encaixes

**What to build:** Uma interface de domínio única para construir o intervalo de um encaixe pela grade ou personalizado, calculando a duração efetiva e convertendo o horário local pelo timezone do tenant.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Diferenciar explicitamente encaixe pela grade de encaixe personalizado.
- [ ] Usar a duração específica do profissional quando existir e, caso contrário, a duração do serviço.
- [ ] Permitir horário personalizado válido sem exigir múltiplo do intervalo da grade.
- [ ] Calcular o horário final sem truncar no fechamento da barbearia ou do profissional.
- [ ] Preservar as regras de horário normal fora do modo de encaixe.
- [ ] Converter data e horário usando o timezone configurado no tenant.
- [ ] Cobrir a interface do seam com testes de domínio para grade, horário livre, duração e timezone.
