# 02 — Histórico de migrations reconciliado

**What to build:** O responsável técnico lista as migrations e vê o repositório e o DEV contando a mesma história: cada arquivo corresponde à versão registrada no banco, e nenhuma entrada do histórico existe sem arquivo correspondente.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Levantar pelo MCP a lista de versões registradas no DEV e comparar com os arquivos do repositório.
- [ ] Registrar a lista de divergências antes da correção, para servir de evidência.
- [ ] Reconciliar cada versão divergente pelo comando de reparo da CLI do Supabase, sem renomear nem reescrever arquivo de migration.
- [ ] Remover do histórico do DEV as entradas de sondagem que não possuem arquivo correspondente.
- [ ] Confirmar que a listagem de migrations não apresenta mais divergência entre local e remoto.
- [ ] Confirmar que nenhuma definição de banco mudou em consequência do reparo, comparando advisors antes e depois.
- [ ] Registrar em nota a decisão sobre como as próximas migrations serão aplicadas no DEV, para que a divergência não se repita.
