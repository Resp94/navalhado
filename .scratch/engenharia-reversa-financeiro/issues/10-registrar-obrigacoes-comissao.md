# 10 — Registrar obrigações de comissão

**What to build:** Cada comanda finalizada gera obrigações auditáveis de comissão ligadas aos itens e ao profissional que as originaram, criando uma posição financeira independente do filtro visual.

**Blocked by:** 08 — Expandir o modelo para snapshots financeiros.

**Status:** completed

- [x] Consultar pelo MCP os dados e constraints necessários para modelar obrigações no DEV.
- [x] Criar migration expansiva, versionada e compatível com as quitações existentes.
- [x] Gerar a obrigação na mesma transação da finalização da comanda.
- [x] Vincular tenant, profissional, comanda, item, valor e regra que originou a comissão.
- [x] Não gerar obrigação para item sem profissional ou comissão elegível.
- [x] Impedir duplicação por repetição ou concorrência na finalização.
- [x] Calcular saldo aberto acumulado sem limitar obrigação ao período selecionado na interface.
- [x] Aplicar RLS, grants mínimos e validação de usuário ativo e tenant.
- [x] Expor o saldo por contrato compatível com o módulo Financeiro.
- [x] Aplicar no DEV pelo MCP e validar geração, isolamento, repetição e reconciliação.

**Evidências:** migration `20260910202715_obrigacoes_comissao_por_item.sql` aplicada no DEV pelo MCP; teste `supabase/tests/database/10_obrigacoes_comissao.test.sql` aprovado com 19/19 asserções. A obrigação é criada pelo trigger na transição para `fechada`, usa `snapshot_commission_amount`, possui unicidade por item, RLS e leitura autenticada mínima.
