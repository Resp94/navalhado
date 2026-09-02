# 03 — Disponibilidade correta no link público

**What to build:** O cliente deve receber somente horários realmente disponíveis para o serviço, profissional e data escolhidos, sem visualizar opções inviáveis por duração ou fechamento no link público.

**Blocked by:** 01 — Regra compartilhada de duração e limite de fechamento.

**Status:** ready-for-agent

- [ ] Aplicar a regra ao fluxo público por slug depois da escolha do serviço, profissional e data.
- [ ] Calcular a duração específica do profissional quando configurada e habilitada; usar a duração base do serviço como fallback.
- [ ] Não disponibilizar horário cujo término ultrapasse o fechamento da barbearia ou do profissional.
- [ ] Permitir término exatamente no fechamento quando todas as demais regras forem satisfeitas.
- [ ] Não exibir no catálogo público horários passados, bloqueados, ocupados, em intervalo ou fora da antecedência mínima.
- [ ] Quando o cliente escolher “qualquer profissional”, manter o horário somente se houver profissional ativo e serviço elegível para atendê-lo.
- [ ] Manter a grade ancorada na escala do profissional e reiniciada no retorno do intervalo, sem fixar uma cadência específica.
- [ ] Aplicar a mesma regra ao gerenciamento de agendamentos por sessão/token e ao reagendamento público, sem reintroduzir cadastro provisório ou alterar o fluxo de sessão.
- [ ] Revalidar a duração e o fechamento no servidor durante a confirmação pública, impedindo chamadas antigas ou manipuladas.
- [ ] Preservar timezone do tenant, isolamento por tenant e contrato de segurança das RPCs públicas.
- [ ] Renderizar somente horários disponíveis na interface, mantendo compatibilidade com o contrato atual de horários indisponíveis quando necessário.
- [ ] Não alterar Turnstile, autenticação anônima, logout, gerenciamento de sessão, mensagens ou confirmação WhatsApp.
- [ ] Cobrir o fluxo com testes de serviço curto, serviço longo, profissional específico, qualquer profissional, reagendamento e concorrência.

