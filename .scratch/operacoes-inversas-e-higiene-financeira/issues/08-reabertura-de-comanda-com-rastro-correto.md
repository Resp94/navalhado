# 08 — Reabertura de Comanda com rastro correto

**What to build:** Quando o gerente reabre uma Comanda, a devolução do estoque aparece no histórico do Produto como estorno e não como entrada manual de mercadoria, mantendo o vínculo com o movimento original. A obrigação de comissão revertida preserva a identificação do item que a originou mesmo depois de a Comanda ser refaturada e os itens antigos substituídos. O gerente também consegue consultar quais formas de pagamento foram desfeitas naquela reabertura.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado.

**Status:** done — migration aplicada no DEV, pgTAP e vitest verdes

- [x] Consultar pelo MCP os tipos aceitos de movimentação de estoque e a definição vigente da reabertura de Comanda e do gatilho de obrigações no DEV.
- [x] Criar migration nova acrescentando o tipo próprio de estorno ao conjunto de tipos de movimentação de estoque.
- [x] Usar esse tipo na devolução feita pela reabertura de Comanda, preservando o vínculo com o movimento original que está sendo estornado.
- [x] Recusar esse tipo na função de ajuste de estoque exposta à aplicação, tornando-o exclusivo das funções internas de estorno.
- [x] Acrescentar à obrigação de comissão a identificação de origem do item em coluna sem vínculo referencial, preenchida no momento em que a obrigação é criada.
- [x] Expor a leitura dos estornos de pagamento de Comanda para papéis financeiros e criar índice pelas colunas de unidade e Comanda.
- [x] Cobrir por pgTAP: devolução de estoque com o tipo de estorno e vínculo ao movimento original; ajuste da aplicação recusando o tipo; obrigação preservando a origem após reabertura e refaturamento; leitura dos estornos de pagamento recusada para papel não autorizado.
- [x] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
- [x] Manter verdes as suítes atuais de Comandas e Produtos.

## Notas de execução

- Migration `20260912040000_reabertura_comanda_rastro_correto` aplicada no
  DEV via MCP, versão reconciliada. Durante a aplicação a MCP tentou
  recriar a policy `comanda_payment_reversals_select_financial`, que já
  existia desde a migration de code-review `20260911142010` — removida do
  script antes de reaplicar; nenhuma outra mudança precisou de ajuste.
- `product_movements_movement_type_check` ganha o valor `entry_reversal`,
  e a tabela ganha `reverses_movement_id` (auto-referência nullable) para
  o vínculo explícito com o movimento original estornado.
- `reopen_comanda` passa a gravar `entry_reversal` (em vez de
  `entry_manual`) na devolução de estoque, preenchendo
  `reverses_movement_id` com o id do movimento `exit_sale_comanda`
  revertido.
- `adjust_product_stock` (função exposta à aplicação) já rejeitava
  qualquer tipo fora da sua lista explícita de `if/elsif` — `entry_reversal`
  cai automaticamente no `else` e é recusado com
  "Tipo de movimentação inválido: entry_reversal", sem precisar de
  nenhuma mudança de código, apenas cobertura pgTAP confirmando.
- `commission_obligations` ganha `origin_item_label` (texto, sem FK),
  preenchida pelo gatilho `create_commission_obligations_from_closed_comanda`
  a partir do nome do serviço ou produto do item de origem; um `UPDATE`
  de backfill preenche as obrigações já existentes. Como
  `comanda_item_id` tem `ON DELETE SET NULL`, esse vínculo se perde
  quando o item é excluído no refaturamento — `origin_item_label`
  sobrevive por não ter vínculo referencial (confirmado por pgTAP
  simulando a exclusão do item).
- Índice `comanda_payment_reversals_tenant_comanda_idx` criado por
  unidade e comanda; a leitura para papéis financeiros já existia
  (policy de code-review anterior) — confirmada por pgTAP com gerente
  lendo e barbeiro bloqueado pela RLS.
- Novo `supabase/tests/database/23_reabertura_comanda_rastro_correto.test.sql`
  (11 asserções). `06_reabrir_comanda_atomicamente.test.sql` atualizado
  (18→19 asserções): três asserções que citavam `entry_manual` para a
  devolução de estorno passam a citar `entry_reversal`, e uma nova
  asserção confirma o vínculo `reverses_movement_id` com o movimento
  original.
- Frontend: `MovementType` (produtos) e `getMovementInfo`/`isEntryMovement`
  em `Produtos.tsx` ganham o rótulo "Estorno de reabertura de comanda"
  para `entry_reversal`, para o histórico de produto não cair no rótulo
  genérico "Movimentação registrada".
- Advisors de segurança sem alerta novo (`anon_security_definer_function_executable`
  seguiu em 15, `rls_enabled_no_policy` em 3, ambos antes e depois);
  `npx tsc -b --noEmit` limpo; vitest completo: 67 arquivos / 436 testes
  verdes (mesma contagem do ticket 07 — nenhum teste de frontend precisou
  de novo caso, apenas o rótulo aditivo).
