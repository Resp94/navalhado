# 02: Migrations da spec 040 em produção

**What to build:** o banco de produção passa a aplicar as regras de agendamento e de Comanda da spec 040 no servidor, sem que o front atual da `main` perceba nada. Depois deste ticket, produção tem o preço do catálogo na liquidação, o destinatário da Gorjeta validado, o desconto percentual registrado, as RPCs de iniciar, cancelar, marcar falta, reagendar e criar Agendamento, a Comanda aberta única por Agendamento e o limite de Encaixe no banco. O front antigo continua finalizando Comanda, porque `settle_comanda_idempotent` aceita a chamada antiga.

**Blocked by:** 01 — Conferências prévias da promoção

**Status:** ready-for-agent

- [ ] As 11 migrations aplicadas pelo MCP do Supabase, com `project_id` de produção explícito, em ordem de nome de arquivo: `040_ticket01`, `ticket02`, `ticket03`, `ticket03b`, `ticket04`, `ticket05`, `ticket06`, `ticket07`, `ticket11`, `ticket08_10`, `ticket09`.
- [ ] Cada migration registrada em produção com o nome do arquivo sem o timestamp.
- [ ] Ao primeiro erro, parar: não aplicar as seguintes e anotar o erro neste ticket.
- [ ] Em produção existem `comandas.discount_type` e `comandas.discount_percent`, os índices `uq_comandas_open_per_appointment` e `uq_appointments_one_fitting_per_slot`, e as RPCs `start_appointment_service`, `cancel_appointment_by_manager`, `mark_appointment_no_show`, `reschedule_appointment_by_manager` e `create_appointment_by_manager`.
- [ ] Os pgTAP da spec 040 passam em produção, rodados dentro de `begin; ... rollback;`.
- [ ] O log do Postgres de produção, olhado depois do lote, não mostra erro novo vindo do front atual (por exemplo, falha em `settle_comanda_idempotent`).
- [ ] A migration `094_fix_daily_financial_summary_guards` NÃO é aplicada.
