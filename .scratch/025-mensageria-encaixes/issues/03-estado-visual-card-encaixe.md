# 03 — Estado visual correto do card de encaixe

**What to build:** Ajustar a decisão de estado visual do card para que o encaixe permaneça identificado como encaixe durante o atendimento e só fique totalmente verde quando o serviço e a comanda estiverem finalizados.

**Blocked by:** None — pode iniciar imediatamente.

**Status:** ready-for-agent

- [ ] O card mantém a identificação de encaixe enquanto o atendimento não foi finalizado.
- [ ] Registrar pagamento, isoladamente, não deixa o card totalmente verde.
- [ ] O card fica totalmente verde somente quando o serviço foi finalizado e a comanda foi encerrada ou liquidada conforme o fluxo vigente.
- [ ] A atualização após a finalização usa o callback ou refresh já existente, sem criar uma rotina concorrente.
- [ ] A decisão de estado cobre, no mínimo, encaixe pendente, confirmado, em atendimento, pago sem finalização e finalizado.
- [ ] Testes verificam que a alteração visual não muda status, valor ou envio de mensagens indevidamente.
- [ ] A aparência funcional atual da agenda é preservada nos casos que não são encaixe.

