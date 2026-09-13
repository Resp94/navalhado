# 02: Prévia da gaveta lida do banco

**What to build:** o gestor passa a ver na tela o valor esperado da gaveta já descontando repasses
de comissão e vales pagos em dinheiro. Hoje a prévia só considera suprimento e sangria: em
qualquer turno com Quitação de Comissão ou vale em dinheiro, ele conta a gaveta contra um número
maior que o real — e o caso mais grave é o modal de Fechamento de Caixa, que mostra a diferença
antes de ele confirmar a contagem.

A causa foi uma fórmula replicada no navegador, e a correção é não replicá-la: a função de domínio
que recompõe o valor esperado é removida, e os três pontos que a usam passam a ler o contrato de
leitura criado no ticket 01. Assim, a diferença mostrada antes de fechar é a diferença que fica
registrada.

A mudança é na aba de Caixa, por isso vem depois do Hub em sub-rotas da 035, para não disputar o
mesmo componente.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 1 — Apuração única do valor esperado da
gaveta" (prévia da tela) e "Interface".

**Blocked by:** 01 — Expand: apuração única do valor esperado da gaveta no servidor;
035/02 — Hub Financeiro em sub-rotas.

**Status:** ready-for-agent

- [ ] O módulo de Caixa ganha o método de leitura do saldo apurado da gaveta, consumindo o
      contrato do ticket 01, e perde a função de domínio de valor esperado.
- [ ] O modal de Fechamento de Caixa mostra o valor esperado e a diferença a partir do contrato.
- [ ] O resumo da sessão ativa na aba de Caixa mostra o valor esperado a partir do contrato.
- [ ] A visão móvel de caixa mostra o valor esperado a partir do contrato.
- [ ] Num turno com repasse de comissão ou vale em dinheiro, o valor exibido já os desconta
      (história 1), e é igual ao valor que o fechamento persiste (história 2).
- [ ] A atualização em tempo real que a aba de Caixa já assina sobre movimentos de caixa passa a
      recarregar o contrato.
- [ ] Sessões fechadas continuam mostrando o valor persistido no fechamento, inclusive as fechadas
      com versões de cálculo anteriores.
- [ ] Testes de repositório e de adaptador do módulo de Caixa trocam os casos da função removida
      pelos casos do contrato de saldo apurado.
- [ ] Os testes existentes do modal de Fechamento de Caixa e da página do Hub Financeiro continuam
      passando, com um caso novo mostrando o valor esperado vindo do contrato, e não recomposto no
      navegador.
- [ ] `npm run test` verde.
