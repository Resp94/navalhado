# 05: Janela de promoção

**What to build:** a troca do front e das duas últimas regras de banco acontece de uma vez, fora do horário de atendimento. Aplicam-se as duas migrations que quebram o front atual, faz-se o merge da `dev` na `main` e o push, e espera-se até o site de produção servir o front novo. A janela começa na primeira dessas migrations e só termina com o bundle novo no ar. Durante ela, cancelar pela Agenda e pela tela de Comandas falha no front antigo.

**Blocked by:** 04 — Migrations compatíveis da spec 044 em produção

**Status:** ready-for-agent

- [x] Horário combinado com o usuário antes de começar, fora do atendimento, e a barbearia avisada para não cancelar Agendamentos durante a janela. — usuário confirmou: nenhuma barbearia opera em produção ainda (só tenants de teste), 2026-09-23.
- [x] `044_ticket07` e depois `044_ticket08` aplicadas pelo MCP do Supabase em produção, com o nome do arquivo sem o timestamp. — ambas aplicadas sem erro.
- [x] Se uma das duas falhar, parar sem merge e anotar neste ticket; avisar a barbearia de que o cancelamento com motivo está afetado até a correção. — não se aplicou; nenhuma falhou.
- [x] Merge de `dev` em `main` com `--no-ff`, confirmado com o usuário antes de rodar. — confirmado e feito.
- [x] Push da `main`, confirmado com o usuário antes de rodar. — confirmado e feito.
- [x] O site de produção passa a servir um bundle diferente do anterior, e o conteúdo dele tem o marcador "Horário não confirmado". — bundle mudou de `index-B-0IYVjc.js` para `index-NKXcuz5Z.js`; marcador confirmado presente no novo bundle via fetch.
- [x] Os pgTAP da `044_ticket07` e da `044_ticket08` passam em produção, dentro de `begin; ... rollback;`, rodados enquanto o deploy não termina. — testes `55` (15/15) e `56` (15/15), rodados logo após aplicar as migrations, antes do merge.
- [x] Se o bundle novo não aparecer em 30 minutos, conferir o painel da Cloudflare antes de qualquer outra ação; não fazer push vazio. — não se aplicou; bundle novo apareceu em ~2 minutos após o push.
- [x] Anotados neste ticket: início e fim da janela e o hash do commit de merge na `main`. — início 2026-09-23T11:26:20Z (primeira migration), fim 2026-09-23T11:33:38Z (marcador confirmado no bundle novo). Commit de merge: `af67361` (`903b6e9..af67361` em `main`).

**Resultado 2026-09-23:** janela concluída em ~7 minutos, sem falhas. Conflito de merge em `supabase/tests/database/daily_financial_summary.test.sql` (add/add, `HEAD` esperava `search_path` `public,extensions`, `dev` esperava `search_path` vazio) resolvido mantendo a versão da `dev` — corresponde ao endurecimento de segurança (`set search_path to ''`) usado em toda a promoção.
