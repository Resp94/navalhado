# 02 — Restaurar movimentações de estoque

**What to build:** O gerente consegue registrar entradas, saídas e ajustes usando os tipos atuais do produto, com saldo e histórico atualizados atomicamente e sem permitir estoque negativo.

**Blocked by:** 01 — Congelar contratos e integridade atuais.

**Status:** in-progress — migration aplicada no DEV e pgTAP validado; suíte da aplicação pendente

- [x] Consultar novamente no DEV, via MCP, a definição vigente da função, constraints, grants e policies de estoque.
- [x] Criar uma migration nova pela ferramenta de migrations, sem editar a migration que introduziu a regressão.
- [x] Aceitar entrada manual, entrada por compra, saída manual, saída por venda em comanda, saída por uso interno e ajuste.
- [x] Persistir quantidades positivas e determinar a direção da alteração pelo tipo do movimento.
- [x] Atualizar o saldo e criar o histórico na mesma transação.
- [x] Rejeitar tipo desconhecido, quantidade inválida e saída superior ao saldo sem efeito parcial.
- [x] Preservar o contrato consumido atualmente pelo repositório de Produtos.
- [x] Aplicar a migration somente no DEV pelo MCP do Supabase.
- [x] Validar todos os tipos de movimento por testes de banco e pelo seam do repositório.
- [ ] Confirmar que as suítes existentes de Produtos e Comandas permanecem verdes.
