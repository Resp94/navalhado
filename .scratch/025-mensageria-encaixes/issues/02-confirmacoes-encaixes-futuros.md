# 02 — Preservação das confirmações de encaixes futuros

**What to build:** Garantir que encaixes futuros continuem recebendo as confirmações atuais para cliente e barbeiro, sem alterar o contrato da UAZAPI nem os mecanismos de entrega já funcionais.

**Blocked by:** 01 — Proteção de confirmações para encaixes passados.

**Status:** ready-for-agent

- [ ] Encaixe futuro envia a confirmação existente aos destinatários previstos.
- [ ] O envio continua passando pelo dispatcher comum e pelo outbox durável.
- [ ] Retry, idempotência, opt-out e observabilidade sanitizada permanecem funcionando.
- [ ] Confirmações de agendamentos normais e os demais fluxos atuais de WhatsApp continuam sem regressão.
- [ ] O isolamento por tenant e a instância correta da UAZAPI são preservados.
- [ ] Testes contrastam encaixe passado e futuro e verificam que somente o caso passado é suprimido.
- [ ] O resultado é comparado ao baseline dos snapshots de mensageria antes da conclusão.

