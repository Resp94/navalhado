# 05 — Cards Semânticos, Ações Rápidas nos Cards e Modais de Status/Cobrança

**What to build:**
A estilização dos cartões de agendamento com as cores e badges semânticos do AppBarber, botões de ação rápida no card (WhatsApp Direto, Iniciar Atendimento, Cobrar/Pago, Cancelar) e modais de cancelamento (com motivo) e pagamento.

**Blocked by:** 04 — Encaixe Rápido e Agendamento Instantâneo em Slots Livres.

**Status:** ready-for-agent

- [ ] Badges semânticos de borda e fundo por estado do agendamento integrados aos tokens (`--color-success`, `--color-warning`, `--color-brand-primary`, etc.).
- [ ] Ícones contextuais do `@hugeicons/react` no card (`WhatsappIcon`, `CreditCardIcon` / `Money01Icon`, `Note01Icon`, `Clock01Icon`, `UserIcon`, `ScissorsIcon`).
- [ ] Botão de WhatsApp Direto abre `https://wa.me/{phone}` com ícone `WhatsappIcon` e mensagem contextualizada.
- [ ] Botão "Iniciar Atendimento" atualiza o status para `in_progress`.
- [ ] Botão "Cobrar" abre modal de pagamento persistindo na tabela `public.payments` e atualizando para `paid` e `completed`.
- [ ] Botão "Cancelar" com ícone `Cancel01Icon` abre modal de cancelamento com campo de justificativa.
- [ ] Layout e modais com glassmorphism, tipografia `Outfit` e sombras suaves do Navalhado.
