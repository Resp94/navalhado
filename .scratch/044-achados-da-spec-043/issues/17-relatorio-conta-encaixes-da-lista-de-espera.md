# 17: Relatório conta os encaixes vindos da Lista de Espera

**What to build:** o ticket 07 da spec 043 foi escrito prometendo uma linha "Lista de Espera" no relatório "Agendamentos por origem". A decisão tomada na implementação foi outra, e melhor para o relatório de origem: a marca virou coluna própria, e a origem continua descrevendo o canal de entrada. O efeito colateral é que hoje não existe lugar nenhum onde o gerente veja quantos Agendamentos a Lista de Espera produziu. A marca está gravada e ninguém a lê fora do cartão da Agenda.

Depois deste ticket, o relatório de agenda mostra quantos Agendamentos do período vieram da Lista de Espera, sem mexer na quebra por origem.

**Onde foi achado:** decisão do ticket 07 da spec 043, que substituiu a linha prometida no relatório de origem por uma coluna própria e não levou a medida para lugar nenhum.

**Blocked by:** 16 (Relatório de motivos separa quem cancelou) — os dois alteram a mesma função do relatório de agenda, e fazê-los em paralelo faria uma migration sobrescrever a outra

**Status:** ready-for-agent

- [ ] Decidido em 2026-09-22: o relatório devolve dois números, quantos Agendamentos do período vieram da Lista de Espera, cancelados inclusive, e desses quantos foram concluídos, pela mesma classificação de desfecho que o relatório já usa para comparecimento
- [ ] A quebra "Agendamentos por origem" não muda: nenhuma linha nova e nenhum número diferente dos de hoje
- [ ] A medida segue o filtro de profissional do relatório
- [ ] Agendamento anterior à marca, sem ela, não é contado; nenhum backfill
- [ ] O tipo de retorno do relatório no módulo de relatórios acompanha a mudança, e a tela exibe a medida junto dos demais indicadores de agenda
- [ ] Período sem nenhum Agendamento vindo da Lista de Espera mostra zero, não vazio
- [ ] pgTAP cobrindo os dois números, incluindo Agendamento vindo da Lista de Espera cancelado, concluído e sem desfecho, o filtro de profissional, a quebra por origem inalterada e o isolamento por barbearia
- [ ] Teste do adaptador do módulo de relatórios e teste de tela da medida
- [ ] `npm run lint`, `npm test` e `npm run build` passam
