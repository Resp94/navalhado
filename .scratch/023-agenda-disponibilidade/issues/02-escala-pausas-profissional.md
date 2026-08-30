# 02 — Aplicar escala e pausas exatas do profissional

**What to build:** A agenda deve mostrar somente a interseção entre o funcionamento do tenant e a escala do profissional, preservando pausas configuradas em horários exatos.

**Blocked by:** 01 — Consolidar o contrato de disponibilidade do tenant.

**Status:** ready-for-agent

- [ ] Horários anteriores ao início da escala do profissional não ficam disponíveis.
- [ ] Horários posteriores ao fim da escala do profissional não ficam disponíveis.
- [ ] O início do profissional não recria nem desloca a cadência do tenant.
- [ ] O intervalo profissional aceita horários exatos, como `12:00–14:00`, mesmo quando não coincidem com a cadência da grade.
- [ ] O retorno da pausa é o primeiro horário do segmento seguinte.
- [ ] Após o retorno, os horários avançam pelo intervalo dinâmico do tenant.
- [ ] Escala e pausa fora dos limites do tenant são rejeitadas.
- [ ] Início de pausa igual ou posterior ao fim é rejeitado.
- [ ] Salvar e recarregar preserva os horários exatos configurados.
