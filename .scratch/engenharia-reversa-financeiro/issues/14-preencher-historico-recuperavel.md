# 14 — Preencher o histórico recuperável

**What to build:** Registros anteriores à implantação recebem snapshots e obrigações somente quando os dados permitem reconstrução confiável, com classificação explícita para valores estimados ou indisponíveis.

**Blocked by:** 08 — Expandir o modelo para snapshots financeiros; 10 — Registrar obrigações de comissão; 13 — Registrar ajustes posteriores de caixa.

**Status:** completed

- [x] Inventariar pelo MCP volumes, nulidade, relações e capacidade de reconstrução por tenant no DEV.
- [x] Definir critérios objetivos para valor confirmado, estimado e indisponível.
- [x] Criar migration ou procedimento versionado, idempotente e seguro para o backfill.
- [x] Preencher somente valores que possam ser derivados de fontes históricas identificáveis.
- [x] Não usar configuração atual como fato histórico sem marcar a estimativa.
- [x] Processar por lotes se o volume ou os locks observados justificarem.
- [x] Permitir repetição sem duplicar obrigações, snapshots ou ajustes.
- [x] Reconciliar comandas, itens, pagamentos, estoque, comissões e caixas após o preenchimento.
- [x] Manter registros legados legíveis durante todo o processo.
- [x] Executar exclusivamente no DEV pelo MCP e produzir relatório de cobertura e exceções.

**Evidências:** migration `20260910204825_backfill_historico_financeiro.sql` aplicada no DEV pelo MCP; backfill real atualizou 3 itens do tenant legado `235ea034-3d30-4eaf-9af7-befd68040ad7`, sem itens indisponíveis restantes. Teste `supabase/tests/database/14_backfill_historico_financeiro.test.sql` aprovado com 12/12 asserções; segunda execução não atualiza novamente e não cria obrigações estimadas.
