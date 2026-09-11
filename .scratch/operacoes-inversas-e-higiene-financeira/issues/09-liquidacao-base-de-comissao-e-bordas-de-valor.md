# 09 — Liquidação: base de comissão e bordas de valor

**What to build:** Cada item liquidado passa a gravar qual base foi usada para calcular a comissão, e a regra vigente deixa de ser implícita no código para virar decisão registrada. No mesmo passo, a liquidação passa a aceitar a Comanda de cortesia — desconto integral, total zero, sem forma de pagamento — e a recusar valor recebido em dinheiro menor que o valor do pagamento, em vez de calcular troco sobre recebimento inexistente.

Os três itens andam juntos porque tocam a mesma função de liquidação, e fatiá-los significaria reescrevê-la três vezes.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP a definição vigente da liquidação e as constraints de snapshot do item no DEV.
- [ ] Criar migration nova acrescentando ao snapshot do item a base usada no cálculo da comissão, com constraint de valores aceitos.
- [ ] Gravar na liquidação a base correspondente à regra vigente: valor bruto do item, antes do rateio de desconto.
- [ ] Aceitar total zero quando o desconto iguala o subtotal, dispensando forma de pagamento nesse caso e mantendo a recusa de total negativo.
- [ ] Recusar pagamento em dinheiro cujo valor recebido seja menor que o valor do próprio pagamento.
- [ ] Registrar em ADR a regra vigente — comissão sobre valor bruto, desconto absorvido pela casa, gorjeta sem comissão e ausência de taxa de adquirente — como decisão consciente, apontando a spec futura de meios de pagamento como o lugar onde poderá mudar.
- [ ] Cobrir por pgTAP: item gravando a base usada; cortesia com desconto integral liquidada sem pagamento; total negativo ainda recusado; recebimento em dinheiro insuficiente recusado.
- [ ] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
- [ ] Manter verdes as suítes atuais de Comandas e do checkout.
