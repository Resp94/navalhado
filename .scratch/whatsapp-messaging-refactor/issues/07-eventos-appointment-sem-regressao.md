# 07 — Eventos de appointment sem regressão

**What to build:** Confirmações, reagendamentos, cancelamentos, lembretes e notificações profissionais passam pelo dispatcher compartilhado mantendo os eventos, filtros, links, configurações e idempotência observados atualmente.

**Blocked by:** 01 — Seam de despacho e baseline de regressão; 03 — Contrato canônico de templates

**Status:** ready-for-agent

- [ ] Appointment criado confirmado envia a mensagem correta ao cliente e ao profissional quando habilitado.
- [ ] Reagendamento envia as mensagens corretas ao cliente e ao profissional sem ser confundido com criação.
- [ ] Cancelamento envia as mensagens corretas respeitando configurações de cliente e profissional.
- [ ] Lembrete respeita a janela configurada, a flag de envio e a deduplicação existente.
- [ ] O link de autoatendimento permanece correto em mensagens de cliente.
- [ ] Desabilitar uma categoria de envio impede somente essa categoria, sem bloquear as demais.
- [ ] Eventos de tenants diferentes permanecem isolados.
- [ ] A criação, atualização e cancelamento de comanda e as notificações internas não sofrem alteração.
- [ ] Testes de caracterização e integração demonstram que o caminho novo não duplica mensagens.
