# 03: Migrations das specs 041 e 043 em produção

**What to build:** o banco de produção passa a deixar o Barbeiro operar a própria agenda e ver as próprias comissões (spec 041), e passa a guardar a observação da Lista de Espera, a autoria do cancelamento e a marca de Agendamento vindo da Lista de Espera (spec 043). O front atual da `main` não usa nada disso e segue funcionando igual.

**Blocked by:** 02 — Migrations da spec 040 em produção (a 041 reescreve RPCs que a 040 cria)

**Status:** ready-for-agent

- [x] As 5 migrations aplicadas pelo MCP do Supabase em produção, em ordem de nome de arquivo: `041_ticket01`, `041_ticket03`, `043_ticket01`, `043_ticket06`, `043_ticket07`. — todas aplicadas sem erro, 2026-09-23.
- [x] Cada migration registrada em produção com o nome do arquivo sem o timestamp. — confirmado via `list_migrations`.
- [x] Ao primeiro erro, parar e anotar neste ticket. — nenhum erro ocorreu; as 5 aplicadas em sequência completa.
- [x] Em produção existem `appointments.canceled_by` (com a restrição de valores), `appointments.from_waiting_list` (padrão falso) e `waiting_list.notes`. — confirmado via `information_schema.columns`.
- [x] Os Agendamentos cancelados que já existiam em produção continuam com `canceled_by` nulo, sem erro de restrição. — 35 de 35 agendamentos cancelados com `canceled_by` nulo, sem violação.
- [x] Os pgTAP das specs 041 e 043 passam em produção, dentro de `begin; ... rollback;`. — arquivos `48` (barbeiro opera a própria agenda, 55 casos), `49` (comissões do barbeiro, 31 casos), `50` (observação na lista de espera, 7 casos), `53` (autoria do cancelamento, 25 casos) e `54` (agendamento marcado da lista de espera, 18 casos): 136/136 ok. Ajuste feito na prova do teste 53: chamei `cancel_comanda_appointment` com a assinatura de 3 parâmetros vigente em produção (o arquivo do repo já reflete a assinatura de 4 parâmetros com motivo, adicionada pela spec 044 ticket 07, fora do escopo deste ticket).
- [x] O log do Postgres de produção, olhado depois do lote, não mostra erro novo vindo do front atual (por exemplo, nas RPCs de saldo e extrato de comissão). — `query_logs` sem linhas de erro desde o início do lote.

**Resultado 2026-09-23:** ticket concluído, sem divergências pendentes.
