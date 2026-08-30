# 01 — Proteção de confirmações para encaixes passados

**What to build:** Impedir que a confirmação de um encaixe realizado em data ou horário passado seja enviada ao cliente ou ao barbeiro, preservando o registro operacional do encaixe e o fluxo normal de agendamento.

**Blocked by:** None — pode iniciar imediatamente.

**Status:** ready-for-agent

- [ ] O encaixe passado continua sendo registrado e consultável na agenda, histórico e comanda.
- [ ] A proteção ocorre tanto no gatilho de banco quanto na invocação direta da Edge Function, antes do dispatcher e do provedor.
- [ ] A confirmação é suprimida para cliente e barbeiro sem afetar encaixes futuros.
- [ ] A comparação de data e horário usa o fuso configurado no tenant.
- [ ] A supressão possui motivo observável sem registrar telefone completo, token, segredo ou conteúdo sensível.
- [ ] Reentrega, retry e idempotência não criam mensagens para o encaixe passado nem duplicam eventos.
- [ ] Testes cobrem os caminhos de gatilho, outbox e handler direto.
- [ ] O comportamento existente registrado nos snapshots de mensageria é usado como baseline; qualquer regressão é corrigida antes da conclusão.

