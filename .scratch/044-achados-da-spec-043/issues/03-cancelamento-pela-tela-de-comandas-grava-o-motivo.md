# 03: Cancelamento pela tela de Comandas grava o Motivo de Cancelamento

**What to build:** cancelar pela tela de Comandas encerra a Comanda e o Agendamento na mesma operação. Depois da spec 043, essa via grava a autoria (barbearia), mas continua sem gravar o Motivo de Cancelamento. O Painel de Cancelados do Dia mostra esses casos como "Sem motivo informado", ao lado de cancelamentos idênticos feitos pela Agenda que trazem o motivo por extenso.

Para quem lê o painel, a diferença não tem explicação: o mesmo cancelamento, feito em duas telas, aparece de dois jeitos. Depois deste ticket, cancelar pela tela de Comandas pede e grava o motivo, como a Agenda já faz.

**Onde foi achado:** desvio registrado no ticket 06 da spec 043, que incluiu essa quarta via na autoria mas deixou o motivo de fora do escopo.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A operação de cancelar Comanda e Agendamento juntos passa a receber e gravar o Motivo de Cancelamento
- [ ] A tela de Comandas pede o motivo antes de cancelar, como a Agenda pede
- [ ] A autoria gravada por essa via continua sendo a da barbearia
- [ ] Motivo em branco ou só com espaço é recusado, com a mesma exigência da Agenda
- [ ] Cancelamento feito por essa via antes deste ticket continua sem motivo; nenhum backfill
- [ ] O motivo gravado por essa via aparece no Painel de Cancelados do Dia do gerente e do barbeiro, e na Central 360º do cliente
- [ ] A atomicidade não regride: ou Comanda e Agendamento são cancelados juntos, ou nada muda
- [ ] pgTAP: o motivo é gravado, o motivo em branco é recusado, a atomicidade se mantém, e o isolamento por barbearia continua valendo, incluindo o gestor com identificador de barbearia nulo
- [ ] Teste de tela da Comanda cobrindo que o cancelamento pede o motivo e o repassa
- [ ] O pgTAP 17, que já cobre a função de cancelamento da Comanda, passa inteiro depois da mudança
- [ ] `npm run lint`, `npm test` e `npm run build` passam
