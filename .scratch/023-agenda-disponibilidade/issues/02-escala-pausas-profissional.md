# 02 — Aplicar escala e pausas exatas do profissional

**What to build:** A agenda deve mostrar somente a interseção entre o funcionamento do tenant e a escala do profissional, preservando pausas configuradas em horários exatos.

**Blocked by:** 01 — Consolidar o contrato de disponibilidade do tenant.

**Status:** completed

- [x] Horários anteriores ao início da escala do profissional não ficam disponíveis.
- [x] Horários posteriores ao fim da escala do profissional não ficam disponíveis.
- [x] O início do profissional não recria nem desloca a cadência do tenant.
- [x] O intervalo profissional aceita horários exatos, como `12:00–14:00`, mesmo quando não coincidem com a cadência da grade.
- [x] O retorno da pausa é o primeiro horário do segmento seguinte.
- [x] Após o retorno, os horários avançam pelo intervalo dinâmico do tenant.
- [x] Escala e pausa fora dos limites do tenant são rejeitadas.
- [x] Início de pausa igual ou posterior ao fim é rejeitado.
- [x] O estado controlado preserva os horários exatos carregados e a cobertura automatizada valida as opções `12:00` e `14:00`.
