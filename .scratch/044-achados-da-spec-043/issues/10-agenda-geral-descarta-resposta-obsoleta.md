# 10: Agenda Geral descarta resposta obsoleta na troca rápida de dia

**What to build:** trocar de dia dispara uma leitura da agenda. Trocar de dia de novo antes da primeira responder dispara outra. Se a primeira responder depois da segunda, a tela mostra os Agendamentos do dia errado, com o cabeçalho indicando o dia certo.

A Minha Agenda do barbeiro já resolve isso: ela numera as leituras e ignora a resposta que não é a mais recente. A Agenda Geral não, e desde a spec 043 o mesmo vale para o contador de cancelamentos e para o Painel de Cancelados do Dia, que passaram a vir da mesma leitura.

Depois deste ticket, a Agenda Geral ignora resposta obsoleta como a Minha Agenda já ignora.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Resposta de uma leitura já superada não altera a grade, o contador de cancelamentos nem o Painel de Cancelados do Dia
- [ ] A leitura mais recente sempre vence, qualquer que seja a ordem de chegada das respostas
- [ ] Vale para troca de dia, troca de semana e troca entre visão de dia e de semana
- [ ] O indicador de carregamento não fica preso ligado quando uma resposta obsoleta chega por último
- [ ] A falha de uma leitura obsoleta não mostra aviso de erro na tela, porque o usuário já pediu outro dia
- [ ] A leitura de Bloqueios de Horário recebe o mesmo tratamento, já que também acompanha o dia
- [ ] Teste de tela reproduzindo a inversão: duas trocas de dia, a primeira resposta chegando por último, e a grade mostrando o dia pedido por último
- [ ] `npm run lint`, `npm test` e `npm run build` passam
