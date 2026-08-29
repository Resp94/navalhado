# 07 — Eventos de appointment sem regressão

**What to build:** Confirmações, reagendamentos, cancelamentos, lembretes e notificações profissionais passam pelo dispatcher compartilhado mantendo os eventos, filtros, links, configurações e idempotência observados atualmente.

**Blocked by:** 01 — Seam de despacho e baseline de regressão; 03 — Contrato canônico de templates

**Status:** in-progress

- [x] Appointment criado confirmado envia a mensagem correta ao cliente e ao profissional quando habilitado.
- [x] Reagendamento envia as mensagens corretas ao cliente e ao profissional sem ser confundido com criação.
- [x] Cancelamento envia as mensagens corretas respeitando configurações de cliente e profissional.
- [x] Lembrete respeita a janela configurada, a flag de envio e a deduplicação existente.
- [x] O link de autoatendimento permanece correto em mensagens de cliente.
- [x] Desabilitar uma categoria de envio impede somente essa categoria, sem bloquear as demais.
- [x] Eventos de tenants diferentes permanecem isolados.
- [x] A criação, atualização e cancelamento de comanda e as notificações internas não sofrem alteração.
- [x] Testes de caracterização e integração demonstram que o caminho novo não duplica mensagens.
