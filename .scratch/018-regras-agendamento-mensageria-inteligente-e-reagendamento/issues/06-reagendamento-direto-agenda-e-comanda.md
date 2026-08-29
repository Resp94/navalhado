# 06 — Reagendamento Direto na Agenda e Comanda sem Cancelamento Fantasma

**What to build:**
A experiência de reagendamento direto na Agenda do Gerente (`src/pages/gerente/Agenda.tsx`) e na Comanda (`src/components/comandas/ComandaCheckoutModal.tsx`), assegurando que reagendamentos atualizem data/horário/profissional sem disparar cancelamentos intermediários, e garantindo que cadastros manuais de clientes na Agenda utilizem `registration_origin = 'agenda'` para não disparar mensagens indevidas de boas-vindas do balcão.

**Blocked by:** 01 — Migration 055: Slots Canônicos, Origem de Cadastro, Trava de Antecedência e Reagendamento

**Status:** done

- [x] Garantir `registration_origin: 'agenda'` para clientes cadastrados diretamente pela Agenda.
- [x] Garantir que alterações de data/horário nos agendamentos realizem atualização direta sem cancelamento fantasma nem duplicação de comandas abertas.
- [x] Validar que o checkout de comandas mantenha vínculo consistente com o agendamento mesmo após reagendamentos.
- [x] Atualizar testes de unidade da Agenda.
