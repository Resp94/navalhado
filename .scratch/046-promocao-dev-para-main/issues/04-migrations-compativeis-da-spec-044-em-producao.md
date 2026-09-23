# 04: Migrations compatíveis da spec 044 em produção

**What to build:** o banco de produção recebe as quatro migrations da spec 044 que não mexem no cancelamento: a validação de telefone na criação de Agendamento, a exclusão de Bloqueio de Horário chegando pelo tempo real, e as duas mudanças no relatório de Agenda (motivos separados por autoria e contagem de Encaixes vindos da Lista de Espera). Com este ticket, só faltam para a janela as duas migrations que quebram o front atual.

**Blocked by:** 03 — Migrations das specs 041 e 043 em produção (a `044_ticket06` reescreve a RPC que a `043_ticket07` deixou, e o relatório depende de `canceled_by`)

**Status:** ready-for-agent

- [x] As 4 migrations aplicadas pelo MCP do Supabase em produção, nesta ordem: `044_ticket06`, `044_ticket09`, `044_ticket16`, `044_ticket17`. — todas aplicadas sem erro, 2026-09-23.
- [x] `044_ticket07` e `044_ticket08` NÃO são aplicadas neste ticket. — confirmado, ausentes de `list_migrations`.
- [x] Cada migration registrada em produção com o nome do arquivo sem o timestamp. — confirmado.
- [x] Ao primeiro erro, parar e anotar neste ticket. — nenhum erro ocorreu; as 4 aplicadas em sequência completa.
- [x] Em produção, `blocked_slots` está com identidade de réplica completa. — confirmado via pgTAP (teste 57) e `pg_class.relreplident = 'f'`.
- [x] O relatório de Agenda em produção responde para os dois tenants sem erro (chamada de leitura pelo MCP). — `private.get_schedule_report_core` chamado para "Barbearia Brooklyn" (`236fb323-e311-402c-8a07-185c324dc50b`) e "Barber Tester" (`974d9ed1-eba6-4a1b-806f-a4e9a8f7cd3f`), ambos devolvendo `status_totals`.
- [x] Os pgTAP destas quatro migrations passam em produção, dentro de `begin; ... rollback;`. — teste `57` (identidade de réplica, 4/4), teste `35` (relatório de Agenda completo, incluindo tickets 16 e 17, 52/52) e teste `46` (validação de telefone do ticket 06, 31/31, agora 100% — a mensagem de barbeiro que divergia no ticket 03 já bate, pois a spec 041 está aplicada).
- [x] O log do Postgres de produção, olhado depois do lote, não mostra erro novo vindo do front atual. — `query_logs` sem linhas de erro desde o início do lote.

**Resultado 2026-09-23:** ticket concluído, sem divergências pendentes. Só faltam para a janela de promoção as duas migrations que quebram o front atual (`044_ticket07` e `044_ticket08`, ticket 05).
