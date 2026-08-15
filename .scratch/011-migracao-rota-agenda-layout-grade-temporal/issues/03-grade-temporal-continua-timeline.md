# 03 — Grade Temporal Contínua e Linha do Tempo em Tempo Real

**What to build:**
A grade visual multirrecurso (`resourceDay`) com régua vertical de horários contínuos baseada nos horários de funcionamento (`business_hours`), colunas individuais por profissional, blocos de agendamento com altura proporcional à duração e Linha Vermelha de tempo real indicando o minuto exato do dia.

**Blocked by:** 01 — Migração de Schema no Supabase e Infraestrutura de Roteamento Canônico.

**Status:** ready-for-agent

- [ ] Régua horária contínua no eixo vertical (ex: 08:00 às 20:00) renderizada com marcações de slots.
- [ ] Colunas individuais lado a lado por profissional ativo com avatar e nome no cabeçalho da coluna.
- [ ] Agendamentos posicionados de forma proporcional ao horário de início e com altura correspondente à duração do serviço.
- [ ] Linha Vermelha ("Red Line") que se desloca dinamicamente a cada minuto no horário do dia atual.
- [ ] Responsividade horizontal fluida para acomodar múltiplos profissionais com rolagem suave.
