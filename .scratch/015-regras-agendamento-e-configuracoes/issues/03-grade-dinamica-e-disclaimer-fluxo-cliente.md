# 03 — Grade Dinâmica e Disclaimer de Política no Fluxo do Cliente (/cliente/:token/agendar)

**What to build:** Exibição da grade de horários do cliente com base no intervalo dinâmico da barbearia (ex: 20 min), ocultando horários fora do prazo de antecedência mínima, com exibição de disclaimer informativo de política no modal de confirmação.

**Blocked by:** 01 — Motor de Banco de Dados, RPCs de Agendamento Dinâmico e Aplicação via MCP

**Status:** done

- [x] Consumir slots da RPC `get_available_slots_by_token` respeitando o passo de intervalo dinâmico configurado.
- [x] Validar que horários inferiores ao `min_booking_lead_time_minutes` não aparecem na listagem do dia atual.
- [x] Adicionar card/badge de aviso de política de agendamento e cancelamento dentro do modal de confirmação em `src/pages/cliente/FluxoAgendamento.tsx`.
- [x] Exibir mensagem amigável caso a validação de antecedência falhe na confirmação.
