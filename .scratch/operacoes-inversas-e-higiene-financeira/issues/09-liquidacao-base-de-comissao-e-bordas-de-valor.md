# 09 — Liquidação: base de comissão e bordas de valor

**What to build:** Cada item liquidado passa a gravar qual base foi usada para calcular a comissão, e a regra vigente deixa de ser implícita no código para virar decisão registrada. No mesmo passo, a liquidação passa a aceitar a Comanda de cortesia — desconto integral, total zero, sem forma de pagamento — e a recusar valor recebido em dinheiro menor que o valor do pagamento, em vez de calcular troco sobre recebimento inexistente.

Os três itens andam juntos porque tocam a mesma função de liquidação, e fatiá-los significaria reescrevê-la três vezes.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado.

**Status:** done — migration aplicada no DEV, pgTAP e vitest verdes

- [x] Consultar pelo MCP a definição vigente da liquidação e as constraints de snapshot do item no DEV.
- [x] Criar migration nova acrescentando ao snapshot do item a base usada no cálculo da comissão, com constraint de valores aceitos.
- [x] Gravar na liquidação a base correspondente à regra vigente: valor bruto do item, antes do rateio de desconto.
- [x] Aceitar total zero quando o desconto iguala o subtotal, dispensando forma de pagamento nesse caso e mantendo a recusa de total negativo.
- [x] Recusar pagamento em dinheiro cujo valor recebido seja menor que o valor do próprio pagamento.
- [x] Registrar em ADR a regra vigente — comissão sobre valor bruto, desconto absorvido pela casa, gorjeta sem comissão e ausência de taxa de adquirente — como decisão consciente, apontando a spec futura de meios de pagamento como o lugar onde poderá mudar.
- [x] Cobrir por pgTAP: item gravando a base usada; cortesia com desconto integral liquidada sem pagamento; total negativo ainda recusado; recebimento em dinheiro insuficiente recusado.
- [x] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
- [x] Manter verdes as suítes atuais de Comandas e do checkout.

## Notas de execução

- Migration `20260912050000_liquidacao_base_comissao_e_bordas_valor`
  aplicada no DEV via MCP, versão reconciliada.
- `comanda_itens` ganha `snapshot_commission_base` (texto, com constraint
  aceitando apenas `gross_amount` por ora), preenchida por
  `settle_comanda` no momento da liquidação. O cálculo em si não mudou —
  já usava o valor bruto do item (antes do rateio do desconto) — apenas
  passou a ser uma decisão gravada e auditável por item, em vez de um
  detalhe implícito do código.
- `settle_comanda` reescrita com três mudanças de borda, todas na mesma
  função porque tocam a mesma validação de total/pagamento:
  1. `v_total < 0` (antes `v_total <= 0`) — total zero passa a ser aceito;
  2. quando o total é zero, a exigência de ao menos uma forma de
     pagamento é dispensada, e informar uma forma de pagamento nesse caso
     passa a ser um erro explícito ("Comanda de cortesia com total zero
     não deve informar forma de pagamento.");
  3. a validação de pagamentos ganha uma cláusula recusando
     `payment_method = 'cash'` com `received_cash < amount` ("Pagamento
     de comanda inválido.") — antes o troco era simplesmente calculado
     como zero quando o recebido não superava o valor, mascarando
     recebimento insuficiente.
- Desconto maior que o subtotal continua recusado pela validação
  pré-existente ("Desconto ou gorjeta inválidos."), que é o único caminho
  que poderia gerar total negativo — confirmado que esse caminho segue
  bloqueado.
- ADR 018 (`docs/adr/018_base_de_calculo_da_comissao_sobre_valor_bruto.md`)
  registra a regra vigente como decisão consciente: comissão sobre bruto,
  desconto absorvido pela casa, gorjeta sem comissão, sem modelagem de
  taxa de adquirente — apontando a spec futura de meios de pagamento como
  onde essas regras poderão mudar.
- Novo `supabase/tests/database/24_liquidacao_base_comissao_e_bordas_valor.test.sql`
  (13 asserções): base de comissão gravada; comissão sobre bruto mesmo
  com desconto; cortesia com desconto integral liquidada sem pagamento;
  cortesia recusando forma de pagamento informada por engano; desconto
  maior que o subtotal ainda recusado; recebimento em dinheiro
  insuficiente recusado. `05_finalizar_comanda_atomicamente.test.sql`
  revalidado (23 asserções, sem regressão — inclui um caso de dinheiro
  com troco que segue funcionando).
- Advisors de segurança sem alerta novo (`anon_security_definer_function_executable`
  em 15, `rls_enabled_no_policy` em 3, antes e depois); `npx tsc -b --noEmit`
  limpo; vitest completo: 67 arquivos / 436 testes verdes (mesma
  contagem dos tickets 07/08 — ticket puramente de banco, sem mudança de
  frontend).
