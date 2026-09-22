# 09: Exclusão de Bloqueio de Horário chega pelo tempo real

**What to build:** a Agenda acompanha mudanças de Bloqueio de Horário em tempo real, filtrando os eventos pela barbearia. Criar e alterar chegam. Excluir não chega: na exclusão, o evento carrega apenas a chave primária da linha, então o filtro por barbearia nunca casa e o evento é descartado antes de chegar à tela.

Quem exclui na própria tela não percebe, porque a tela recarrega por conta própria. Quem está com a Agenda aberta em outro aparelho continua vendo um Bloqueio que já não existe, até trocar de dia. Numa recepção com dois aparelhos, isso é um horário que parece indisponível e não está.

Depois deste ticket, a exclusão chega como a criação chega.

**Onde foi achado:** verificação do ticket 08 da spec 043. Conferido no banco: a tabela usa a identidade de réplica padrão e está publicada para o tempo real.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Excluir um Bloqueio de Horário faz a Agenda de outra sessão aberta tirá-lo da grade, sem troca de dia e sem recarregar a página
- [ ] O evento de exclusão não vaza entre barbearias: uma sessão de outra barbearia não recarrega nem recebe dado da exclusão alheia
- [ ] Criar e alterar Bloqueio continuam chegando como hoje
- [ ] A Minha Agenda do barbeiro se comporta como a Agenda Geral nesse ponto
- [ ] O evento de exclusão não dispara leitura de Agendamentos, e o de Agendamentos não dispara leitura de Bloqueios
- [ ] A abordagem é do agente que pegar o ticket. Duas saídas plausíveis: ampliar o que a tabela publica na exclusão, ao custo de mais volume de registro no banco; ou tirar o filtro por barbearia dessa inscrição e recortar na tela, ao custo de acordar sessões de outras barbearias. Registre no ticket qual foi escolhida e por quê
- [ ] Se a escolha ampliar o que a tabela publica, a mudança vai em migration e o efeito no volume é registrado
- [ ] Verificado no navegador com duas sessões abertas na mesma barbearia
- [ ] Vale conferir, e registrar, se a inscrição de Agendamentos tem o mesmo furo na exclusão
- [ ] `npm run lint`, `npm test` e `npm run build` passam
