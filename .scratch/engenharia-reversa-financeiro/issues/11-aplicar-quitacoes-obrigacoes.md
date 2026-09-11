# 11 — Aplicar quitações às obrigações

**What to build:** Uma quitação parcial ou total liquida obrigações abertas de forma determinística e atualiza o saldo do profissional sem depender do período selecionado.

**Blocked by:** 04 — Proteger a quitação de comissões; 10 — Registrar obrigações de comissão.

**Status:** completed

- [x] Consultar pelo MCP as obrigações e quitações existentes antes de alterar a função no DEV.
- [x] Criar migration nova para associar quitações a obrigações sem apagar o registro original.
- [x] Aplicar pagamentos às obrigações por ordem determinística dentro do tenant e profissional.
- [x] Suportar liquidação parcial de uma obrigação e liquidação de várias obrigações em um pagamento.
- [x] Rejeitar valor superior ao saldo aberto na mesma transação.
- [x] Impedir sobreliquidação em chamadas concorrentes.
- [x] Distinguir saldo atual, geração no período e pagamentos no período.
- [x] Preservar o fluxo e o retorno atuais do modal de quitação.
- [x] Manter trilha entre pagamento e cada obrigação liquidada.
- [x] Aplicar no DEV via MCP e validar pagamentos parcial, total, múltiplo e concorrente.

**Evidências:** migrations `20260910203309_quitacoes_obrigacoes_comissao.sql` e `20260910204028_saldo_comissoes_contrato.sql` aplicadas no DEV pelo MCP; teste `supabase/tests/database/11_quitacoes_obrigacoes.test.sql` aprovado com 21/21 asserções. A assinatura e o retorno do RPC foram preservados, com alocação FIFO e bloqueio `FOR UPDATE`.
