# 04 — Governança de Cadastros (Soft Delete de Serviços e Profissionais)

**What to build:** Diferenciar claramente os três estados de serviços e profissionais no sistema (Ativo para agendamento normal, Inativo para pausa com visibilidade administrativa e Excluído via soft delete com `deleted_at`), adicionando ação de exclusão com confirmação e ocultando excluídos de novas operações enquanto preserva 100% dos dados e relatórios históricos.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Criar e aplicar migration adicionando coluna `deleted_at TIMESTAMPTZ DEFAULT NULL` nas tabelas `public.services` e `public.professionals`, com índices parciais onde `deleted_at IS NULL`.
- [ ] Atualizar RPCs de agendamento (`get_available_slots`, `get_customer_appointments_by_token`) e consultas do frontend para filtrar `AND deleted_at IS NULL`.
- [ ] Manter o switch de status Ativo/Inativo (`is_active`) na gestão para serviços e profissionais pausados que podem ser reativados.
- [ ] Adicionar botão de exclusão (lixeira) com modal de confirmação claro em `Servicos.tsx` e `Profissionais.tsx`, gravando `deleted_at = now()` e `is_active = false`.
- [ ] Garantir que registros históricos antigos (agendamentos passados, comandas, relatórios de comissão) permaneçam íntegros e legíveis com o nome original do serviço/profissional excluído.
- [ ] Atualizar testes unitários em `Servicos.test.tsx` e `Profissionais.test.tsx`.
