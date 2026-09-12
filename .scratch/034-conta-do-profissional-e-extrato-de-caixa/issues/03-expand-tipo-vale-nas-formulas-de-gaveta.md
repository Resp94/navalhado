# 03: Expand — tipo de movimento de vale nas fórmulas de gaveta

**What to build:** o sistema passa a reconhecer e subtrair corretamente um tipo novo de
movimentação de caixa destinado a vale de profissional, **antes** de existir qualquer feature que
o gere. Nenhum comportamento novo é oferecido ao usuário neste ticket; o que ele entrega é a
garantia de que o vale do ticket 05 não vai furar o caixa.

Motivo: todas as fórmulas de saldo disponível e de valor esperado da gaveta filtram movimentos
por tipo de forma nominal e explícita. Um tipo novo que não seja acrescentado a cada uma delas
sai da gaveta sem ser subtraído, superestimando o saldo disponível e o valor esperado no
fechamento — reproduzindo exatamente o defeito que a spec 033 corrigiu ao validar saldo de gaveta
na quitação em dinheiro (valor esperado negativo tornando o fechamento impossível de concluir).

Este é o item de maior risco da spec 034, e está isolado de propósito: chega verde e coberto
antes de qualquer coisa depender dele.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A restrição de tipo de movimentação de caixa aceita o tipo de vale de profissional.
- [ ] Todas as funções vivas que apuram saldo disponível da gaveta subtraem o tipo novo.
- [ ] Todas as funções vivas que apuram valor esperado no fechamento subtraem o tipo novo.
- [ ] As funções de snapshot de componentes do caixa consideram o tipo novo.
- [ ] Regressão adicionada **dentro dos arquivos pgTAP existentes** que já cobrem fechamento de
      caixa e validação de saldo de gaveta na quitação — a prova de que o vale é subtraído
      pertence ao lado da prova de que o repasse de comissão é. Não criar arquivo novo.
- [ ] Um movimento do tipo novo inserido num turno reduz o saldo disponível e o valor esperado no
      mesmo montante, e o fechamento continua concluível.
- [ ] `npm run test:db` verde.
