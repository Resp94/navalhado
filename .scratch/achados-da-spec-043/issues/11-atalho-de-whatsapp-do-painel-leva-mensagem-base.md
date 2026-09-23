# 11: Atalho de WhatsApp do Painel de Cancelados leva mensagem-base

**What to build:** o Painel de Cancelados do Dia tem um atalho para falar com o cliente no WhatsApp, pensado para tentar reocupar o horário. Ele abre a conversa vazia. Todo o resto do sistema que abre o WhatsApp leva um texto pronto.

Quem usa o atalho tem que escrever do zero, na pressa da recepção, justamente a mensagem mais repetitiva do dia.

Depois deste ticket, o atalho abre a conversa com uma mensagem-base que a recepção edita antes de enviar.

**Onde foi achado:** limite registrado no ticket 05 da spec 043.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O atalho abre a conversa do WhatsApp com uma mensagem-base preenchida
- [ ] A mensagem cita o horário que vagou e o nome da barbearia, e não afirma nada que o sistema não saiba
- [ ] A mensagem não é enviada pelo sistema; ela chega como rascunho para a recepção revisar e enviar
- [ ] O texto segue o vocabulário do glossário do projeto e o tom das demais mensagens ao cliente
- [ ] O atalho continua indisponível quando o Agendamento cancelado não tem Cliente ou telefone
- [ ] O atalho continua abrindo em nova aba sem dar à página aberta acesso à janela de origem
- [ ] Vale para o painel do gerente e para o do barbeiro, se o do barbeiro tiver o atalho
- [ ] Teste de tela conferindo que o destino do atalho leva o telefone e o texto
- [ ] `npm run lint`, `npm test` e `npm run build` passam
