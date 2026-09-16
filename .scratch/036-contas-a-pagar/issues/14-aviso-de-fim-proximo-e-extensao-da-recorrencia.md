# 14: Aviso de fim próximo e extensão da Recorrência

**What to build:** o gestor é avisado quando uma Recorrência está perto de acabar e a estende com
mais ocorrências, para que o aluguel do ano que vem não suma da lista sem ele perceber. É o que
mitiga o limite de 60 ocorrências por operação, já que não existe recorrência sem fim.

O horizonte do aviso é em dias, e não em quantidade de ocorrências: vale igual para qualquer
periodicidade e cobre a janela em que a previsão de saída da 037 começaria a ficar incompleta. A
extensão herda valor, categoria, fornecedor e descrição da última ocorrência não cancelada, para
que um reajuste feito em "esta e as seguintes" sobreviva. Parcelamento não se estende, porque o
total é o contrato.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 3 — Série: Parcelamento e Recorrência"
(aviso e extensão da Recorrência).

**Blocked by:** 12 — Parcelamento com resíduo na última parcela.

**Status:** done

- [x] A Série exibe aviso de fim próximo quando sua última ocorrência não está cancelada e vence em
      até 60 dias a partir do dia de negócio corrente do tenant, calculado no servidor
      (história 28).
- [x] RPC de extensão gera de 1 a 60 ocorrências novas, com posições a partir da maior posição
      existente, pelo mesmo calendário ancorado na data âncora original.
- [x] Valor, categoria, fornecedor e descrição das ocorrências novas vêm da última ocorrência não
      cancelada.
- [x] Extensão de Parcelamento é recusada.
- [x] A extensão trava a Série e registra autor e momento (história 38).
- [x] Na aba, o aviso aparece na Série e oferece estender, com prévia das ocorrências novas pelo
      mesmo cálculo do servidor.
- [x] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [x] extensão continuando posições e calendário ancorados;
  - [x] valores herdados da última ocorrência não cancelada;
  - [x] aviso na fronteira de 60 dias;
  - [x] extensão de Parcelamento recusada.
- [x] Testes de repositório e de adaptador do módulo cobrem aviso e extensão.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migração `20260914150000_aviso_de_fim_proximo_e_extensao_da_recorrencia.sql`:
  `get_payable` ganhou `series_ending_soon`/`series_last_due_date` (drop+create,
  mesma exceção do ticket 11/036, coluna nova no retorno); novas RPCs
  `extend_recurring_payable_series` e `preview_extend_recurring_payable_series`.
- "Última ocorrência" = maior `series_position` da Série, não a de maior
  vencimento entre as não canceladas -- se essa última (por posição) estiver
  cancelada, sem aviso, mesmo que existam ocorrências abertas antes dela.
- Extensão ancora sempre na `anchor_date` original da `payable_series`, nunca
  na data da última ocorrência -- reusa
  `private.compute_series_due_date(anchor_date, periodicity, posição)` com
  posição = maior posição já existente (contando canceladas) + i.
- Documento e observação não são herdados na extensão (ficam `null`): a spec
  só lista valor/categoria/fornecedor/descrição.
- Frontend: banner de aviso + botão "Estender Série" no
  `ContaPagarDetalheDrawer`, abrindo `EstenderSerieDialog` (novo componente)
  com campo de quantidade, prévia e confirmação -- o botão de confirmação
  chama-se "Confirmar extensão" (não "Estender Série" de novo) para não
  colidir com o botão que abre o diálogo, já que o Drawer de detalhe
  continua montado por trás.
