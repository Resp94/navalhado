# 05 — Finalizar comanda atomicamente

**What to build:** Ao confirmar o checkout, pagamentos, baixas de estoque, fechamento da comanda e atualização do agendamento são concluídos uma única vez ou revertidos juntos.

**Blocked by:** 02 — Restaurar movimentações de estoque; 03 — Restringir operações financeiras e de estoque; 04 — Proteger a quitação de comissões.

**Status:** completed

- [x] Caracterizar total, desconto, troco, pagamentos divididos e transição do agendamento antes da mudança.
- [x] Consultar o estado real das tabelas, funções e constraints no DEV pelo MCP.
- [x] Criar migration nova contendo um único comando transacional de finalização.
- [x] Validar autorização, tenant, estado aberto, itens, pagamentos e estoque dentro da transação.
- [x] Registrar cada pagamento e cada baixa de produto exatamente uma vez.
- [x] Fechar a comanda e atualizar o agendamento somente quando todos os efeitos forem válidos.
- [x] Garantir rollback integral diante de falha em qualquer item ou pagamento.
- [x] Tornar repetição e concorrência seguras, sem duplicar efeitos.
- [x] Fazer o repositório atual usar uma única chamada mantendo seu contrato externo.
- [x] Aplicar a migration somente no DEV pelo MCP.
- [x] Provar o fluxo completo e as falhas intermediárias por testes de banco, repositório e checkout.

**Evidências:** migration `20260910184952_finalizar_comanda_atomicamente` aplicada no DEV e corrigida pela migration compensatória `20260910185824_corrigir_prioridade_estado_finalizacao_comanda`; teste pgTAP com 23/23 asserções; testes de Comandas/checkout com 20/20; build TypeScript/Vite concluído.
