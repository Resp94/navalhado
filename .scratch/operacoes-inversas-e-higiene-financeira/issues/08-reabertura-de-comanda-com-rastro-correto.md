# 08 — Reabertura de Comanda com rastro correto

**What to build:** Quando o gerente reabre uma Comanda, a devolução do estoque aparece no histórico do Produto como estorno e não como entrada manual de mercadoria, mantendo o vínculo com o movimento original. A obrigação de comissão revertida preserva a identificação do item que a originou mesmo depois de a Comanda ser refaturada e os itens antigos substituídos. O gerente também consegue consultar quais formas de pagamento foram desfeitas naquela reabertura.

**Blocked by:** 01 — Suíte de banco confiável; 02 — Histórico de migrations reconciliado.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP os tipos aceitos de movimentação de estoque e a definição vigente da reabertura de Comanda e do gatilho de obrigações no DEV.
- [ ] Criar migration nova acrescentando o tipo próprio de estorno ao conjunto de tipos de movimentação de estoque.
- [ ] Usar esse tipo na devolução feita pela reabertura de Comanda, preservando o vínculo com o movimento original que está sendo estornado.
- [ ] Recusar esse tipo na função de ajuste de estoque exposta à aplicação, tornando-o exclusivo das funções internas de estorno.
- [ ] Acrescentar à obrigação de comissão a identificação de origem do item em coluna sem vínculo referencial, preenchida no momento em que a obrigação é criada.
- [ ] Expor a leitura dos estornos de pagamento de Comanda para papéis financeiros e criar índice pelas colunas de unidade e Comanda.
- [ ] Cobrir por pgTAP: devolução de estoque com o tipo de estorno e vínculo ao movimento original; ajuste da aplicação recusando o tipo; obrigação preservando a origem após reabertura e refaturamento; leitura dos estornos de pagamento recusada para papel não autorizado.
- [ ] Aplicar no DEV pelo MCP e comparar advisors antes e depois.
- [ ] Manter verdes as suítes atuais de Comandas e Produtos.
