# 13: Edição e cancelamento em série

**What to build:** o aluguel foi reajustado e o gestor quer que o valor novo valha daqui para
frente. A partir de uma ocorrência, ele escolhe editar "apenas esta" ou "esta e as seguintes em
aberto". Um contrato encerrado é tratado do mesmo jeito: ele cancela "esta e as seguintes em
aberto", informando o motivo, e a Série para de gerar obrigação.

Contas já pagas ou parcialmente pagas nunca são alteradas por uma edição ou um cancelamento em
série, para que uma correção em lote não reescreva o que já saiu do caixa. A resposta informa
quantas ocorrências foram ignoradas e por quê.

Vencimento, documento e competência só se editam individualmente: mudar o dia de vencimento de
uma recorrência equivale a cancelar esta e as seguintes e criar uma Série nova, porque recalcular
datas em lote exigiria decidir o que fazer com ocorrências já pagas no meio.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 3 — Série: Parcelamento e Recorrência"
(edição e cancelamento em série).

**Blocked by:** 08 — Editar e cancelar Conta a Pagar;
12 — Parcelamento com resíduo na última parcela.

**Status:** ready-for-agent

- [ ] "Apenas esta" segue as regras de edição individual do ticket 08.
- [ ] "Esta e as seguintes em aberto" atinge a ocorrência escolhida e as de posição maior em
      estado aberto; parcialmente pagas, pagas e canceladas nunca são alteradas, e a resposta
      informa quantas foram ignoradas e por quê (histórias 25 e 27).
- [ ] Campos editáveis em lote: descrição, Categoria de Despesa, Fornecedor, observação e valor —
      este só na Recorrência; num Parcelamento a edição de valor em lote é recusada.
- [ ] Vencimento, documento e competência não são aceitos na edição em lote.
- [ ] Categoria e Fornecedor novos precisam estar ativos.
- [ ] Cancelamento em lote exige motivo e grava o mesmo motivo e autor em cada ocorrência cancelada
      (histórias 26 e 38).
- [ ] A operação em série trava a Série e, em seguida, as ocorrências em ordem de posição; toda
      verificação de estado é feita depois do lock.
- [ ] Edição em lote grava autor e momento da última alteração em cada ocorrência atingida.
- [ ] Na aba, diálogo de edição e de cancelamento com escolha de alcance, exibindo a contagem de
      ignoradas.
- [ ] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [ ] edição "esta e as seguintes" ignorando ocorrências pagas e parcialmente pagas;
  - [ ] cancelamento "esta e as seguintes" ignorando ocorrências pagas e parcialmente pagas;
  - [ ] valor em lote recusado em Parcelamento;
  - [ ] profissional e gerente de outro tenant não executam operação em série.
- [ ] Testes de repositório e de adaptador do módulo cobrem as operações em série.
- [ ] Teste da aba cobre a escolha de alcance na edição em série.
- [ ] `npm run test` e `npm run test:db` verdes.
