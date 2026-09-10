# 02 — Restaurar movimentações de estoque

**What to build:** O gerente consegue registrar entradas, saídas e ajustes usando os tipos atuais do produto, com saldo e histórico atualizados atomicamente e sem permitir estoque negativo.

**Blocked by:** 01 — Congelar contratos e integridade atuais.

**Status:** ready-for-agent

- [ ] Consultar novamente no DEV, via MCP, a definição vigente da função, constraints, grants e policies de estoque.
- [ ] Criar uma migration nova pela ferramenta de migrations, sem editar a migration que introduziu a regressão.
- [ ] Aceitar entrada manual, entrada por compra, saída manual, saída por venda em comanda, saída por uso interno e ajuste.
- [ ] Persistir quantidades positivas e determinar a direção da alteração pelo tipo do movimento.
- [ ] Atualizar o saldo e criar o histórico na mesma transação.
- [ ] Rejeitar tipo desconhecido, quantidade inválida e saída superior ao saldo sem efeito parcial.
- [ ] Preservar o contrato consumido atualmente pelo repositório de Produtos.
- [ ] Aplicar a migration somente no DEV pelo MCP do Supabase.
- [ ] Validar todos os tipos de movimento por testes de banco e pelo seam do repositório.
- [ ] Confirmar que as suítes existentes de Produtos e Comandas permanecem verdes.
