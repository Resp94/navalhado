# 10 — Registrar obrigações de comissão

**What to build:** Cada comanda finalizada gera obrigações auditáveis de comissão ligadas aos itens e ao profissional que as originaram, criando uma posição financeira independente do filtro visual.

**Blocked by:** 08 — Expandir o modelo para snapshots financeiros.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP os dados e constraints necessários para modelar obrigações no DEV.
- [ ] Criar migration expansiva, versionada e compatível com as quitações existentes.
- [ ] Gerar a obrigação na mesma transação da finalização da comanda.
- [ ] Vincular tenant, profissional, comanda, item, valor e regra que originou a comissão.
- [ ] Não gerar obrigação para item sem profissional ou comissão elegível.
- [ ] Impedir duplicação por repetição ou concorrência na finalização.
- [ ] Calcular saldo aberto acumulado sem limitar obrigação ao período selecionado na interface.
- [ ] Aplicar RLS, grants mínimos e validação de usuário ativo e tenant.
- [ ] Expor o saldo por contrato compatível com o módulo Financeiro.
- [ ] Aplicar no DEV pelo MCP e validar geração, isolamento, repetição e reconciliação.
