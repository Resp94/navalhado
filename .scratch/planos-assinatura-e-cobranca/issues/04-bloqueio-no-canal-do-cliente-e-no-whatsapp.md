# 04: Bloqueio no Canal do Cliente e no WhatsApp

Parte da spec 052 (Planos, assinatura e cobrança recorrente).

**What to build:** quando a barbearia está bloqueada, os clientes dela não conseguem agendar pelo Canal do Cliente e nenhuma mensagem de WhatsApp da barbearia sai.

- **Canal do Cliente:**
  - A sessão do cliente e as funções de agendamento do cliente consultam o Estado de Acesso no servidor.
  - Com a barbearia bloqueada, o cliente vê "agendamento online indisponível" e não cria nem reagenda.
  - Cancelar continua permitido, para o cliente liberar o horário.
- **WhatsApp:**
  - Todo envio do tenant consulta o Estado de Acesso e não envia se estiver bloqueado. Vale para Evento de Agendamento, lembrete, lembrete de retorno e boas-vindas.
  - O envio que não saiu é descartado, com o motivo registrado, e não fica numa fila para depois.
  - A sessão da Instância WhatsApp não é tocada. Quando a barbearia volta, os envios voltam sem ler QR code.

**Blocked by:** 03 (Período de teste, Estado de Acesso e bloqueio do painel)

**Status:** ready-for-agent

- [ ] pgTAP: com a barbearia bloqueada, criar e reagendar pelo Canal do Cliente são recusados e cancelar é aceito; com a barbearia liberada, tudo segue como hoje
- [ ] pgTAP ou teste Deno: com a barbearia bloqueada, os envios de Evento de Agendamento, lembrete, lembrete de retorno e boas-vindas não chegam ao provedor e ficam registrados como descartados por bloqueio; liberada, saem como hoje. No teste, o tenant não tem instância conectada ao provedor real (nada sai de verdade pelo WhatsApp)
- [ ] Teste do Canal do Cliente no front: barbearia bloqueada mostra "agendamento online indisponível"
- [ ] Os testes atuais do Canal do Cliente e do WhatsApp continuam passando
- [ ] `npm run lint`, `npm test` e `npm run build` passam
