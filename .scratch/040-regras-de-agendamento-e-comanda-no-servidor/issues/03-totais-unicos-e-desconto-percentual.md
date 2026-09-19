# 03: Totais únicos e desconto percentual registrado

**What to build:** o total que o gestor vê no fechamento de Comanda passa a ser exatamente o total gravado, centavo por centavo. O desconto pode ser em reais ou em percentual (0% a 100%), e a Comanda guarda o tipo e o percentual original além do valor em reais. A tela deixa de recalcular totais, troco e situação da Sessão de Caixa por conta própria e usa o que os módulos de Comandas e de Caixa já oferecem.

**Blocked by:** 02 (Destinatário da gorjeta validado). Mesma RPC de liquidação.

**Status:** ready-for-agent

- [ ] A Comanda ganha tipo e percentual do desconto, gravados pela RPC de liquidação
- [ ] A RPC recusa percentual fora de 0 a 100
- [ ] A função de totais do módulo de Comandas aceita desconto em reais ou percentual, arredonda cada item e o desconto a centavo e limita o desconto ao subtotal, com a mesma regra da RPC
- [ ] O modal de fechamento usa essa função e o cálculo de troco do repositório, sem soma própria
- [ ] O modal usa o repositório de Caixa para saber se há Sessão de Caixa aberta
- [ ] Vitest da função de totais: preço com 3 casas, percentual quebrado, desconto acima do subtotal, cortesia (total zero)
- [ ] pgTAP: percentual gravado e total da RPC igual ao da função para os mesmos casos
- [ ] `npm run lint`, `npm test` e `npm run build` passam
