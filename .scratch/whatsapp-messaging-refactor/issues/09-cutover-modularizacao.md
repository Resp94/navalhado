# 09 — Cutover e modularização gradual

**What to build:** A mensageria fica organizada por capacidade atrás de uma fachada compatível, todos os consumidores usam os módulos compartilhados e o código concentrado só é removido depois de uma validação operacional completa.

**Blocked by:** 02 — Primeiro contato resiliente; 03 — Contrato canônico de templates; 04 — Envio manual compatível; 05 — Welcome de balcão durável; 06 — Retorno por ciclo; 07 — Eventos de appointment sem regressão; 08 — Observabilidade e segurança operacional

**Status:** in-progress

- [ ] Webhook, welcome, appointment, lembretes, retorno e administração possuem handlers separados por responsabilidade de negócio.
- [ ] Dispatcher, provider, templates, idempotência, contexto de tenant e observabilidade são módulos compartilhados.
- [x] A fachada atual continua atendendo triggers, cron jobs e callers durante a transição.
- [x] Cada capacidade migrada possui um único caminho de entrega, sem dual-send.
- [x] O cutover pode ser revertido pela versão da Edge Function sem apagar ledger, outbox ou histórico.
- [ ] Todas as rotas e triggers antigas têm seus consumidores identificados antes da remoção.
- [ ] Código legado só é removido depois de testes completos, métricas estáveis e validação operacional.
- [ ] A especificação, o snapshot operacional e a documentação de contratos refletem a arquitetura final.
