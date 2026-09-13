# 12: Parcelamento com resíduo na última parcela

**What to build:** o gestor lança a compra do distribuidor em três boletos informando o valor total
e o número de parcelas, confere as parcelas na prévia e o sistema gera cada uma com o próprio
vencimento. O centavo que sobra da divisão fica na última parcela, para que a soma seja exatamente
o valor da compra.

Uma compra parcelada é uma despesa só: todas as parcelas recebem a mesma competência. A descrição
é gravada sem sufixo e a numeração "i/N" é derivada da posição, para que editar a descrição da
Série não exija reescrever numeração. O Parcelamento usa o calendário e a prévia do ticket 11.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 3 — Série: Parcelamento e Recorrência"
(Parcelamento).

**Blocked by:** 11 — Recorrência com calendário ancorado e prévia.

**Status:** ready-for-agent

- [ ] RPC de criação de Parcelamento aceita de 2 a 60 parcelas a partir de um valor total
      (história 20).
- [ ] Todas as parcelas recebem o total dividido pela quantidade, truncado em centavos, e a última
      recebe o resíduo; a soma é exatamente o total (história 21).
- [ ] Parcelas exibidas como "i/N", derivado da posição e da quantidade; descrição gravada sem
      sufixo.
- [ ] Uma única competência, informada na criação e replicada em todas as parcelas, com o
      vencimento da primeira parcela como padrão.
- [ ] A prévia do Parcelamento usa o mesmo cálculo da criação e mostra datas e valores com o
      resíduo na última (história 24).
- [ ] Criação registra autor e momento.
- [ ] Formulário ganha a variante explícita de Parcelamento sobre a mesma casca.
- [ ] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [ ] Parcelamento de 100 em 3 dando 33,33, 33,33 e 33,34;
  - [ ] quantidade fora de 2 a 60 recusada;
  - [ ] competência única em todas as parcelas;
  - [ ] a prévia do Parcelamento igual às parcelas criadas.
- [ ] Testes de repositório e de adaptador do módulo cobrem Parcelamento.
- [ ] Teste da aba cobre a alternância entre as três variantes do formulário.
- [ ] Glossário do projeto atualizado com Parcelamento.
- [ ] `npm run test` e `npm run test:db` verdes.
