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

**Status:** done

- [x] Tabela de Baixa, várias por conta, com: conta a pagar; principal com duas casas e maior que
      zero; juros e multa maior ou igual a zero; desconto maior ou igual a zero e no máximo
      principal mais juros; valor pago gerado como principal mais juros menos desconto; data do
      pagamento; forma (`cash`, `pix`, `transfer`, `boleto`, `credit_card`, `debit_card`,
      `automatic_debit`, `other`) em domínio próprio da Baixa, sem alterar as formas de Comanda;
      origem (`gaveta` ou `fora_do_caixa`); Sessão de Caixa e movimento de caixa; autor e momento;
      trilha de estorno com momento, autor e motivo, todos ou nenhum.
- [x] RPC de Baixa com todos os parâmetros, incluindo origem e Sessão de Caixa, recusando a origem
      gaveta com mensagem explícita.
- [x] A Baixa valida: conta em aberto ou parcialmente paga; principal não excede o saldo restante;
      valores arredondados a duas casas com recusa de valor não numérico; forma no domínio;
      combinação entre origem e forma permitida. Atualiza valor baixado e estado na mesma
      transação (histórias 11, 12 e 16).
- [x] Juros e desconto gravados separados do principal (história 13).
- [x] Valor pago zero é aceito fora do caixa.
- [x] Data do pagamento fora do caixa é informada pelo gestor e recusada quando está no futuro em
      relação ao dia de negócio do tenant.
- [x] Estorno de Baixa exige motivo com pelo menos cinco caracteres, recusa Baixa já estornada,
      grava autor e momento, devolve o principal ao saldo e recalcula o estado para aberto ou
      parcialmente pago; nada é apagado (história 17).
- [x] Baixa e Estorno de Baixa travam primeiro a Conta a Pagar (e, no estorno, a Baixa); toda
      verificação de estado e saldo é feita depois do lock.
- [x] Contrato de leitura de detalhe devolve a conta e suas Baixas com autor e trilha de estorno
      (história 35); a trilha de cancelamento e o resumo da Série entram nos tickets 08 e 11.
- [x] Índices: FK da conta indexado; índice parcial por tenant e data de pagamento restrito às
      Baixas não estornadas.
- [x] Acesso da tabela de Baixas no mesmo padrão da tabela de Conta a Pagar; profissional não lê.
- [x] Toda Baixa e todo estorno registram quem fez e quando (história 38).
- [x] Na aba, diálogo de Baixa e diálogo de Estorno de Baixa, e visão de detalhe da conta, usáveis
      em largura de celular.
- [x] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [x] Baixa parcial e total, com juros e desconto;
  - [x] valor pago zero aceito fora do caixa;
  - [x] data futura recusada;
  - [x] origem gaveta recusada;
  - [x] estorno devolvendo o estado correto;
  - [x] duas Baixas concorrentes na mesma conta não ultrapassam o valor;
  - [x] profissional não lê Baixas nem executa Baixa ou estorno; gerente de outro tenant não lê
        nem escreve.
- [x] Testes de repositório e de adaptador do módulo cobrem Baixa, estorno e detalhe.
- [x] Teste da aba cobre Baixa e estorno com repositório injetado.
- [x] Glossário do projeto atualizado com Baixa, Estorno de Baixa e origem do dinheiro.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migration `supabase/migrations/20260914090000_baixa_fora_do_caixa_e_estorno.sql` aplicada em
  seis partes no DEV via MCP `apply_migration` (tabela `payable_settlements`, `settle_payable`,
  `reverse_payable_settlement`, `get_payable`, `list_payable_settlements`, e uma correção de bug
  descrita abaixo), verificada ao vivo por `to_regclass`/`to_regprocedure`.
- **Bug encontrado e corrigido durante a validação da suíte pgTAP**: `list_payable_settlements`
  tinha `select tenant_id into v_payable_tenant from public.payables where id = p_payable_id;` —
  como a função usa `returns table (id uuid, ...)`, a coluna de saída `id` sombreia a referência
  não qualificada a `id` dentro do corpo da função (mesma classe de bug já registrada no ticket
  06/036 para `list_payables`). Corrigido qualificando com alias de tabela
  (`from public.payables p where p.id = p_payable_id`), reaplicado como migration corretiva
  (`baixa_fora_do_caixa_parte6_fix_list_settlements_ambiguous_id`) e revalidado.
- Suíte pgTAP `29_contas_a_pagar.test.sql` estendida de 42 para 83 asserções (as 41 do ticket
  06/036 continuam passando), validada ao vivo no DEV via MCP `execute_sql` em transação
  `begin; ... rollback;`. "Duas Baixas concorrentes" é testado como serialização de conexão única
  (a segunda Baixa enxerga o saldo já reduzido pela primeira e é recusada ao ultrapassar o valor
  restante) — concorrência real exigiria duas conexões simultâneas, fora do alcance de um teste
  pgTAP de conexão única.
- Módulo `src/modules/contas-pagar/` estendido com `obterConta`, `darBaixa`, `estornarBaixa`,
  `listarBaixas` no repositório, adaptador e tipos. Componentes novos:
  `src/components/financeiro/BaixaDialog.tsx`, `EstornoBaixaDialog.tsx` e
  `ContaPagarDetalheDrawer.tsx` (aberto ao clicar numa linha/cartão da lista em
  `ContasPagarTab.tsx`). Sem seletor de origem no diálogo de Baixa: origem é sempre
  `fora_do_caixa` até o ticket 15/036 acrescentar a gaveta.
- Testes de front: `ContasPagarRepository.test.ts` (+27 casos: obterConta, darBaixa, estornarBaixa,
  listarBaixas), `SupabaseContasPagarAdapter.test.ts` (+13 casos) e `ContasPagarTab.test.tsx`
  (+2 casos: dar Baixa e estornar pelo detalhe, usando um `FakeContasPagarAdapter` estendido com
  Baixas em memória, mesma decisão de "sem adaptador em memória real" do módulo). `npx tsc -b` e
  `npx oxlint` limpos; `npx vitest run` verde na suíte completa.
- Verificação visual em navegador não foi feita nesta sessão, pela mesma limitação já registrada
  no ticket 06/036 (sem `.claude/launch.json` para login autenticado de gerente).
