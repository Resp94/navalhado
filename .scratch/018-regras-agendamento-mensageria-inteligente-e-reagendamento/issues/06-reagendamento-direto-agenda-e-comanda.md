# 06 — Reagendamento Direto de Horário na Agenda e na Comanda

**What to build:**
A funcionalidade de alteração direta de data e horário de agendamentos no painel do gerente: disponibilizar a ação "Reagendar Horário" no card da agenda (`src/pages/gerente/Agenda.tsx`) e no cabeçalho do checkout da comanda (`src/components/comandas/ComandaCheckoutModal.tsx`), abrindo modal para seleção de nova data e novo horário livre. O salvamento executa `UPDATE public.appointments`, disparando a notificação de reagendamento sem cancelar a comanda vinculada nem criar novos registros duplicados.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento, 02 — Mensageria Inteligente e Link de Primeiro Contato na Edge Function

**Status:** ready-for-agent

- [ ] Adicionar botão e modal de "Reagendar Horário" nos cards de agendamento em `Agenda.tsx`.
- [ ] Adicionar ação de reagendamento no cabeçalho do modal `ComandaCheckoutModal.tsx` para comandas com agendamento associado.
- [ ] Executar atualização de `start_time` e `end_time` no banco e atualizar o estado local da agenda sem perder itens da comanda.
- [ ] Passar `registration_origin: 'agenda'` na criação de novo cliente embutida no modal de novo agendamento.
- [ ] Passar `registration_origin: 'balcao'` no cadastro manual em `Clientes.tsx`.
- [ ] Atualizar testes em `Agenda.test.tsx` e `ComandaCheckoutModal.test.tsx`.
