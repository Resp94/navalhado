# 05: Gerente vê o Painel de Cancelados do Dia

**What to build:** o gerente abre o mesmo painel a partir da Agenda e vê os cancelamentos de toda a barbearia no dia selecionado, não só de um profissional. É o que permite responder por que a casa teve cadeira vazia: se as faltas concentram num profissional, num serviço ou num horário, e se vale acionar a Lista de Espera para reocupar o slot.

Reusa o painel criado no ticket 04 sem ramificação por papel: a única diferença é o conjunto de dados passado. O gerente omite o profissional na chamada e recebe a barbearia inteira, porque a política de leitura da tabela já concede isso ao papel dele.

**Blocked by:** 03 (Agenda do gerente lê Agendamento pelo repositório), 04 (Barbeiro vê o Painel de Cancelados do Dia)

**Status:** ready-for-agent

- [ ] A Agenda do gerente abre o mesmo painel do ticket 04, sem componente novo e sem ramificação por papel dentro dele
- [ ] A chamada omite o profissional e devolve os cancelados de toda a barbearia no dia
- [ ] O painel respeita o filtro de profissionais já aplicado na tela, de modo a concordar com o que a grade mostra
- [ ] Cancelamento de profissional filtrado fora da grade continua existindo nos dados: limpar o filtro o revela sem recarregar a página
- [ ] Controle no cabeçalho com contador de cancelamentos do dia
- [ ] Atalho para falar com o cliente no WhatsApp a partir de uma entrada cancelada, para tentar reocupar o horário
- [ ] A lista acompanha a troca do dia selecionado
- [ ] Agendamento cancelado continua ausente da grade de horários
- [ ] O filtro de profissionais é tratado como recorte de leitura, nunca como controle de acesso
- [ ] Nenhuma verificação de permissão é acrescentada no painel; o recorte chega aplicado pelo banco
- [ ] Teste de tela da Agenda do gerente: abertura do painel, entradas de mais de um profissional na mesma lista, e respeito ao filtro de profissionais
- [ ] pgTAP: gerente lendo Agendamento cancelado alcança os de todos os profissionais da própria barbearia, e nenhum papel alcança cancelado de outra barbearia
- [ ] `npm run lint`, `npm test` e `npm run build` passam
