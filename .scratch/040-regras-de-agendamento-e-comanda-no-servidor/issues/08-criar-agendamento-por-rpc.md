# 08: Criar Agendamento por RPC

**What to build:** o gestor cria um Agendamento manual na Agenda Geral por uma RPC que valida tudo no banco: expediente e dia aberto, escala do profissional, Bloqueio de Horário e conflito com outro Agendamento ativo, mesmo que a tela não tenha carregado esse outro Agendamento. Horário já passado só é aceito como encaixe. "Tanto faz" é resolvido no banco, a duração segue a Associação Profissional-Serviço, e o Cliente Provisório pode ser criado no mesmo passo. Quando o horário acabou de ser ocupado, o gestor vê uma mensagem clara sem perder o formulário.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC), 07 (Comanda nasce só pelo gatilho)

**Status:** ready-for-agent

- [ ] RPC de criar Agendamento grava `confirmed`, pagamento `pending` e origem `manual`
- [ ] Reaproveita a validação de expediente e escala que o banco já tem
- [ ] Conflito com Agendamento ativo (`pending`, `confirmed`, `in_progress`) recusado, exceto encaixe
- [ ] Bloqueio de Horário recusado
- [ ] Horário passado recusado quando não é encaixe
- [ ] "Tanto faz" resolvido no banco; duração pela Associação Profissional-Serviço do profissional resolvido
- [ ] Cliente Provisório criado na mesma transação quando informado
- [ ] Agenda Geral cria só pelo AgendaRepository, sem escrita direta
- [ ] pgTAP para cada recusa acima e para o acesso (outro tenant, gerente sem tenant, proprietário aceito)
- [ ] Vitest do novo método do AgendaRepository
- [ ] `npm run lint`, `npm test` e `npm run build` passam
