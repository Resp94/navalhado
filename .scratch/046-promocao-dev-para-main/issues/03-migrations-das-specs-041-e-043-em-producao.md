# 03: Migrations das specs 041 e 043 em produção

**What to build:** o banco de produção passa a deixar o Barbeiro operar a própria agenda e ver as próprias comissões (spec 041), e passa a guardar a observação da Lista de Espera, a autoria do cancelamento e a marca de Agendamento vindo da Lista de Espera (spec 043). O front atual da `main` não usa nada disso e segue funcionando igual.

**Blocked by:** 02 — Migrations da spec 040 em produção (a 041 reescreve RPCs que a 040 cria)

**Status:** ready-for-agent

- [ ] As 5 migrations aplicadas pelo MCP do Supabase em produção, em ordem de nome de arquivo: `041_ticket01`, `041_ticket03`, `043_ticket01`, `043_ticket06`, `043_ticket07`.
- [ ] Cada migration registrada em produção com o nome do arquivo sem o timestamp.
- [ ] Ao primeiro erro, parar e anotar neste ticket.
- [ ] Em produção existem `appointments.canceled_by` (com a restrição de valores), `appointments.from_waiting_list` (padrão falso) e `waiting_list.notes`.
- [ ] Os Agendamentos cancelados que já existiam em produção continuam com `canceled_by` nulo, sem erro de restrição.
- [ ] Os pgTAP das specs 041 e 043 passam em produção, dentro de `begin; ... rollback;`.
- [ ] O log do Postgres de produção, olhado depois do lote, não mostra erro novo vindo do front atual (por exemplo, nas RPCs de saldo e extrato de comissão).
