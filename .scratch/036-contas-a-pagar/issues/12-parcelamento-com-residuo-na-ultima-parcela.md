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

**Status:** done

- [x] RPC de criação de Parcelamento aceita de 2 a 60 parcelas a partir de um valor total
      (história 20).
- [x] Todas as parcelas recebem o total dividido pela quantidade, truncado em centavos, e a última
      recebe o resíduo; a soma é exatamente o total (história 21).
- [x] Parcelas exibidas como "i/N", derivado da posição e da quantidade; descrição gravada sem
      sufixo.
- [x] Uma única competência, informada na criação e replicada em todas as parcelas, com o
      vencimento da primeira parcela como padrão.
- [x] A prévia do Parcelamento usa o mesmo cálculo da criação e mostra datas e valores com o
      resíduo na última (história 24).
- [x] Criação registra autor e momento.
- [x] Formulário ganha a variante explícita de Parcelamento sobre a mesma casca.
- [x] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [x] Parcelamento de 100 em 3 dando 33,33, 33,33 e 33,34;
  - [x] quantidade fora de 2 a 60 recusada;
  - [x] competência única em todas as parcelas;
  - [x] a prévia do Parcelamento igual às parcelas criadas.
- [x] Testes de repositório e de adaptador do módulo cobrem Parcelamento.
- [x] Teste da aba cobre a alternância entre as três variantes do formulário.
- [x] Glossário do projeto atualizado com Parcelamento.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migração `20260914130000_parcelamento_com_residuo_na_ultima_parcela.sql`, aplicada no DEV
  (`create_installment_payable_series`, assinatura nova ao final da lista de parâmetros, sem
  quebrar `create or replace`).
- Zero mudanças em `preview_payable_series` e `private.compute_series_due_date`: o ticket 11 já os
  projetou aceitando `p_series_type`/`seriesType = 'installment'` e já continha o cálculo de
  divisão truncada com resíduo na última parcela.
- `v_share := trunc(v_amount / p_occurrences, 2)`, `v_last_share := v_amount - (v_share *
  (p_occurrences - 1))` -- resíduo absorvido pela última parcela, nunca distribuído.
- Suíte pgTAP: 17 novos casos (contexto `ticket29k_context`, validados isoladamente no DEV antes
  do append), plano atualizado de 155 para 172.
- Frontend: terceira opção no `SegmentedControl` do `ContaPagarForm`, campo de competência
  opcional exclusivo do Parcelamento, rótulo "Valor total" em vez de "Valor", numeração "i/N" só na
  prévia (nunca persistida).
