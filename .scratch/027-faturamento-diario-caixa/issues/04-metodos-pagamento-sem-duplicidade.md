# 04 — Métodos de pagamento e comandas sem duplicidade

**What to build:** O resumo diário detalha métodos de pagamento e contagens sem inflar o faturamento em comandas com pagamentos divididos ou com fechamento e pagamento em datas diferentes.

**Blocked by:** 01 — MVP de faturamento diário no Caixa

**Status:** ready-for-agent

- [ ] Exibir valores recebidos por dinheiro, PIX, cartão e outros meios.
- [ ] Exibir quantidade de comandas fechadas e quantidade de pagamentos por dia.
- [ ] Contar uma comanda fechada uma única vez no faturamento, independentemente da quantidade de pagamentos.
- [ ] Contabilizar cada pagamento na data de `paid_at` para a distribuição de recebimentos.
- [ ] Representar corretamente uma comanda fechada em um dia e paga em outro.
- [ ] Preservar a conciliação atual da gaveta e não misturar PIX ou cartão com dinheiro físico.
- [ ] Cobrir pagamentos divididos e divergência legítima entre faturamento e recebimento.
- [ ] Validar os valores no banco de desenvolvimento após os cenários de teste.
