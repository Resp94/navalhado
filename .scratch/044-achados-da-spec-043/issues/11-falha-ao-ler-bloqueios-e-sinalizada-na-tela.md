# 11: Falha ao ler Bloqueios de Horário é sinalizada na tela

**What to build:** quando a leitura de Bloqueios de Horário falha, a Agenda Geral abre normalmente, com os Agendamentos no lugar e nenhum Bloqueio. O erro vai só para o registro do console. Para quem está na recepção, a grade parece correta e mostra como livres horários que estão bloqueados, o que leva a agendar em cima de um bloqueio.

O isolamento de falha é o comportamento certo e foi restaurado no ticket 08 da spec 043: a falha de Bloqueios não deve esconder os Agendamentos. Falta a outra metade, dizer ao usuário que aquela parte da grade não carregou.

Depois deste ticket, a grade continua abrindo, e quem a lê sabe que os Bloqueios não estão ali.

**Onde foi achado:** limite registrado no ticket 08 da spec 043, que restaurou o isolamento de falha e deixou a falha sinalizada só no console, como era antes do ticket 03 da spec 043. O mesmo limite registra que a falha não foi provada no navegador, só em teste de tela.

**Blocked by:** 10 (Agenda Geral descarta resposta obsoleta na troca rápida de dia) — os dois mexem nas mesmas funções de leitura da Agenda Geral, e o 10 muda a forma delas

**Status:** ready-for-agent

- [ ] Falha na leitura de Bloqueios de Horário é sinalizada na Agenda Geral, de forma visível para quem olha a grade
- [ ] Os Agendamentos continuam aparecendo; a falha de Bloqueios nunca esconde a grade
- [ ] O aviso some quando uma leitura seguinte tem sucesso
- [ ] O aviso distingue "não carregou" de "não há Bloqueio neste dia"
- [ ] A Minha Agenda do barbeiro recebe o mesmo tratamento, onde a falha também é silenciosa hoje
- [ ] A falha na leitura de Agendamentos continua com o aviso que já existe, sem duplicar mensagem quando as duas falham
- [ ] O aviso segue o design system: sem fundo sólido de alerta ocupando a grade, e sem cor fora dos tokens
- [ ] Teste de tela cobrindo o aviso presente na falha, ausente no sucesso, e a grade com os Agendamentos nos dois casos
- [ ] Verificado no navegador forçando a falha da leitura de Bloqueios de Horário, nas duas agendas
- [ ] `npm run lint`, `npm test` e `npm run build` passam
