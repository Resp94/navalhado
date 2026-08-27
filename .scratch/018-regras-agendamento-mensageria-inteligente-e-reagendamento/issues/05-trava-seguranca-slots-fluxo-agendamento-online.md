# 05 — Trava de Segurança de Antecedência e Regras de Slots Online

**What to build:**
A aplicação consistente das Regras de Agendamento Online no link público (`/{slug}` / Canal do Cliente): garantir que o "Intervalo entre horários na grade" (`slot_interval_minutes`, ex: 40 min) e a "Antecedência mínima para agendar" (`min_booking_lead_time_minutes`, ex: 30 min) configurados pelo gerente funcionem de ponta a ponta. Horários dentro da janela de antecedência mínima não devem ser exibidos na grade de hoje em `FluxoAgendamento.tsx` e `timezone.ts`. Tentativas de submissão com prazo expirado retornam mensagem amigável via toast, enquanto agendamentos de balcão na Agenda permanecem livres para encaixes.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento

**Status:** ready-for-agent

- [ ] Atualizar `isSlotViableForToday` em `src/lib/timezone.ts` e `src/pages/cliente/FluxoAgendamento.tsx` para filtrar horários inferiores a `horario_atual + min_booking_lead_time_minutes` no fuso do tenant.
- [ ] Ocultar completamente os slots não viáveis na grade de horários do dia de hoje no link público.
- [ ] Capturar código de erro `22023` da RPC `create_appointment_by_token` e exibir toast explicativo caso a antecedência expire durante a navegação.
- [ ] Validar a reatividade de salvamento dos presets de intervalo e antecedência em `src/pages/gerente/Configuracoes.tsx`.
- [ ] Atualizar testes em `FluxoAgendamento.test.tsx` e `Configuracoes.test.tsx`.
