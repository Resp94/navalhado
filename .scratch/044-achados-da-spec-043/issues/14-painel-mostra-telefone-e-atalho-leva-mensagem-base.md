# 14: Painel de Cancelados mostra o telefone e o atalho de WhatsApp leva mensagem-base

**What to build:** o Painel de Cancelados do Dia tem um atalho para falar com o cliente no WhatsApp, pensado para tentar reocupar o horário. Ele abre a conversa vazia. Todo o resto do sistema que abre o WhatsApp leva um texto pronto.

Quem usa o atalho tem que escrever do zero, na pressa da recepção, justamente a mensagem mais repetitiva do dia.

Além disso, a história 3 da spec 043 pedia que cada entrada mostrasse o nome e o telefone do cliente, para contatá-lo sem procurar em outra tela. O painel entregue mostra o nome e o botão de WhatsApp, mas não o telefone. Quem vai ligar, ou quem está num aparelho sem WhatsApp, não tem o número.

Depois deste ticket, a entrada mostra o telefone, e o atalho abre a conversa com uma mensagem-base que a recepção edita antes de enviar.

**Onde foi achado:** limite registrado no ticket 05 da spec 043 (mensagem), e história 3 da spec 043 não atendida pelo painel entregue (telefone), apontada na auditoria de cobertura da spec 044.

**Blocked by:** 03 (Tipo do cliente do Agendamento aceita nulo) — o telefone e o atalho precisam tratar o Agendamento sem Cliente, e o 03 faz a verificação de tipos apontar onde

**Status:** ready-for-agent

- [ ] Cada entrada do painel mostra o telefone do cliente
- [ ] Agendamento cancelado sem Cliente, ou com Cliente sem telefone, mostra a ausência de forma limpa, sem rótulo vazio
- [ ] O atalho abre a conversa do WhatsApp com uma mensagem-base preenchida
- [ ] A mensagem cita o horário que vagou e o nome da barbearia, e não afirma nada que o sistema não saiba
- [ ] A mensagem não é enviada pelo sistema; ela chega como rascunho para a recepção revisar e enviar
- [ ] O texto segue o vocabulário do glossário do projeto e o tom das demais mensagens ao cliente
- [ ] O atalho continua indisponível quando o Agendamento cancelado não tem Cliente ou telefone
- [ ] O atalho continua abrindo em nova aba sem dar à página aberta acesso à janela de origem
- [ ] Vale para o painel do gerente e para o do barbeiro, se o do barbeiro tiver o atalho
- [ ] Teste de tela conferindo que o destino do atalho leva o telefone e o texto
- [ ] `npm run lint`, `npm test` e `npm run build` passam
