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

**Status:** done

- [x] Tipo novo de movimento de caixa, pagamento de conta, declarado na restrição de tipo e na
      expressão de sentido como saída, sem editar nenhuma função de apuração.
- [x] Vínculo bidirecional: o movimento aponta a Baixa e a Baixa aponta o movimento, criados na
      mesma transação, com índice único parcial em cada ponta impedindo que duas Baixas
      reivindiquem a mesma saída de gaveta.
- [x] Restrição na tabela de Baixas: origem gaveta tem Sessão de Caixa e movimento; as demais
      origens não têm nenhum dos dois (`payable_settlements_drawer_link_check`, já existia desde o
      ticket 07/036). O vínculo ao movimento **não** é verificado ao final da transação como o
      texto original sugeria: CHECK não é deferrable no Postgres, então a ordem de escrita foi
      invertida (ver notas) para que o CHECK já esteja satisfeito no INSERT da Baixa.
- [x] A RPC de Baixa passa a aceitar a origem gaveta, sem mudar assinatura, só com forma dinheiro.
- [x] Na ordem de lock fixa, a Baixa pela gaveta: trava a Conta a Pagar; trava a Sessão de Caixa
      informada e exige que esteja aberta e pertença ao tenant; recusa valor pago acima do
      disponível apurado pela função privada, com mensagem no padrão da Quitação de Comissão e do
      vale (histórias 14 e 15).
- [x] Na Baixa pela gaveta, a data do pagamento é o dia de negócio corrente do tenant, definida
      pelo servidor.
- [x] Estorno de Baixa pela gaveta só é aceito enquanto a sessão do movimento estiver aberta, com
      orientação de reabrir o turno; marca o movimento como estornado com o mesmo autor e motivo, e
      o valor volta a contar na gaveta (história 18).
- [x] O Fechamento de Caixa passa a gravar versão de cálculo nova, a partir da qual o valor
      esperado considera pagamentos de conta; nenhuma coluna de fotografia nova na Sessão de Caixa.
- [x] O contrato de leitura do extrato devolve a descrição da Conta a Pagar para movimentos de
      pagamento de conta; o extrato impresso mostra rótulo próprio e essa descrição.
- [x] Diálogo de Baixa mostra a origem gaveta só quando existe sessão aberta, trava a forma em
      dinheiro nessa origem e exibe o disponível lido do contrato de saldo apurado do ticket 01.
- [x] Criada a suíte pgTAP `30_baixa_conta_pela_gaveta` (26 casos), cobrindo:
  - [x] Baixa pela gaveta recusada acima do disponível e aceita no limite;
  - [x] recusada com forma diferente de dinheiro, com sessão fechada e com sessão de outro tenant;
  - [x] vínculo bidirecional e índice único (verificado via `pg_indexes`);
  - [x] data do pagamento definida pelo servidor;
  - [x] estorno recusado com sessão fechada e aceito após reabertura, marcando o movimento como
        estornado e devolvendo o valor à gaveta.
- [x] Regressão na suíte pgTAP `07_fechar_caixa_atomicamente`: `calculation_version` atualizada
      para `cash_expected_v4`; a sonda de sentido por tipo continua verde com o tipo novo.
- [x] Regressão na suíte pgTAP `25_validar_saldo_gaveta_quitacao_comissao`: novo caso prova que o
      pagamento de conta reduz o disponível visto pela sangria (mesma apuração única que
      quitação/vale já consomem — não editada, então a redução vale igual para as três sem caso
      de teste dedicado a cada uma).
- [x] Obrigações de comissão, Quitação de Comissão, Conta do Profissional e formas de pagamento de
      Comanda não mudam de semântica; as suítes existentes delas continuam verdes.
- [x] Testes de repositório e de adaptador do módulo cobrem Baixa pela gaveta (estorno reusa a
      mesma RPC/adaptador do ticket 07/036, sem mudança de assinatura, então sem teste dedicado
      novo do lado cliente).
- [x] Teste da aba cobre a oferta da origem gaveta só com sessão aberta.
- [x] O teste de página existente do extrato ganha caso com pagamento de conta.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migração `20260914160000_baixa_pela_gaveta_estorno_e_extrato_impresso.sql`.
  `cash_movements.direction` é gerada e obrigatória (ticket 01/036): como o
  Postgres não tem "alter expression", o CASE ganhou o ramo `baixa_conta_pagar
  -> saida` via `drop column` + `add column` (mesma técnica da criação).
- **Ordem de escrita invertida em relação ao vale**: `payable_settlements_drawer_link_check`
  exige `cash_movement_id` preenchido já no INSERT quando `source = 'gaveta'`, e CHECK não é
  deferrable no Postgres. Por isso `settle_payable` insere o `cash_movements` PRIMEIRO (sem
  `payable_settlement_id` ainda), depois o `payable_settlements` já apontando pra ele, e só então
  faz UPDATE no movimento com o vínculo de volta -- as três escritas na mesma transação da RPC.
- `close_cash_session` foi a única das três funções que já consumiam a apuração única
  (`register_commission_payout`, `register_professional_advance`, `close_cash_session`) que
  precisou de qualquer mudança de código -- e só para trocar a string `calculation_version` de
  `cash_expected_v3` para `cash_expected_v4`. As outras duas continuam idênticas: o disponível que
  elas leem já vem reduzido automaticamente.
- Frontend: `BaixaDialog` ganhou `caixaRepository` (novo prop obrigatório, threaded por
  `ContaPagarDetalheDrawer` e `ContasPagarTab`), detecta sessão aberta via `getActiveSession` e
  mostra o `SegmentedControl` de origem só quando há uma; ao escolher "Pela gaveta", a forma vira
  texto fixo "Dinheiro", a data some do formulário e o disponível é lido de
  `getExpectedDrawerAmount`. `ContasPagarTab.test.tsx` ganhou `FakeCaixaAdapter` (implementação
  completa de `ICaixaAdapter`, a maioria dos métodos não usados lança "não implementado neste
  teste") para não depender do Supabase real nos testes existentes de Baixa.
- `ExtratoSessaoCaixaModal`: `baixa_conta_pagar` ganhou entrada em `MOVEMENT_SECTIONS`
  (`"Pagamento de conta"`) com um caso especial de rótulo (`"Pagamento de conta: {descrição}"`
  usando a chave aditiva `payable_description` do contrato, não `reason`).
