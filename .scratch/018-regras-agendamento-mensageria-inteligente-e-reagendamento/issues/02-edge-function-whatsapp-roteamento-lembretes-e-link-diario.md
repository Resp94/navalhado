# 02 — Mensageria Inteligente e Link de Primeiro Contato na Edge Function

**What to build:**
O mecanismo centralizado de formatação de mensagens na Edge Function `whatsapp-integration`, garantindo que a primeira comunicação do dia enviada ao cliente contenha o link de autoatendimento (anexado ao final se o template não contiver `{link}`) e preservando o template legítimo do evento (confirmação, lembrete, reagendamento) sem substituir por mensagens de boas-vindas. Assegurar que comunicações subsequentes no mesmo dia enviem o template limpo caso não usem `{link}`, e atualizar atomicamente `customers.last_first_contact_at`.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento

**Status:** ready-for-agent

- [ ] Implementar helper `resolveCustomerMessageWithDailyLink` para interpolar `{link}` ou anexar o link de autoatendimento na 1ª mensagem do dia.
- [ ] Implementar `isFirstMessageOfDayForCustomer` com base no timezone do tenant e timestamp `customers.last_first_contact_at`.
- [ ] Integrar helper nas rotas `/send-notification` (eventos `appointment_created`, `appointment_rescheduled`, `appointment_cancelled`).
- [ ] Atualizar `customers.last_first_contact_at = now()` após envio bem-sucedido de mensagem na 1ª comunicação do dia.
- [ ] Garantir que o evento `customer_welcome_balcao` seja processado exclusivamente para cadastros manuais do balcão.
