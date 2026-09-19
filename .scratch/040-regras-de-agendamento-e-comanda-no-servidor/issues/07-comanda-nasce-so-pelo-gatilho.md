# 07: Comanda nasce só pelo gatilho

**What to build:** todo Agendamento tem exatamente uma Comanda aberta, criada só pelo banco quando o Agendamento nasce. Ela já vem com o Item de Comanda do serviço agendado, pelo preço do catálogo e com o profissional do Agendamento. A Agenda Geral e a Minha Agenda deixam de criar Comanda por conta própria, e iniciar o atendimento nunca gera uma segunda Comanda.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC)

**Status:** ready-for-agent

- [ ] Levantamento em dev e prod de Agendamentos com mais de uma Comanda aberta, com plano para os casos encontrados, antes da restrição
- [ ] Gatilho de criação de Comanda também cria o Item de Comanda do serviço
- [ ] Restrição no banco: no máximo uma Comanda aberta por Agendamento
- [ ] Blocos de criação de Comanda removidos da Agenda Geral e da Minha Agenda
- [ ] Venda de balcão (Comanda sem Agendamento) continua funcionando pelo repositório de Comandas
- [ ] pgTAP: Agendamento novo gera uma Comanda com o item do serviço; segunda Comanda aberta para o mesmo Agendamento recusada
- [ ] `npm run lint`, `npm test` e `npm run build` passam
