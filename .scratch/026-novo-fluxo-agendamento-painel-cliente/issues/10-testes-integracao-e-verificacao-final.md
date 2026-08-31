# 10 — Testes de Integração e Verificação Final

**What to build:**
Atualização e expansão de todos os testes unitários e de integração em FluxoAgendamento.test.tsx e MenuCliente.test.tsx, validação de build de produção 
pm run build e testes no navegador integrado via viewport mobile ( \times 844\text{ px}$).

**Blocked by:** 01 — Cabeçalho Limpo, Catálogo de Serviços e Bottom Nav, 02 — Modal de Seleção de Dias da Semana, 03 — Modal de Seleção de Barbeiro e Horários, 04 — Modal de Resumo da Comanda e Confirmação de Agendamento, 05 — Modal de Identificação para Acesso a Meus Agendamentos, 06 — Painel do Cliente com Card Destaque Atual e Próximos Horários, 07 — Linha do Tempo de Atendimentos Anteriores, 08 — Fluxo de Reagendamento / Remarcação Direta, 09 — Modal de Cancelamento e Validação de Lead-Time

**Status:** ready-for-agent

- [ ] Rodar suite completa de testes com 
pm test garantindo 100% de sucesso
- [ ] Executar 
pm run build garantindo zero erros de tipagem TypeScript
- [ ] Verificar fluxo completo de agendamento e histórico no navegador em 390x844 px
