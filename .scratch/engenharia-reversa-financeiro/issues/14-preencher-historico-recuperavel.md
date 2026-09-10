# 14 — Preencher o histórico recuperável

**What to build:** Registros anteriores à implantação recebem snapshots e obrigações somente quando os dados permitem reconstrução confiável, com classificação explícita para valores estimados ou indisponíveis.

**Blocked by:** 08 — Expandir o modelo para snapshots financeiros; 10 — Registrar obrigações de comissão; 13 — Registrar ajustes posteriores de caixa.

**Status:** ready-for-agent

- [ ] Inventariar pelo MCP volumes, nulidade, relações e capacidade de reconstrução por tenant no DEV.
- [ ] Definir critérios objetivos para valor confirmado, estimado e indisponível.
- [ ] Criar migration ou procedimento versionado, idempotente e seguro para o backfill.
- [ ] Preencher somente valores que possam ser derivados de fontes históricas identificáveis.
- [ ] Não usar configuração atual como fato histórico sem marcar a estimativa.
- [ ] Processar por lotes se o volume ou os locks observados justificarem.
- [ ] Permitir repetição sem duplicar obrigações, snapshots ou ajustes.
- [ ] Reconciliar comandas, itens, pagamentos, estoque, comissões e caixas após o preenchimento.
- [ ] Manter registros legados legíveis durante todo o processo.
- [ ] Executar exclusivamente no DEV pelo MCP e produzir relatório de cobertura e exceções.
