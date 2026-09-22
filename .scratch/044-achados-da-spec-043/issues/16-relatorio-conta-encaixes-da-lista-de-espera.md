# 16: Relatório conta os encaixes vindos da Lista de Espera

**What to build:** o ticket 07 da spec 043 foi escrito prometendo uma linha "Lista de Espera" no relatório "Agendamentos por origem". A decisão tomada na implementação foi outra, e melhor para o relatório de origem: a marca virou coluna própria, e a origem continua descrevendo o canal de entrada. O efeito colateral é que hoje não existe lugar nenhum onde o gerente veja quantos Agendamentos a Lista de Espera produziu. A marca está gravada e ninguém a lê fora do cartão da Agenda.

Depois deste ticket, o relatório de agenda mostra quantos Agendamentos do período vieram da Lista de Espera, sem mexer na quebra por origem.

**Onde foi achado:** decisão do ticket 07 da spec 043, que substituiu a linha prometida no relatório de origem por uma coluna própria e não levou a medida para lugar nenhum.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] O relatório de agenda devolve quantos Agendamentos do período vieram da Lista de Espera
- [ ] A quebra "Agendamentos por origem" não muda: nenhuma linha nova e nenhum número diferente dos de hoje
- [ ] A medida segue o filtro de profissional do relatório
- [ ] Fica decidido e registrado se a medida conta todos os Agendamentos vindos da fila ou só os que não foram cancelados; a tela diz qual das duas é
- [ ] Agendamento anterior à marca, sem ela, não é contado; nenhum backfill
- [ ] O tipo de retorno do relatório no módulo de relatórios acompanha a mudança, e a tela exibe a medida junto dos demais indicadores de agenda
- [ ] Período sem nenhum Agendamento vindo da fila mostra zero, não vazio
- [ ] pgTAP cobrindo a contagem, o filtro de profissional, a quebra por origem inalterada e o isolamento por barbearia
- [ ] Teste do adaptador do módulo de relatórios e teste de tela da medida
- [ ] `npm run lint`, `npm test` e `npm run build` passam
