# 07: Agendamento vindo da Lista de Espera fica marcado, no lugar do prefixo na nota

**What to build:** hoje o Agendamento criado pelo encaixe de um clique carrega `[Fila de Espera]` como texto no início da nota. É dado estruturado disfarçado de texto livre: a recepção pode apagá-lo no modal antes de confirmar, nenhuma consulta o enxerga, e ele ocupa a mesma caixa onde mora a observação humana.

Depois deste ticket, o Agendamento criado consumindo uma entrada da Lista de Espera fica marcado no banco. A Agenda mostra isso como um selo no cartão, e a nota carrega apenas o que a recepção escreveu.

**Decisão registrada (2026-09-21):** a marca é uma **coluna booleana própria**, e não um valor novo na coluna de origem. O ticket foi escrito assumindo o contrário, e a decisão mudou o desenho:

- A origem descreve o canal por onde o Agendamento entrou (painel, link público, Canal do Cliente, WhatsApp) e alimenta o relatório "Agendamentos por origem". Vir da fila é um fluxo interno; misturar as duas noções tiraria os encaixes da fila da linha "Painel" do relatório, com uma queda aparente nos números entre períodos, e obrigaria a ampliar a união fechada no TypeScript e o mapa de rótulos.
- Uma chave estrangeira para a entrada foi descartada: o gerente pode apagar a entrada da própria gaveta, e o Agendamento perderia a marca justamente quando mais interessa.
- Com a coluna própria, o relatório de origem **não muda**: nenhuma linha nova, nenhuma descontinuidade.

**Blocked by:** 01 (Observação da Lista de Espera volta a ser gravada e lida) — o 01 introduz o ponto único onde a nota do encaixe é montada, que este ticket simplifica

**Status:** done

- [x] O Agendamento ganha uma coluna própria e booleana de que veio da Lista de Espera, não nula e falsa por padrão; a coluna de origem não é alterada
- [x] A RPC de criação pelo gestor grava a marca quando recebe o identificador da entrada da Lista de Espera, e não a grava quando não recebe; a decisão é tomada no próprio `insert`, dentro da função que já baixa a entrada
- [x] Se a entrada já não estiver aguardando, a recusa desfaz a criação inteira: nenhum Agendamento marcado fica para trás
- [x] Agendamento criado antes deste ticket permanece sem a marca; nenhum backfill, e os que trazem o texto `[Fila de Espera]` na nota, se houver, continuam como estão
- [x] Agendamento vindo da fila que é remarcado mantém a marca
- [x] A nota do Agendamento criado pelo encaixe carrega somente a observação da entrada; sem observação, a nota fica vazia
- [x] O trecho que montava o prefixo deixa de acrescentá-lo e o teste que o afirmava é atualizado
- [x] O cartão do Agendamento na Agenda do gerente exibe um selo "Espera" quando a marca é verdadeira, na grade do dia e na da semana; nenhum selo nos demais
- [x] O cartão na visão de celular, que a Minha Agenda do barbeiro também usa, exibe o mesmo selo
- [x] O selo usa o `Badge` da biblioteca de interface em variante sutil, nunca fundo sólido; cor por token, nenhum hexadecimal novo
- [x] A origem do Agendamento criado pela fila continua `manual`, e o relatório "Agendamentos por origem" não é alterado
- [x] Teste do repositório da Lista de Espera: a nota de encaixe com observação devolve só a observação; sem observação devolve vazio
- [x] Teste do adaptador real: a marca é lida e vem falsa, e não indefinida, quando a coluna não a marca
- [x] Testes de tela: o selo presente e ausente na grade do dia e na da semana da Agenda do gerente, e na visão de celular do barbeiro
- [x] pgTAP: a RPC grava a marca com entrada da fila e não grava sem ela; a entrada é baixada na mesma operação; a recusa de entrada já usada não deixa Agendamento marcado; remarcar mantém a marca; a RPC alterada mantém o isolamento por barbearia, incluindo o gerente com barbearia nula
- [x] Glossário: o verbete da Lista de Espera passa a mencionar que o encaixe marca o Agendamento no banco
- [x] `npm run lint`, `npm test` e `npm run build` passam

**Verificação (2026-09-21):**

- Suíte completa: 109 arquivos, 1176 testes, exit 0. Lint e build saem 0.
- pgTAP `54_agendamento_marcado_da_lista_de_espera`: 18/18 pelo servidor MCP no ambiente de desenvolvimento, dentro de `begin; ... rollback;`, sem sobras no banco. O vermelho foi provado antes da migration (coluna inexistente).
- As permissões de execução da RPC ficaram idênticas às de antes (`anon` sem acesso, `authenticated` com acesso), com `SECURITY DEFINER` e `search_path` preservados. Os 35 Agendamentos existentes ficaram todos sem a marca.
- Mutação: tirar a coluna do `select` do adaptador derruba o teste de leitura.
- Navegador, como gerente, no ambiente de desenvolvimento, pelo fluxo real: entrada na gaveta da fila com observação, "Puxar para a cadeira", e confirmação. O modal trouxe a nota só com a observação, sem o prefixo. O banco gravou a marca verdadeira, a nota só com a observação, a origem `manual` intacta, e a entrada baixada para `scheduled`. O cartão exibiu "ENCAIXE" e "Espera" lado a lado, na grade do dia e na semanal.
- Cuidado com a lição do ticket 06: o encaixe foi feito pela aba "Sem cadastro (balcão)", sem cliente, e conferido no código do gatilho que a fila de WhatsApp só enfileira mensagem quando há cliente. O outbox ficou em 34 e nenhum cliente foi criado. O Agendamento, a comanda, 2 notificações dos gatilhos e a entrada de teste foram apagados, e todas as contagens voltaram ao baseline.

**Desvios e limites:**

- A decisão de desenho (coluna própria em vez de `origin`) reescreveu os critérios de banco e de relatório do ticket original; os de tela e de nota se mantiveram.
- O pgTAP 46, que exercita esta RPC, tinha uma expectativa obsoleta do barbeiro (mensagem de antes da spec 041), como o 42 no ticket 06. Foi ajustada em commit próprio; 23 de 24 asserções passavam e essa era a única falha. Não foi reexecutado depois do ajuste, que só troca a mensagem pela observada.
- O selo usa o `Badge` da biblioteca, enquanto os selos vizinhos (Encaixe, Pago, Não compareceu) seguem como `span` com fundo sólido e hexadecimais, o débito de design system já catalogado.
- **Achado fora do escopo:** na RPC de criação, a validação de telefone de cliente novo usa `'\\D'`, que com strings padrão do Postgres casa uma barra literal seguida de `D`, e não "não-dígito". Ela não remove nada antes de contar o tamanho, então valida de forma mais fraca do que pretende. O corpo foi preservado como estava.
- A migration está aplicada só no ambiente de desenvolvimento.
- O botão do cabeçalho de celular do gerente segue sem painel de cancelados, e a Lista de Espera continua só no gerente; nada disso mudou.
