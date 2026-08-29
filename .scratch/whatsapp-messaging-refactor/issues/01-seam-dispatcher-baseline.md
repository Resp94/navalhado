# 01 — Seam de despacho e baseline de regressão

**What to build:** Um seam único e testável para despacho de mensagens, com provider falso e caracterização dos fluxos de confirmação, reagendamento, cancelamento, lembrete e notificação profissional que já funcionam.

**Blocked by:** None — can start immediately

**Status:** in-progress

- [x] O dispatcher recebe um evento normalizado com tenant, tipo de evento, destinatário, template, variáveis e chave de idempotência.
- [x] O provider falso permite verificar sucesso, erro permanente, erro temporário, timeout e retry sem acessar a UAZAPI real.
- [x] O ledger de idempotência é exercitado em cenários de sucesso, duplicidade, falha e reprocessamento.
- [x] Existem testes de caracterização para confirmação de cliente e profissional, reagendamento, cancelamento, lembrete e regra de inclusão do link.
- [ ] Os testes comprovam que cada evento possui apenas um caminho de despacho.
- [x] A execução do conjunto de testes termina sem regressão nos fluxos existentes.
