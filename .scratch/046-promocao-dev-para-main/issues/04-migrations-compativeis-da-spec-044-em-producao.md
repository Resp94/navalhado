# 04: Migrations compatíveis da spec 044 em produção

**What to build:** o banco de produção recebe as quatro migrations da spec 044 que não mexem no cancelamento: a validação de telefone na criação de Agendamento, a exclusão de Bloqueio de Horário chegando pelo tempo real, e as duas mudanças no relatório de Agenda (motivos separados por autoria e contagem de Encaixes vindos da Lista de Espera). Com este ticket, só faltam para a janela as duas migrations que quebram o front atual.

**Blocked by:** 03 — Migrations das specs 041 e 043 em produção (a `044_ticket06` reescreve a RPC que a `043_ticket07` deixou, e o relatório depende de `canceled_by`)

**Status:** ready-for-agent

- [ ] As 4 migrations aplicadas pelo MCP do Supabase em produção, nesta ordem: `044_ticket06`, `044_ticket09`, `044_ticket16`, `044_ticket17`.
- [ ] `044_ticket07` e `044_ticket08` NÃO são aplicadas neste ticket.
- [ ] Cada migration registrada em produção com o nome do arquivo sem o timestamp.
- [ ] Ao primeiro erro, parar e anotar neste ticket.
- [ ] Em produção, `blocked_slots` está com identidade de réplica completa.
- [ ] O relatório de Agenda em produção responde para os dois tenants sem erro (chamada de leitura pelo MCP).
- [ ] Os pgTAP destas quatro migrations passam em produção, dentro de `begin; ... rollback;`.
- [ ] O log do Postgres de produção, olhado depois do lote, não mostra erro novo vindo do front atual.
