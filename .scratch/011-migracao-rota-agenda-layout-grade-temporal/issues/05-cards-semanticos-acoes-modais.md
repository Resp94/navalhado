# 05 — Cards Semânticos, Ações Rápidas nos Cards e Modais de Status/Cobrança

**What to build:**
A estilização dos cartões de agendamento com as cores e badges semânticos do AppBarber, botões de ação rápida no card (WhatsApp Direto, Iniciar Atendimento, Cobrar/Pago, Cancelar) e modais de cancelamento (com motivo) e pagamento.

**Blocked by:** 04 — Encaixe Rápido e Agendamento Instantâneo em Slots Livres.

**Status:** completed

- [x] Badges semânticos de borda e fundo por estado do agendamento integrados aos tokens (`--color-success`, `--color-warning`, `--color-brand-primary`, etc.).
- [x] Ícones contextuais do `@hugeicons/react` no card (`WhatsappIcon`, `CreditCardIcon` / `Money01Icon`, `Note01Icon`, `Clock01Icon`, `UserIcon`, `ScissorsIcon`).
- [x] Botão de WhatsApp Direto abre `https://wa.me/{phone}` com ícone `WhatsappIcon` e mensagem contextualizada.
- [x] Botão "Iniciar Atendimento" atualiza o status para `in_progress`.
- [x] Botão "Cobrar" abre modal de pagamento persistindo na tabela `public.payments` e atualizando para `paid` e `completed`.
- [x] Botão "Cancelar" com ícone `Cancel01Icon` abre modal de cancelamento com campo de justificativa.
- [x] Layout e modais com glassmorphism, tipografia `Outfit` e sombras suaves do Navalhado.
