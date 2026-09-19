# 09: Limite de um encaixe por horário no banco

**What to build:** o banco aceita no máximo um encaixe por profissional e horário entre Agendamentos ativos, mesmo com duas recepções usando a Agenda ao mesmo tempo. O limite vale também quando o profissional é "Tanto faz", conferido sobre o profissional já resolvido.

**Blocked by:** 08 (Criar Agendamento por RPC)

**Status:** ready-for-agent

- [ ] Segundo encaixe ativo no mesmo profissional e horário recusado com código de erro próprio
- [ ] Proteção contra corrida (restrição no banco ou trava por profissional dentro da transação)
- [ ] Checagem feita sobre o profissional resolvido, inclusive com "Tanto faz"
- [ ] Checagem local da tela removida ou reduzida a feedback antecipado, sem ser a fonte da regra
- [ ] pgTAP: segundo encaixe recusado; encaixe liberado depois de cancelar o primeiro; "Tanto faz" coberto
- [ ] `npm run lint`, `npm test` e `npm run build` passam
