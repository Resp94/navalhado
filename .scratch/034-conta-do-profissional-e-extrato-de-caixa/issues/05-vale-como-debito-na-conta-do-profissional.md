# 05: Vale como débito na Conta do Profissional

**What to build:** o gestor lança um vale para um profissional e a dívida passa a existir no
sistema, em vez de viver na memória dele. O lançamento exige motivo escrito, para que o extrato
seja legível meses depois, e declara a forma de pagamento — um vale pago em PIX não é confundido
com saída da gaveta.

Vale pago em dinheiro gera a saída correspondente na Sessão de Caixa, para que o Fechamento de
Caixa com Conferência bata com a gaveta física, e é **recusado quando excede o saldo disponível
na gaveta do turno** — senão o fechamento fica impossível de concluir. Um vale lançado por engano
pode ser estornado informando a razão, e a correção fica auditável em vez de apagar o histórico.

O profissional vê os próprios vales em aberto e sabe quanto será descontado do próximo repasse.

Este ticket **não** mexe na Quitação de Comissão. O abate é o ticket 06; aqui o vale é dívida
registrada e visível, que o gestor ainda abate por fora se quiser.

Tabela própria, não reuso da tabela de obrigações de comissão: as obrigações exigem vínculo
obrigatório com Comanda e valor estritamente positivo, duas guardas endurecidas de propósito. Um
vale não nasce de Comanda e é dedução; acomodá-lo ali exigiria afrouxar as duas.

**Blocked by:** 03 (tipo de vale nas fórmulas de gaveta), 04 (Conta do Profissional).

**Status:** ready-for-agent

- [ ] Lançamento de vale com profissional, valor, motivo obrigatório com tamanho mínimo e forma
      de pagamento.
- [ ] Vale em dinheiro gera o movimento de caixa do tipo de vale na sessão aberta, reusando a
      validação de saldo disponível na gaveta já existente na quitação em dinheiro.
- [ ] Vale em dinheiro acima do saldo disponível na gaveta do turno é recusado com erro claro, e
      o valor esperado da sessão nunca fica negativo.
- [ ] Vale em forma que não seja dinheiro não aceita sessão de caixa informada.
- [ ] Vínculo bidirecional entre movimento de caixa e lançamento, com índice único parcial
      garantindo que dois vales não reivindiquem a mesma saída de gaveta.
- [ ] Estorno de vale registra autor e razão, e devolve o saldo da conta ao estado anterior.
- [ ] Superfície no Hub Financeiro para lançar, listar e estornar vale, e saldo da Conta do
      Profissional visível junto do saldo de comissão.
- [ ] O profissional vê os próprios vales em aberto e não os dos colegas.
- [ ] Casos adicionados ao arquivo pgTAP da Conta do Profissional criado no ticket 04.
- [ ] `npm run test` e `npm run test:db` verdes.
