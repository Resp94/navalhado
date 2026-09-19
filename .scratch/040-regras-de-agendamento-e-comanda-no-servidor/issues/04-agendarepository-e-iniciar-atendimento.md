# 04: AgendaRepository e iniciar atendimento por RPC

**What to build:** o gestor, pela Agenda Geral, e o barbeiro, pela Minha Agenda, iniciam o atendimento de um Agendamento por uma RPC que confere o estado de origem no banco. Só Agendamento `pending` ou `confirmed` pode ir para `in_progress`, e o barbeiro só inicia Agendamento dele. As duas telas passam a usar um novo AgendaRepository, que será a porta de todas as operações de Agendamento do gestor e do barbeiro. Este ticket é o prefactor da frente de agenda.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] RPC de iniciar atendimento com checagem de papel, tenant (incluindo recusa do gerente com `tenant_id` nulo) e estado de origem; proprietário aceito
- [x] Barbeiro recusado em Agendamento de outro profissional
- [x] AgendaRepository com adaptador Supabase e adaptador em memória, traduzindo os códigos de erro da RPC em mensagens de domínio
- [x] Agenda Geral e Minha Agenda iniciam atendimento só pelo AgendaRepository, sem escrita direta na tabela de agendamentos
- [x] Evento de Agendamento e notificações continuam saindo como hoje
- [x] pgTAP: cada estado de origem proibido (`in_progress`, `completed`, `canceled`, `no_show`) recusado; acesso de outro tenant e gerente sem tenant recusados
- [x] Vitest do AgendaRepository contra o adaptador em memória
- [x] ADR registrando a decisão de levar o ciclo de vida do Agendamento do gestor para RPC
- [x] AgendaRepository incluído no glossário (`CONTEXT.md`)
- [x] `npm run lint`, `npm test` e `npm run build` passam
