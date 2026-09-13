# 15: Baixa pela gaveta, seu estorno e o pagamento de conta no extrato impresso

**What to build:** o gestor paga o entregador com dinheiro do caixa e o pagamento sai da gaveta do
turno aberto já ligado à Conta a Pagar, e não como uma sangria sem destino. Hoje, uma semana
depois, ninguém sabe se aquela sangria de R$ 180 pagou o gás, o motoboy ou foi retirada do dono, e
a mesma conta pode ser paga duas vezes sem que nada avise.

A Baixa pela gaveta é recusada quando o valor pago excede o disponível no turno, para que o
fechamento continue possível. A data do pagamento é o dia de negócio corrente, definida pelo
servidor: o dinheiro sai da gaveta no momento da operação, e aceitar uma data informada deixaria a
Baixa e o movimento de caixa contando histórias diferentes. Estornar uma Baixa feita pela gaveta
devolve o valor à gaveta do turno, para que o Fechamento de Caixa com Conferência continue batendo.
O estorno pertence a este ticket: separá-lo criaria uma janela em que estornar a Baixa deixaria o
dinheiro fora da gaveta.

**Nenhuma função de apuração é editada.** O tipo novo de movimento declara seu sentido de saída e a
apuração única do ticket 01 passa a subtraí-lo sozinha — é a demonstração de que o prefactor
cumpriu o que prometia. O extrato impresso ganha rótulo próprio para o pagamento de conta, com a
descrição da Conta a Pagar.

Aqui, ao contrário do sistema de referência, nada é removido: Conta a Pagar, Baixa e movimento de
caixa ficam ligados nas duas direções. Fluxos de caixa futuros devem ler a saída a partir das
Baixas, nunca dos movimentos, sob pena de contar a mesma saída duas vezes.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 4 — Baixa pela gaveta".

**Blocked by:** 01 — Expand: apuração única do valor esperado da gaveta no servidor;
05 — Extrato impresso da Sessão de Caixa com todas as saídas;
07 — Baixa fora do caixa e Estorno de Baixa.

**Status:** ready-for-agent

- [ ] Tipo novo de movimento de caixa, pagamento de conta, declarado na restrição de tipo e na
      expressão de sentido como saída, sem editar nenhuma função de apuração.
- [ ] Vínculo bidirecional: o movimento aponta a Baixa e a Baixa aponta o movimento, criados na
      mesma transação, com índice único parcial em cada ponta impedindo que duas Baixas
      reivindiquem a mesma saída de gaveta.
- [ ] Restrição na tabela de Baixas: origem gaveta tem Sessão de Caixa e movimento; as demais
      origens não têm nenhum dos dois; o vínculo ao movimento é verificado ao final da transação.
- [ ] A RPC de Baixa passa a aceitar a origem gaveta, sem mudar assinatura, só com forma dinheiro.
- [ ] Na ordem de lock fixa, a Baixa pela gaveta: trava a Conta a Pagar; trava a Sessão de Caixa
      informada e exige que esteja aberta e pertença ao tenant; recusa valor pago acima do
      disponível apurado pela função privada, com mensagem no padrão da Quitação de Comissão e do
      vale (histórias 14 e 15).
- [ ] Na Baixa pela gaveta, a data do pagamento é o dia de negócio corrente do tenant, definida
      pelo servidor.
- [ ] Estorno de Baixa pela gaveta só é aceito enquanto a sessão do movimento estiver aberta, com
      orientação de reabrir o turno; marca o movimento como estornado com o mesmo autor e motivo, e
      o valor volta a contar na gaveta (história 18).
- [ ] O Fechamento de Caixa passa a gravar versão de cálculo nova, a partir da qual o valor
      esperado considera pagamentos de conta; nenhuma coluna de fotografia nova na Sessão de Caixa.
- [ ] O contrato de leitura do extrato devolve a descrição da Conta a Pagar para movimentos de
      pagamento de conta; o extrato impresso mostra rótulo próprio e essa descrição.
- [ ] Diálogo de Baixa mostra a origem gaveta só quando existe sessão aberta, trava a forma em
      dinheiro nessa origem e exibe o disponível lido do contrato de saldo apurado do ticket 01.
- [ ] Criada a suíte pgTAP `30_baixa_conta_pela_gaveta`, cobrindo:
  - [ ] Baixa pela gaveta recusada acima do disponível e aceita no limite;
  - [ ] recusada com forma diferente de dinheiro, com sessão fechada e com sessão de outro tenant;
  - [ ] vínculo bidirecional e índice único;
  - [ ] data do pagamento definida pelo servidor;
  - [ ] estorno recusado com sessão fechada e aceito após reabertura, marcando o movimento como
        estornado e devolvendo o valor à gaveta.
- [ ] Regressão na suíte pgTAP `07_fechar_caixa_atomicamente`: o pagamento de conta é subtraído do
      valor esperado e o fechamento grava a versão de cálculo nova.
- [ ] Regressão na suíte pgTAP `25_validar_saldo_gaveta_quitacao_comissao`: o pagamento de conta
      reduz o disponível para quitação, vale e sangria.
- [ ] Obrigações de comissão, Quitação de Comissão, Conta do Profissional e formas de pagamento de
      Comanda não mudam de semântica; as suítes existentes delas continuam verdes.
- [ ] Testes de repositório e de adaptador do módulo cobrem Baixa e estorno pela gaveta.
- [ ] Teste da aba cobre a oferta da origem gaveta só com sessão aberta.
- [ ] O teste de página existente do extrato ganha caso com pagamento de conta.
- [ ] `npm run test` e `npm run test:db` verdes.
