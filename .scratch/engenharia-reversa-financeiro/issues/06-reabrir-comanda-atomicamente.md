# 06 — Reabrir comanda atomicamente

**What to build:** O gerente reabre uma comanda fechada e o sistema reverte pagamentos, estoque e agendamento de forma única, rastreável e sem afetar movimentos independentes.

**Blocked by:** 05 — Finalizar comanda atomicamente.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP os efeitos produzidos pela finalização e o estado das comandas fechadas no DEV.
- [ ] Criar migration nova para um único comando transacional de reabertura.
- [ ] Exigir usuário ativo autorizado, tenant correto e comanda em estado fechado elegível.
- [ ] Referenciar os movimentos produzidos pela finalização, sem inferir estornos apenas pela quantidade dos itens.
- [ ] Reverter pagamentos segundo uma política auditável compatível com o comportamento atual.
- [ ] Restaurar estoque e agendamento na mesma transação.
- [ ] Rejeitar reabertura quando efeitos posteriores tornarem o estorno inseguro.
- [ ] Garantir rollback integral diante de qualquer falha.
- [ ] Impedir segunda reabertura e duplicação de estornos.
- [ ] Fazer o repositório atual usar uma única chamada preservando a experiência existente.
- [ ] Aplicar no DEV via MCP e validar por testes de banco, repositório, checkout e Agenda.
