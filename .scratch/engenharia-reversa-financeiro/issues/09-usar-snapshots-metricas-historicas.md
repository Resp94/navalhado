# 09 — Usar snapshots nas métricas históricas

**What to build:** Consultas de períodos fechados retornam receita, CMV, comissão e resultado com os valores preservados no fechamento, sem serem alteradas por mudanças posteriores em cadastros.

**Blocked by:** 08 — Expandir o modelo para snapshots financeiros.

**Status:** completed

- [x] Consultar pelo MCP as funções financeiras e os planos das consultas atuais no DEV.
- [x] Criar migration nova para evoluir o contrato financeiro de forma compatível.
- [x] Calcular receita, desconto, CMV e comissão de registros novos a partir dos snapshots.
- [x] Manter fallback explícito para registros legados enquanto o backfill não estiver validado.
- [x] Distinguir valores confirmados, estimados e indisponíveis quando essa informação fizer parte do resultado.
- [x] Restringir consultas por tenant e intervalos temporais indexáveis.
- [x] Preservar o formato consumido pelo módulo Financeiro ou introduzir evolução compatível.
- [x] Comparar resultados com uma amostra reconciliada manualmente.
- [x] Adicionar índice somente se o plano de execução demonstrar necessidade.
- [x] Aplicar e validar no DEV pelo MCP; alterações cadastrais posteriores não podem mudar períodos fechados.

**Evidências:** migration `20260910200941_metricas_historicas_com_snapshots.sql` aplicada somente no DEV; amostra transacional via MCP permaneceu em serviços 54, produtos 54, CMV 8, comissão 16 e resultado líquido 89 após alterações cadastrais; plano atual em baixo volume usa varredura sequencial de custo 2.01, sem novo índice; teste focado de Financeiro 4/4 e build aprovados.
