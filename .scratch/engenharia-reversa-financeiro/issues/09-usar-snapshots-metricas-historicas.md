# 09 — Usar snapshots nas métricas históricas

**What to build:** Consultas de períodos fechados retornam receita, CMV, comissão e resultado com os valores preservados no fechamento, sem serem alteradas por mudanças posteriores em cadastros.

**Blocked by:** 08 — Expandir o modelo para snapshots financeiros.

**Status:** ready-for-agent

- [ ] Consultar pelo MCP as funções financeiras e os planos das consultas atuais no DEV.
- [ ] Criar migration nova para evoluir o contrato financeiro de forma compatível.
- [ ] Calcular receita, desconto, CMV e comissão de registros novos a partir dos snapshots.
- [ ] Manter fallback explícito para registros legados enquanto o backfill não estiver validado.
- [ ] Distinguir valores confirmados, estimados e indisponíveis quando essa informação fizer parte do resultado.
- [ ] Restringir consultas por tenant e intervalos temporais indexáveis.
- [ ] Preservar o formato consumido pelo módulo Financeiro ou introduzir evolução compatível.
- [ ] Comparar resultados com uma amostra reconciliada manualmente.
- [ ] Adicionar índice somente se o plano de execução demonstrar necessidade.
- [ ] Aplicar e validar no DEV pelo MCP; alterações cadastrais posteriores não podem mudar períodos fechados.
