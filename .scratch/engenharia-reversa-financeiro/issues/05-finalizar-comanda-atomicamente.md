# 05 — Finalizar comanda atomicamente

**What to build:** Ao confirmar o checkout, pagamentos, baixas de estoque, fechamento da comanda e atualização do agendamento são concluídos uma única vez ou revertidos juntos.

**Blocked by:** 02 — Restaurar movimentações de estoque; 03 — Restringir operações financeiras e de estoque; 04 — Proteger a quitação de comissões.

**Status:** ready-for-agent

- [ ] Caracterizar total, desconto, troco, pagamentos divididos e transição do agendamento antes da mudança.
- [ ] Consultar o estado real das tabelas, funções e constraints no DEV pelo MCP.
- [ ] Criar migration nova contendo um único comando transacional de finalização.
- [ ] Validar autorização, tenant, estado aberto, itens, pagamentos e estoque dentro da transação.
- [ ] Registrar cada pagamento e cada baixa de produto exatamente uma vez.
- [ ] Fechar a comanda e atualizar o agendamento somente quando todos os efeitos forem válidos.
- [ ] Garantir rollback integral diante de falha em qualquer item ou pagamento.
- [ ] Tornar repetição e concorrência seguras, sem duplicar efeitos.
- [ ] Fazer o repositório atual usar uma única chamada mantendo seu contrato externo.
- [ ] Aplicar a migration somente no DEV pelo MCP.
- [ ] Provar o fluxo completo e as falhas intermediárias por testes de banco, repositório e checkout.
