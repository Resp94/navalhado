# 08: Agenda do gerente lê os Bloqueios de Horário junto dos Agendamentos

**What to build:** dívida deixada pelo ticket 03. Ele levou a leitura de Agendamento da Agenda do gerente para o repositório do módulo de agenda, e o ticket mandava não tocar nos Bloqueios de Horário. Só que o carregamento da agenda do dia devolve Agendamentos **e** Bloqueios, e a página continua tendo a própria consulta de Bloqueios. Duas consequências, ambas medidas na Agenda do gerente depois do ticket 03:

- **Consulta duplicada.** Cada leitura faz duas consultas à tabela de Bloqueios de Horário, e o resultado de uma delas é descartado.
- **Falha acoplada.** Se a consulta de Bloqueios feita dentro do carregamento falhar, o carregamento inteiro falha e os Agendamentos também deixam de aparecer. Antes do ticket 03 a falha era isolada: a grade abria e só o registro de erro no console indicava o problema. É rara, mas é uma piora de comportamento que o ticket 03 prometia não haver.

Depois deste ticket, a Agenda do gerente lê Agendamentos e Bloqueios de Horário por um único caminho, sem consulta descartada, e uma falha na leitura de um dos dois não esconde o outro.

O ticket não prescreve a abordagem, porque ela depende de como o ticket 04 deixar o contrato de leitura. Duas saídas plausíveis:

- **Contrato dividido:** carregar Agendamentos e carregar Bloqueios viram duas operações independentes. Restaura o isolamento de falha e elimina a duplicação, mas a Minha Agenda do barbeiro, que usa o carregamento combinado, também precisa ser revista.
- **Contrato combinado com falha parcial:** a página passa a usar os Bloqueios que o carregamento já devolve e abandona a própria consulta. Elimina a duplicação, mas a falha acoplada só se resolve se o carregamento aceitar devolver um dos dois quando o outro falha.

A escolha entre as duas é do agente que pegar o ticket, desde que os critérios abaixo se sustentem.

**Blocked by:** 04 (Barbeiro vê o Painel de Cancelados do Dia) — o 04 também altera o contrato de carregamento da agenda do dia, acrescentando o sinalizador de cancelados e a coleção própria; fazer este antes exigiria refazer o ajuste depois

**Status:** ready-for-agent

- [ ] A leitura de Bloqueios de Horário na Agenda do gerente acontece uma vez por atualização, não duas; medido na rede, uma única consulta à tabela de Bloqueios por leitura
- [ ] Os quatro pontos que hoje atualizam os Bloqueios continuam funcionando: carga inicial e troca de dia ou de visão, evento em tempo real de Bloqueios, remoção de um Bloqueio, e a atualização pedida pelo modal de criação
- [ ] O evento em tempo real de Agendamentos não passa a recarregar Bloqueios sem necessidade, e o de Bloqueios não passa a recarregar Agendamentos sem necessidade
- [ ] Falha na leitura de Bloqueios não esconde os Agendamentos: a grade abre com os Agendamentos e o erro de Bloqueios é sinalizado como era antes do ticket 03
- [ ] Falha na leitura de Agendamentos continua exibindo o aviso de erro já existente, sem apagar Bloqueios já carregados
- [ ] A Minha Agenda do barbeiro continua carregando Agendamentos e Bloqueios sem regressão
- [ ] Nenhuma verificação de papel é acrescentada na aplicação; o recorte de acesso segue vindo do banco
- [ ] Teste no repositório e no adaptador cobrindo a falha isolada de cada uma das duas leituras
- [ ] Teste de tela da Agenda do gerente cobrindo que os Bloqueios continuam aparecendo e que a falha de Bloqueios não esconde os Agendamentos
- [ ] Verificado no navegador como gerente, contando as consultas de rede por leitura antes e depois, e com um dia que tenha Bloqueio de Horário
- [ ] `npm run lint`, `npm test` e `npm run build` passam
