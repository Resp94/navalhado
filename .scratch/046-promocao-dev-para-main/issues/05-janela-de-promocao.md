# 05: Janela de promoção

**What to build:** a troca do front e das duas últimas regras de banco acontece de uma vez, fora do horário de atendimento. Aplicam-se as duas migrations que quebram o front atual, faz-se o merge da `dev` na `main` e o push, e espera-se até o site de produção servir o front novo. A janela começa na primeira dessas migrations e só termina com o bundle novo no ar. Durante ela, cancelar pela Agenda e pela tela de Comandas falha no front antigo.

**Blocked by:** 04 — Migrations compatíveis da spec 044 em produção

**Status:** ready-for-agent

- [ ] Horário combinado com o usuário antes de começar, fora do atendimento, e a barbearia avisada para não cancelar Agendamentos durante a janela.
- [ ] `044_ticket07` e depois `044_ticket08` aplicadas pelo MCP do Supabase em produção, com o nome do arquivo sem o timestamp.
- [ ] Se uma das duas falhar, parar sem merge e anotar neste ticket; avisar a barbearia de que o cancelamento com motivo está afetado até a correção.
- [ ] Merge de `dev` em `main` com `--no-ff`, confirmado com o usuário antes de rodar.
- [ ] Push da `main`, confirmado com o usuário antes de rodar.
- [ ] O site de produção passa a servir um bundle diferente do anterior, e o conteúdo dele tem o marcador "Horário não confirmado".
- [ ] Os pgTAP da `044_ticket07` e da `044_ticket08` passam em produção, dentro de `begin; ... rollback;`, rodados enquanto o deploy não termina.
- [ ] Se o bundle novo não aparecer em 30 minutos, conferir o painel da Cloudflare antes de qualquer outra ação; não fazer push vazio.
- [ ] Anotados neste ticket: início e fim da janela e o hash do commit de merge na `main`.
