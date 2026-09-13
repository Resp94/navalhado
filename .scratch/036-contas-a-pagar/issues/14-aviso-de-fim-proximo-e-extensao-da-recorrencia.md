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

**Status:** ready-for-agent

- [ ] A Série exibe aviso de fim próximo quando sua última ocorrência não está cancelada e vence em
      até 60 dias a partir do dia de negócio corrente do tenant, calculado no servidor
      (história 28).
- [ ] RPC de extensão gera de 1 a 60 ocorrências novas, com posições a partir da maior posição
      existente, pelo mesmo calendário ancorado na data âncora original.
- [ ] Valor, categoria, fornecedor e descrição das ocorrências novas vêm da última ocorrência não
      cancelada.
- [ ] Extensão de Parcelamento é recusada.
- [ ] A extensão trava a Série e registra autor e momento (história 38).
- [ ] Na aba, o aviso aparece na Série e oferece estender, com prévia das ocorrências novas pelo
      mesmo cálculo do servidor.
- [ ] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [ ] extensão continuando posições e calendário ancorados;
  - [ ] valores herdados da última ocorrência não cancelada;
  - [ ] aviso na fronteira de 60 dias;
  - [ ] extensão de Parcelamento recusada.
- [ ] Testes de repositório e de adaptador do módulo cobrem aviso e extensão.
- [ ] `npm run test` e `npm run test:db` verdes.
