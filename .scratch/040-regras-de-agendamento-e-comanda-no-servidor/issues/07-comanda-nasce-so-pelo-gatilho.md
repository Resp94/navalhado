# 07: Comanda nasce só pelo gatilho

**What to build:** todo Agendamento tem exatamente uma Comanda aberta, criada só pelo banco quando o Agendamento nasce. Ela já vem com o Item de Comanda do serviço agendado, pelo preço do catálogo e com o profissional do Agendamento. A Agenda Geral e a Minha Agenda deixam de criar Comanda por conta própria, e iniciar o atendimento nunca gera uma segunda Comanda.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** in-progress (falta o levantamento em prod)

- [ ] Levantamento em dev e prod de Agendamentos com mais de uma Comanda aberta, com plano para os casos encontrados, antes da restrição (dev: nenhuma duplicata; prod: pendente, precisa de autorização para consultar)
- [x] Gatilho de criação de Comanda também cria o Item de Comanda do serviço (já criava desde a migration 024; coberto por teste)
- [x] Restrição no banco: no máximo uma Comanda aberta por Agendamento
- [x] Blocos de criação de Comanda removidos da Agenda Geral e da Minha Agenda
- [x] Venda de balcão (Comanda sem Agendamento) continua funcionando pelo repositório de Comandas
- [x] pgTAP: Agendamento novo gera uma Comanda com o item do serviço; segunda Comanda aberta para o mesmo Agendamento recusada
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Nota da implementação:** `fn_auto_create_comanda_for_appointment` (migration 024) já criava a Comanda aberta e o Item de Comanda do serviço, com preço do catálogo e o profissional do agendamento; a spec estava errada ao dizer que só criava a Comanda. A migration nova só acrescenta o índice único parcial `uq_comandas_open_per_appointment` (uma Comanda `aberta` por `appointment_id`), com uma guarda que interrompe a migration, sem apagar nada, se já houver duplicata. Antes de aplicar em prod, consultar duplicatas lá.
