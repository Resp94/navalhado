# 01: Horários livres só para quem é da barbearia

**What to build:** a consulta de horários livres do painel passa a exigir que quem pergunta seja da barbearia perguntada. Hoje ela roda com privilégio elevado e não confere papel nem barbearia: qualquer usuário autenticado — incluindo o barbeiro de outra barbearia e a sessão de um cliente do Canal do Cliente — consegue ler a disponibilidade de qualquer barbearia do SaaS informando o identificador dela. Depois da mudança, gestor e barbeiro continuam vendo os horários da própria barbearia, o proprietário continua vendo os de qualquer uma, e o Canal do Cliente segue pela consulta por token, que não muda.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A consulta de horários livres do painel confere papel e barbearia do usuário autenticado, no mesmo padrão das demais RPCs de Agendamento
- [ ] Gestor e barbeiro da barbearia recebem os horários; gestor ou barbeiro de outra barbearia é recusado com `42501`
- [ ] Gestor com barbearia nula e usuário desativado recusados; proprietário aceito em qualquer barbearia
- [ ] Sessão de cliente do Canal do Cliente recusada nessa consulta; a consulta por token continua funcionando sem mudança
- [ ] A grade de horários devolvida é a mesma de hoje para quem tem acesso: nenhuma mudança de regra de disponibilidade
- [ ] Agenda Geral, Minha Agenda e o fluxo de agendamento do cliente seguem funcionando
- [ ] pgTAP novo, com duas barbearias, cobre cada aceite e cada recusa acima
- [ ] Migration aplicada só no DEV; `get_advisors` sem alerta novo
- [ ] `npm run lint`, `npm test` e `npm run build` passam
