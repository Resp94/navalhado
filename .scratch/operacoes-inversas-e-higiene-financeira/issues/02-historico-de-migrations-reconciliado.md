# 02 — Histórico de migrations reconciliado

**What to build:** O responsável técnico lista as migrations e vê o repositório e o DEV contando a mesma história: cada arquivo corresponde à versão registrada no banco, e nenhuma entrada do histórico existe sem arquivo correspondente.

**Blocked by:** None (can start immediately).

**Status:** done — reconciliado no DEV em 2026-09-12

- [x] Levantar pelo MCP a lista de versões registradas no DEV e comparar com os arquivos do repositório.
- [x] Registrar a lista de divergências antes da correção, para servir de evidência.
- [x] Reconciliar cada versão divergente pelo comando de reparo da CLI do Supabase, sem renomear nem reescrever arquivo de migration.
- [x] Remover do histórico do DEV as entradas de sondagem que não possuem arquivo correspondente.
- [x] Confirmar que a listagem de migrations não apresenta mais divergência entre local e remoto.
- [x] Confirmar que nenhuma definição de banco mudou em consequência do reparo, comparando advisors antes e depois.
- [x] Registrar em nota a decisão sobre como as próximas migrations serão aplicadas no DEV, para que a divergência não se repita.

## Nota de decisão

As próximas migrations desta spec continuam sendo aplicadas no DEV pelo MCP do Supabase (`apply_migration`), mas cada versão aplicada é conferida contra a listagem remota (`list_migrations`) logo em seguida, dentro do mesmo turno de trabalho, para que uma eventual divergência de timestamp seja corrigida imediatamente em vez de se acumular como desta vez.
