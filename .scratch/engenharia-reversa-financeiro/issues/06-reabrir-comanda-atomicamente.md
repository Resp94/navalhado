# 06 — Reabrir comanda atomicamente

**What to build:** O gerente reabre uma comanda fechada e o sistema reverte pagamentos, estoque e agendamento de forma única, rastreável e sem afetar movimentos independentes.

**Blocked by:** 05 — Finalizar comanda atomicamente.

**Status:** completed

- [x] Consultar pelo MCP os efeitos produzidos pela finalização e o estado das comandas fechadas no DEV.
- [x] Criar migration nova para um único comando transacional de reabertura.
- [x] Exigir usuário ativo autorizado, tenant correto e comanda em estado fechado elegível.
- [x] Referenciar os movimentos produzidos pela finalização, sem inferir estornos apenas pela quantidade dos itens.
- [x] Reverter pagamentos segundo uma política auditável compatível com o comportamento atual.
- [x] Restaurar estoque e agendamento na mesma transação.
- [x] Rejeitar reabertura quando efeitos posteriores tornarem o estorno inseguro.
- [x] Garantir rollback integral diante de qualquer falha.
- [x] Impedir segunda reabertura e duplicação de estornos.
- [x] Fazer o repositório atual usar uma única chamada preservando a experiência existente.
- [x] Aplicar no DEV via MCP e validar por testes de banco, repositório, checkout e Agenda.

**Evidências:** migration `20260910191234_reabrir_comanda_atomicamente` aplicada no DEV; teste pgTAP com 18/18 asserções; adapter com RPC única testado (3/3); build TypeScript/Vite concluído.
