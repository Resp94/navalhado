# 05 — Trava de Segurança de Antecedência e Regras de Slots Online

**What to build:**
A aplicação estrita da trava de segurança de antecedência mínima (`min_booking_lead_time_minutes`) no fluxo público de autoatendimento (`src/pages/cliente/FluxoAgendamento.tsx` e `src/lib/timezone.ts`): ocultar slots do dia corrente que violem a antecedência configurada pelo gerente e exibir mensagem amigável ao cliente caso um horário expire durante a navegação antes da confirmação.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento

**Status:** done

- [x] Atualizar `isSlotViableForToday` em `src/lib/timezone.ts` garantindo consistência no cálculo de antecedência mínima (`min_booking_lead_time_minutes`).
- [x] Aplicar a filtragem em `src/pages/cliente/FluxoAgendamento.tsx` para que horários dentro da janela de antecedência não sejam visíveis no dia de hoje.
- [x] Tratar erros de antecedência mínima (`22023`) retornados pela RPC `create_appointment_by_token` com alerta explicativo.
- [x] Atualizar testes de unidade em `FluxoAgendamento.test.tsx` e `Configuracoes.test.tsx`.
