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

**Status:** done

- [x] A leitura de Bloqueios de Horário na Agenda do gerente acontece uma vez por atualização, não duas; medido na rede, uma única consulta à tabela de Bloqueios por leitura
- [x] Os quatro pontos que hoje atualizam os Bloqueios continuam funcionando: carga inicial e troca de dia ou de visão, evento em tempo real de Bloqueios, remoção de um Bloqueio, e a atualização pedida pelo modal de criação
- [x] O evento em tempo real de Agendamentos não passa a recarregar Bloqueios sem necessidade, e o de Bloqueios não passa a recarregar Agendamentos sem necessidade
- [x] Falha na leitura de Bloqueios não esconde os Agendamentos: a grade abre com os Agendamentos e o erro de Bloqueios é sinalizado como era antes do ticket 03
- [x] Falha na leitura de Agendamentos continua exibindo o aviso de erro já existente, sem apagar Bloqueios já carregados
- [x] A Minha Agenda do barbeiro continua carregando Agendamentos e Bloqueios sem regressão
- [x] Nenhuma verificação de papel é acrescentada na aplicação; o recorte de acesso segue vindo do banco
- [x] Teste no repositório e no adaptador cobrindo a falha isolada de cada uma das duas leituras (a falha de Bloqueios não impede Agendamentos, e a de Agendamentos não impede Bloqueios)
- [x] Teste de tela da Agenda do gerente cobrindo que os Bloqueios continuam aparecendo e que a falha de Bloqueios não esconde os Agendamentos
- [x] Verificado no navegador como gerente, contando as consultas de rede por leitura antes e depois, e com um dia que tenha Bloqueio de Horário
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Decisão registrada (2026-09-21):** contrato dividido. A leitura de Agendamentos (`carregarAgendamentosDoDia`, que mudou de nome e deixou de devolver Bloqueios) e a de Bloqueios (`carregarBloqueiosDoDia`, nova) são operações independentes no repositório e no adaptador. A escolha pela divisão, e não pelo contrato combinado com falha parcial, veio de duas razões: o isolamento de falha sai do próprio desenho, sem uma segunda forma de resultado ("um dos dois falhou") para todo chamador tratar, e a duplicação some sem a página depender de um carregamento que devolve mais do que ela pediu. A página do gerente continua com as duas chamadas em pontos separados; a Minha Agenda do barbeiro faz as duas em paralelo com `Promise.allSettled` e trata cada resultado à parte.

**Verificação (2026-09-21):**

- Suíte completa: 109 arquivos, 1191 testes, exit 0. Lint (`oxlint`) e build saem 0. `tsc -b` sem erros.
- Testes novos: repositório (leitura de Bloqueios, validação, falha isolada nos dois sentidos), adaptador real (a leitura de Agendamentos não toca a tabela de Bloqueios; a de Bloqueios toca só ela, uma vez; falha isolada por tabela; recorte por barbearia, dia e ordem), página do gerente (uma consulta a `blocked_slots` por atualização; falha de Bloqueios não esconde Agendamentos nem acusa erro de agendamento; falha de Agendamentos mantém Bloqueios) e Minha Agenda do barbeiro (Bloqueio aparece; falha isolada nos dois sentidos).
- Mutação: fazer o adaptador de Agendamentos consultar Bloqueios de novo derruba o teste de contagem da página e os do adaptador; trocar `Promise.allSettled` por `Promise.all` na Minha Agenda derruba os testes do barbeiro.
- Navegador, como gerente, no ambiente de desenvolvimento, com um Bloqueio de Horário no dia (inserido para o teste e apagado depois). Consultas à tabela de Bloqueios por leitura, contadas pela rede em cada troca de dia: **antes, 2 (código do `dev` guardado em stash); depois, 1**. As de Agendamentos ficaram em 2 por leitura (ativos e cancelados, como já era). O Bloqueio apareceu na visão do dia e na da semana, antes e depois. A semana também fez uma única consulta a Bloqueios.
- Tempo real no navegador: inserir um Bloqueio pelo banco disparou 1 consulta a Bloqueios e 0 a Agendamentos, e o Bloqueio novo apareceu na grade. O sentido inverso (evento de Agendamentos não recarrega Bloqueios) segue garantido pelo código, onde cada evento chama só a própria leitura; não foi medido na rede. Banco de volta ao estado inicial: 0 Bloqueios, 35 Agendamentos.

**Limites:**

- Não foi provado no navegador que a remoção de Bloqueio pela grade e a atualização pedida pelo modal de criação continuam recarregando, e a falha de leitura também não foi provada ali (só nos testes de tela). O código dessas duas rotas não mudou, e a remoção tem teste de tela que passa.
- O evento de exclusão de Bloqueio não chega pelo tempo real: a tabela usa a identidade de réplica padrão e o filtro por `tenant_id` não casa em `DELETE`. É anterior a este ticket. Quem exclui na própria tela recarrega por conta própria; outra pessoa com a agenda aberta só vê a exclusão ao trocar de dia.
- A Minha Agenda do barbeiro mostra o botão "Remover" no Bloqueio; o comportamento não foi tocado aqui e não foi investigado se o barbeiro tem permissão de excluir.
- A falha de Bloqueios na página do gerente segue sinalizada só no console, como era antes do ticket 03. Quem ler a grade não vê aviso.

