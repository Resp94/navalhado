# 11 — Aplicar quitações às obrigações

**What to build:** Uma quitação parcial ou total liquida obrigações abertas de forma determinística e atualiza o saldo do profissional sem depender do período selecionado.

**Blocked by:** 04 — Proteger a quitação de comissões; 10 — Registrar obrigações de comissão.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP as obrigações e quitações existentes antes de alterar a função no DEV.
- [ ] Criar migration nova para associar quitações a obrigações sem apagar o registro original.
- [ ] Aplicar pagamentos às obrigações por ordem determinística dentro do tenant e profissional.
- [ ] Suportar liquidação parcial de uma obrigação e liquidação de várias obrigações em um pagamento.
- [ ] Rejeitar valor superior ao saldo aberto na mesma transação.
- [ ] Impedir sobreliquidação em chamadas concorrentes.
- [ ] Distinguir saldo atual, geração no período e pagamentos no período.
- [ ] Preservar o fluxo e o retorno atuais do modal de quitação.
- [ ] Manter trilha entre pagamento e cada obrigação liquidada.
- [ ] Aplicar no DEV via MCP e validar pagamentos parcial, total, múltiplo e concorrente.
