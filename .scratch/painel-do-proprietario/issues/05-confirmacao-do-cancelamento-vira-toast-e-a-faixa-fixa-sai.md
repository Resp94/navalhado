# 05: A confirmação do cancelamento vira toast e a faixa fixa da cancelada sai

Parte da spec 054 (Painel do Proprietário).

**What to build:** depois que o Gerente cancela a assinatura, ele vê "Assinatura cancelada. Acesso até DD/MM." numa mensagem que some sozinha (toast), e o painel não fica com uma faixa fixa no topo até o fim do período pago. A situação continua à vista em Ajustes > Assinatura ("Cancelada até DD/MM" e "Assinar de novo") e, quando o acesso termina, na tela de bloqueio. As faixas que pedem providência (teste terminando, pagamento recusado, acesso liberado à mão) seguem fixas como hoje.

Hoje, depois de cancelar, a faixa "Assinatura cancelada. Acesso até 03/11." fica no topo de todas as telas do painel até o fim do período pago (visto no site de DEV em 2026-10-03, com captura de tela do usuário). É só no front: o Estado de Acesso devolvido pelo banco (`warning` com o motivo `canceled`) não muda, porque o porteiro, o Canal do Cliente e o WhatsApp dependem dele.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Teste do front (Vitest): com o Estado de Acesso `warning` e o motivo `canceled`, o layout do Gerente não mostra a faixa de aviso
- [ ] Teste do front: com os motivos teste terminando, pagamento recusado e acesso liberado à mão, a faixa continua aparecendo como hoje
- [ ] Teste do front: ao cancelar, aparece um toast com "Assinatura cancelada. Acesso até DD/MM." (só "Assinatura cancelada." quando não há data) que some sozinho pela duração padrão dos toasts, com timers falsos; o teste que hoje exige a faixa depois do cancelamento passa a exigir o toast
- [ ] A mensagem passageira "Assinatura cancelada." no lugar do botão, enquanto a assinatura é relida, continua, e o botão não volta a ser clicável nessa janela
- [ ] Nenhuma migration: o Estado de Acesso da cancelada segue o mesmo no banco
- [ ] No site de DEV, a barbearia MP Teste (cancelada, com acesso até 03/11) deixa de mostrar a faixa em todas as telas do painel; Ajustes > Assinatura segue mostrando "Cancelada até DD/MM" e "Assinar de novo". O toast só se vê cancelando uma assinatura viva (novo checkout, que o usuário digita), então a prova dele fica nos testes
- [ ] `rtk proxy npx oxlint src supabase/functions`, Vitest completo (rodando sozinho) e `npm run build` passam
