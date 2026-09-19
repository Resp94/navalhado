# 12: Checkout sem escrita direta em agendamentos

**What to build:** o reagendamento feito pela tela de fechamento de Comanda segue as mesmas regras da Agenda Geral, pelo AgendaRepository. Quando a busca de horários livres falha, o gestor vê um erro em vez de uma grade fixa que pode não existir na barbearia. O cancelamento de Comanda com Agendamento passa pelo repositório de Comandas. A tela de fechamento deixa de chamar o banco direto.

**Blocked by:** 11 (Reagendar por RPC na Agenda Geral), 03 (Totais únicos e desconto percentual registrado)

**Status:** done

- [x] Reagendamento do modal usa o AgendaRepository
- [x] Grade fixa de fallback removida; falha na busca de horários mostra erro
- [x] Cancelamento de Comanda com Agendamento exposto pelo repositório de Comandas e usado pelo modal
- [x] Nenhuma chamada direta ao Supabase no modal de fechamento
- [x] Vitest do novo método do repositório de Comandas
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Adição vinda do ticket 05:** o botão "Cancelar atendimento" do modal de comanda passa a cancelar pelo `AgendaRepository.cancelar` (RPC `cancel_appointment_by_manager`, com guarda de estado e motivo obrigatório), no lugar de `cancel_comanda_appointment`. Decidir onde o modal pede o motivo.

- [x] "Cancelar atendimento" do modal de comanda usa `AgendaRepository.cancelar` e pede o motivo

**Nota da implementação:** o modal de comanda não importa mais o cliente Supabase. A busca de horários livres é `AgendaRepository.listarHorariosLivres` (RPC `get_available_slots`); falha vira mensagem de erro e a grade fixa de 08:00 a 19:30 saiu. O reagendamento é `AgendaRepository.reagendar`. O cancelamento com agendamento é `AgendaRepository.cancelar`, e o de Comanda de balcão, sem agendamento, é `ComandaRepository.cancelComanda`. A prop `appointmentDurationMinutes` saiu do modal, porque o fim agora é calculado no banco.
