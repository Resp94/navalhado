# 08 — Fluxo de Reagendamento / Remarcação Direta

**What to build:**
Integração do clique no botão Remarcar do card ativo: validação de antecedência de 2h $\rightarrow$ abertura direta do Modal 03 com serviço e barbeiro pré-selecionados $\rightarrow$ seleção de novo dia e horário $\rightarrow$ chamada a eagendarAgendamentoPublicoSessao $\rightarrow$ retorno atualizado a /cliente/menu.

**Blocked by:** 03 — Modal de Seleção de Barbeiro e Horários, 06 — Painel do Cliente com Card Destaque Atual e Próximos Horários

**Status:** ready-for-agent

- [ ] Ao clicar em Remarcar, verificar lead-time de antecedência mínima
- [ ] Navegar para a rota de agendamento preservando serviceId, professionalId e escheduleAppointmentId
- [ ] Abrir diretamente o Modal 03 com o serviço e profissional pré-carregados
- [ ] Executar remarcação via eagendarAgendamentoPublicoSessao e retornar a /cliente/menu com toast de sucesso
