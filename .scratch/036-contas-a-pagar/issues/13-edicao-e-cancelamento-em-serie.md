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

**Status:** done

- [x] "Apenas esta" segue as regras de edição individual do ticket 08.
- [x] "Esta e as seguintes em aberto" atinge a ocorrência escolhida e as de posição maior em
      estado aberto; parcialmente pagas, pagas e canceladas nunca são alteradas, e a resposta
      informa quantas foram ignoradas e por quê (histórias 25 e 27).
- [x] Campos editáveis em lote: descrição, Categoria de Despesa, Fornecedor, observação e valor —
      este só na Recorrência; num Parcelamento a edição de valor em lote é recusada.
- [x] Vencimento, documento e competência não são aceitos na edição em lote.
- [x] Categoria e Fornecedor novos precisam estar ativos.
- [x] Cancelamento em lote exige motivo e grava o mesmo motivo e autor em cada ocorrência cancelada
      (histórias 26 e 38).
- [x] A operação em série trava a Série e, em seguida, as ocorrências em ordem de posição; toda
      verificação de estado é feita depois do lock.
- [x] Edição em lote grava autor e momento da última alteração em cada ocorrência atingida.
- [x] Na aba, diálogo de edição e de cancelamento com escolha de alcance, exibindo a contagem de
      ignoradas.
- [x] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [x] edição "esta e as seguintes" ignorando ocorrências pagas e parcialmente pagas;
  - [x] cancelamento "esta e as seguintes" ignorando ocorrências pagas e parcialmente pagas;
  - [x] valor em lote recusado em Parcelamento;
  - [x] profissional e gerente de outro tenant não executam operação em série.
- [x] Testes de repositório e de adaptador do módulo cobrem as operações em série.
- [x] Teste da aba cobre a escolha de alcance na edição em série.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migração `20260914140000_edicao_e_cancelamento_em_serie.sql` criou
  `update_payable_series`/`cancel_payable_series` (ambas `returns table (id,
  series_position, status, ignored, ignore_reason)`). "Apenas esta" nunca
  ganhou RPC própria: continua chamando `update_payable`/`cancel_payable` do
  ticket 08/036 sem nenhuma mudança nelas.
- Bug recorrente (mesma classe do ticket 07/036): `id` é parâmetro OUT nessas
  funções (por causa do `returns table`), então toda referência não
  qualificada a uma coluna `id` (ou a qualquer coluna de uma tabela
  consultada dentro do corpo) fica ambígua. Corrigido com uma migração de fix
  separada (`20260914140001`, mesmo padrão da parte6 do ticket 07)
  qualificando todo alias de tabela.
- pgTAP: 22 casos novos (contexto `ticket29l_context`), plano de 172 para
  194, validados isoladamente no DEV antes do append.
- Frontend: `EditarContaDialog` e `CancelarContaDialog` ganharam um
  `SegmentedControl` de alcance só quando `conta.seriesType` existe. Na
  edição em lote, vencimento/documento/competência somem do formulário e
  valor só aparece quando a Série é Recorrência. Ambos os diálogos mostram um
  resumo (quantas atualizadas/canceladas, quantas ignoradas e por quê) antes
  de fechar -- não fecham direto como a edição/cancelamento individual.
