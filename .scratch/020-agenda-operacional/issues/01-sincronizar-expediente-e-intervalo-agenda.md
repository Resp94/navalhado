# 01 — Sincronizar expediente e intervalo com a Agenda

**What to build:** Fazer com que o expediente e o intervalo configurados pelo tenant sejam refletidos imediatamente na Agenda desktop e mobile, individualmente por dia da semana, sem recarregar a aplicação.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Ao salvar abertura ou fechamento de um dia, a grade normal daquele dia usa os novos valores imediatamente.
- [ ] Alterar terça-feira de `09:00–18:00` para `09:00–15:00` faz a grade normal de terça terminar às 15:00 sem alterar os demais dias.
- [ ] Alterar `slotIntervalMinutes` atualiza os slots da Agenda desktop e mobile sem depender de valor fixo ou estado antigo.
- [ ] A grade normal continua limitada ao expediente oficial do tenant e respeita timezone e intervalo configurados.
- [ ] O refresh explícito após salvar e a atualização realtime do tenant produzem o mesmo estado normalizado.
- [ ] Existem testes de contexto/configuração e Agenda para atualização sem reload, dias independentes e intervalos de 30 e 40 minutos.


