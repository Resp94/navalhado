# 07: Baixa fora do caixa e Estorno de Baixa

**What to build:** o gestor dá Baixa numa Conta a Pagar informando data, forma de pagamento e que
o dinheiro saiu de fora do caixa — PIX, boleto, transferência ou débito automático —, e o
pagamento fica registrado junto da obrigação que ele pagou, sem mexer na gaveta. Pode pagar em
partes: uma conta paga metade hoje continua em aberto pelo saldo. Juros ou multa e desconto são
informados separados do principal, para que ele saiba quanto perdeu por atraso e quanto ganhou
negociando.

Uma Baixa lançada por engano é estornada com motivo: a conta volta a ficar em aberto e nada é
apagado. Ao abrir a conta, o gestor vê as Baixas, os estornos e quem lançou cada coisa, para
responder a qualquer cobrança com dado.

**O principal abate o saldo da conta, e o desconto faz parte do principal abatido.** Pagar R$ 95
numa conta de R$ 100 com R$ 5 de desconto é uma Baixa de principal 100, desconto 5 e valor pago
95, e a conta fica paga. Juros entram só no valor pago. O valor pago é coluna gerada, para que o
fluxo de caixa da spec 037 leia sempre a mesma conta. Valor pago zero é aceito fora do caixa:
registra um abatimento concedido pelo fornecedor, sem o qual uma conta com restante perdoado
ficaria vencida para sempre.

**O contrato de Baixa nasce completo.** Os parâmetros de origem e de Sessão de Caixa já existem,
mas a origem gaveta é recusada com mensagem explícita até o ticket 15, poupando a troca de
assinatura depois.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 2 — Livro de Contas a Pagar" (Baixa,
Estorno de Baixa, ordem de lock, leitura de detalhe).

**Blocked by:** 06 — Lançar Conta a Pagar avulsa e vê-la na lista paginada.

**Status:** ready-for-agent

- [ ] Tabela de Baixa, várias por conta, com: conta a pagar; principal com duas casas e maior que
      zero; juros e multa maior ou igual a zero; desconto maior ou igual a zero e no máximo
      principal mais juros; valor pago gerado como principal mais juros menos desconto; data do
      pagamento; forma (`cash`, `pix`, `transfer`, `boleto`, `credit_card`, `debit_card`,
      `automatic_debit`, `other`) em domínio próprio da Baixa, sem alterar as formas de Comanda;
      origem (`gaveta` ou `fora_do_caixa`); Sessão de Caixa e movimento de caixa; autor e momento;
      trilha de estorno com momento, autor e motivo, todos ou nenhum.
- [ ] RPC de Baixa com todos os parâmetros, incluindo origem e Sessão de Caixa, recusando a origem
      gaveta com mensagem explícita.
- [ ] A Baixa valida: conta em aberto ou parcialmente paga; principal não excede o saldo restante;
      valores arredondados a duas casas com recusa de valor não numérico; forma no domínio;
      combinação entre origem e forma permitida. Atualiza valor baixado e estado na mesma
      transação (histórias 11, 12 e 16).
- [ ] Juros e desconto gravados separados do principal (história 13).
- [ ] Valor pago zero é aceito fora do caixa.
- [ ] Data do pagamento fora do caixa é informada pelo gestor e recusada quando está no futuro em
      relação ao dia de negócio do tenant.
- [ ] Estorno de Baixa exige motivo com pelo menos cinco caracteres, recusa Baixa já estornada,
      grava autor e momento, devolve o principal ao saldo e recalcula o estado para aberto ou
      parcialmente pago; nada é apagado (história 17).
- [ ] Baixa e Estorno de Baixa travam primeiro a Conta a Pagar (e, no estorno, a Baixa); toda
      verificação de estado e saldo é feita depois do lock.
- [ ] Contrato de leitura de detalhe devolve a conta e suas Baixas com autor e trilha de estorno
      (história 35); a trilha de cancelamento e o resumo da Série entram nos tickets 08 e 11.
- [ ] Índices: FK da conta indexado; índice parcial por tenant e data de pagamento restrito às
      Baixas não estornadas.
- [ ] Acesso da tabela de Baixas no mesmo padrão da tabela de Conta a Pagar; profissional não lê.
- [ ] Toda Baixa e todo estorno registram quem fez e quando (história 38).
- [ ] Na aba, diálogo de Baixa e diálogo de Estorno de Baixa, e visão de detalhe da conta, usáveis
      em largura de celular.
- [ ] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [ ] Baixa parcial e total, com juros e desconto;
  - [ ] valor pago zero aceito fora do caixa;
  - [ ] data futura recusada;
  - [ ] origem gaveta recusada;
  - [ ] estorno devolvendo o estado correto;
  - [ ] duas Baixas concorrentes na mesma conta não ultrapassam o valor;
  - [ ] profissional não lê Baixas nem executa Baixa ou estorno; gerente de outro tenant não lê
        nem escreve.
- [ ] Testes de repositório e de adaptador do módulo cobrem Baixa, estorno e detalhe.
- [ ] Teste da aba cobre Baixa e estorno com repositório injetado.
- [ ] Glossário do projeto atualizado com Baixa, Estorno de Baixa e origem do dinheiro.
- [ ] `npm run test` e `npm run test:db` verdes.
