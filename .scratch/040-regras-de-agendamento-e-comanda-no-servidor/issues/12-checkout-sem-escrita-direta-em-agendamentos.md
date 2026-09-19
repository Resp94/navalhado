# 12: Checkout sem escrita direta em agendamentos

**What to build:** o reagendamento feito pela tela de fechamento de Comanda segue as mesmas regras da Agenda Geral, pelo AgendaRepository. Quando a busca de horários livres falha, o gestor vê um erro em vez de uma grade fixa que pode não existir na barbearia. O cancelamento de Comanda com Agendamento passa pelo repositório de Comandas. A tela de fechamento deixa de chamar o banco direto.

**Blocked by:** 11 (Reagendar por RPC na Agenda Geral), 03 (Totais únicos e desconto percentual registrado)

**Status:** ready-for-agent

- [ ] Reagendamento do modal usa o AgendaRepository
- [ ] Grade fixa de fallback removida; falha na busca de horários mostra erro
- [ ] Cancelamento de Comanda com Agendamento exposto pelo repositório de Comandas e usado pelo modal
- [ ] Nenhuma chamada direta ao Supabase no modal de fechamento
- [ ] Vitest do novo método do repositório de Comandas
- [ ] `npm run lint`, `npm test` e `npm run build` passam
