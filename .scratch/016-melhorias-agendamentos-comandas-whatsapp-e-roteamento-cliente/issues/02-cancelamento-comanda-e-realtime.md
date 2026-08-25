# 02 — Cancelamento Automático de Comandas e Atualização em Tempo Real (Sem Refresh)

**What to build:** 
Criar a migration 046 que implementa uma trigger no PostgreSQL (`trg_auto_cancel_comanda_on_appointment_cancel`) para cancelar automaticamente qualquer comanda aberta vinculada a um agendamento quando o status deste for alterado para `canceled`. Habilitar as tabelas `public.appointments` e `public.comanda_itens` na publicação `supabase_realtime` do Supabase. No frontend (Agenda e Comandas), implementar a atualização de estado otimista imediata no React para que qualquer cancelamento remova o card e libere o horário instantaneamente na tela sem a necessidade de recarregar o navegador.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Criar a migration `20260825120000_046_auto_cancel_comanda_and_realtime_appointments.sql` contendo a trigger `fn_auto_cancel_comanda_on_appointment_cancel` e a inclusão das tabelas na publicação `supabase_realtime`.
- [ ] Aplicar e validar a migração exclusivamente no banco Dev (`selvxobcjbkligxighlp`) usando o MCP Supabase.
- [ ] Implementar atualização de estado otimista em `Agenda.tsx` e `Comandas.tsx` para remoção imediata do card ao confirmar cancelamento.
- [ ] Validar a sincronização em tempo real via canais do Supabase sem exigir refresh de página.
