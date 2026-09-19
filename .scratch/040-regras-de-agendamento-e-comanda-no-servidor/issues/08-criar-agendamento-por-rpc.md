# 08: Criar Agendamento por RPC

**What to build:** o gestor cria um Agendamento manual na Agenda Geral por uma RPC que valida tudo no banco: expediente e dia aberto, escala do profissional, Bloqueio de Horário e conflito com outro Agendamento ativo, mesmo que a tela não tenha carregado esse outro Agendamento. Horário já passado só é aceito como encaixe. "Tanto faz" é resolvido no banco, a duração segue a Associação Profissional-Serviço, e o Cliente Provisório pode ser criado no mesmo passo. Quando o horário acabou de ser ocupado, o gestor vê uma mensagem clara sem perder o formulário.

**Blocked by:** 04 (AgendaRepository e iniciar atendimento por RPC), 07 (Comanda nasce só pelo gatilho)

**Status:** done

- [x] RPC de criar Agendamento grava `confirmed`, pagamento `pending` e origem `manual`
- [x] Reaproveita a validação de expediente e escala que o banco já tem
- [x] Conflito com Agendamento ativo (`pending`, `confirmed`, `in_progress`) recusado, exceto encaixe
- [x] Bloqueio de Horário recusado
- [x] Horário passado recusado quando não é encaixe
- [x] "Tanto faz" resolvido no banco; duração pela Associação Profissional-Serviço do profissional resolvido
- [x] Cliente Provisório criado na mesma transação quando informado
- [x] Agenda Geral cria só pelo AgendaRepository, sem escrita direta
- [x] pgTAP para cada recusa acima e para o acesso (outro tenant, gerente sem tenant, proprietário aceito)
- [x] Vitest do novo método do AgendaRepository
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Nota da implementação:** `create_appointment_by_manager` reaproveita o gatilho `validate_appointment_schedule_boundaries` (expediente, escala, intervalo) e a constraint de exclusão (conflito). "Tanto faz" é resolvido tentando cada profissional ativo, em ordem de nome, e deixando o próprio banco recusar conflito ou escala. O Cliente novo é criado na mesma transação (`registration_origin = 'agenda'`, `cadastro_completo = true`, como o cadastro rápido fazia). Ficaram na tela só as regras de grade do encaixe e o limite local de 1 encaixe por horário, que o ticket 09 leva para o banco. O helper de acesso virou `private.assert_tenant_access`, usado também pelas RPCs de transição.
