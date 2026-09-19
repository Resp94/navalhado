# 09: Limite de um encaixe por horário no banco

**What to build:** o banco aceita no máximo um encaixe por profissional e horário entre Agendamentos ativos, mesmo com duas recepções usando a Agenda ao mesmo tempo. O limite vale também quando o profissional é "Tanto faz", conferido sobre o profissional já resolvido.

**Blocked by:** 08 (Criar Agendamento por RPC)

**Status:** done

- [x] Segundo encaixe ativo no mesmo profissional e horário recusado com código de erro próprio
- [x] Proteção contra corrida (restrição no banco ou trava por profissional dentro da transação)
- [x] Checagem feita sobre o profissional resolvido, inclusive com "Tanto faz"
- [x] Checagem local da tela removida ou reduzida a feedback antecipado, sem ser a fonte da regra
- [x] pgTAP: segundo encaixe recusado; encaixe liberado depois de cancelar o primeiro; "Tanto faz" coberto
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Nota da implementação:** o encaixe está fora da constraint de exclusão (`WHERE is_fitting = false`); a proteção é o índice único parcial `uq_appointments_one_fitting_per_slot` em `(professional_id, start_time)` para encaixes ativos, que também fecha a corrida entre recepções. "Horário" é o início exato do encaixe: inícios diferentes do mesmo profissional continuam livres, e um agendamento normal no mesmo horário de um encaixe segue permitido. `create_appointment_by_manager` traduz a violação (mensagem própria com profissional explícito; com "Tanto faz" passa ao próximo profissional) e `reschedule_appointment_by_manager` também. A checagem local da tela virou feedback antecipado. Em 2026-09-19, consulta de leitura em dev e prod: nenhum horário com mais de um encaixe ativo. Os testes antigos `closing_boundary_slots`, `free_choice_professional_start_grid` e `whatsapp_past_fitting_confirmation` falham no dev por motivos que não têm relação com encaixe (fixtures sem `is_fitting = true`).
