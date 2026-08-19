# 02 — Reelaboração da Tela de Configurações do Gerente (/configuracoes)

**What to build:** Uma interface moderna e limpa no painel do gerente dividida em 3 cards temáticos, permitindo configurar dados cadastrais com busca por CEP (ViaCEP), regras de intervalo e antecedência com botões rápidos (*chips*), e horário de funcionamento geral semanal.

**Blocked by:** 01 — Motor de Banco de Dados, RPCs de Agendamento Dinâmico e Aplicação via MCP

**Status:** ready-for-agent

- [ ] Reestruturar `src/pages/gerente/Configuracoes.tsx` em 3 cards temáticos: Perfil & Contato, Regras de Agendamento Online e Horário de Funcionamento Geral.
- [ ] Implementar busca e autopreenchimento de endereço por CEP utilizando a API ViaCEP.
- [ ] Adicionar seletores em botões rápidos (*chips*) e inputs manuais para `slot_interval_minutes` (15 a 60 min), `min_booking_lead_time_minutes` (0 a 120 min) e `min_cancellation_lead_time_minutes` (0 a 1440 min).
- [ ] Implementar grade semanal de horários de funcionamento com switches de ativar/desativar e inputs de abertura/fechamento.
- [ ] Atualizar `TenantContextType` em `src/components/GerenteLayout.tsx` para expor os novos campos.
- [ ] Adicionar feedback visual via Toast e animações GSAP na montagem dos cards.
