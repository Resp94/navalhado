# 07: Origem "Lista de Espera" no lugar do prefixo na nota

**What to build:** hoje o Agendamento criado pelo encaixe de um clique carrega `[Fila de Espera]` como texto no início da nota. É dado estruturado disfarçado de texto livre: a recepção pode apagá-lo no modal antes de confirmar, nenhuma consulta o enxerga, e ele ocupa a mesma caixa onde mora a observação humana. Enquanto isso, o banco fixa a origem do Agendamento como `manual` para todo encaixe criado pelo gerente, inclusive os que vieram da fila, de modo que o relatório "Agendamentos por origem" os conta como "Painel".

Depois deste ticket, a origem do Agendamento passa a registrar que ele veio da Lista de Espera. A Agenda mostra isso como um selo no cartão, a nota carrega apenas o que a recepção escreveu, e o relatório de origem ganha a linha "Lista de Espera".

**Decisão a confirmar antes de iniciar:** este ticket assume reaproveitar a coluna de origem que já existe no Agendamento, acrescentando um valor novo ao seu domínio fechado, sugerido como `waiting_list` para acompanhar o estilo dos valores atuais. A ressalva é que a origem hoje descreve o canal por onde o Agendamento entrou (painel, link público, Canal do Cliente, WhatsApp), e "veio da Lista de Espera" é de natureza um pouco diferente: descreve um fluxo interno. A alternativa é uma coluna própria, mais limpa e mais cara. Se a decisão for por coluna própria, os critérios de banco e de relatório mudam; os de tela e de nota não.

**Blocked by:** 01 (Observação da Lista de Espera volta a ser gravada e lida) — o 01 introduz o ponto único onde a nota do encaixe é montada, que este ticket simplifica

**Status:** needs-decision

- [ ] O domínio fechado da origem do Agendamento aceita o valor novo
- [ ] A RPC de criação de Agendamento pelo gestor grava a origem nova quando recebe o identificador da entrada da Lista de Espera, e continua gravando `manual` quando não recebe; a decisão é tomada dentro da transação que já baixa a entrada
- [ ] Agendamento criado antes deste ticket permanece com a origem que tem; nenhum backfill, e os que trazem o prefixo `[Fila de Espera]` na nota continuam como estão
- [ ] Agendamento vindo da fila que depois é reagendado mantém a origem
- [ ] A nota do Agendamento criado pelo encaixe carrega somente a observação da entrada; sem observação, a nota fica vazia e não mais com o marcador
- [ ] O trecho do código que hoje monta o prefixo deixa de acrescentá-lo e o teste que o afirma é atualizado
- [ ] O cartão do Agendamento na Agenda do gerente exibe um selo "Lista de Espera" quando a origem é a nova; nenhum selo nos demais
- [ ] O cartão na Minha Agenda do barbeiro exibe o mesmo selo, já que o contrato de leitura das duas telas carrega a origem
- [ ] O selo usa a variante sutil da biblioteca de interface, nunca fundo sólido; cor por token, nenhum hexadecimal novo
- [ ] O tipo de origem usado pelo módulo de relatórios passa a incluir o valor novo, e o rótulo "Lista de Espera" aparece em "Agendamentos por origem" em vez da string crua
- [ ] O relatório de agenda devolve uma linha própria para a origem nova sem alteração no seu SQL, porque a agregação é por valor de origem; isto é provado por teste, não assumido
- [ ] Teste do rótulo de origem cobrindo o valor novo
- [ ] Teste do repositório da Lista de Espera: a nota de encaixe com observação devolve só a observação; sem observação devolve vazio
- [ ] pgTAP: a RPC do gestor com entrada da Lista de Espera grava a origem nova; sem entrada grava `manual`; o domínio fechado recusa valor fora da lista
- [ ] pgTAP: o relatório de agenda devolve a origem nova em `by_origin` quando existe Agendamento com ela
- [ ] pgTAP: a RPC alterada mantém o isolamento por barbearia, incluindo a asserção do gestor com identificador de barbearia nulo, conforme a regra de guarda de acesso do projeto
- [ ] Glossário: o verbete da Lista de Espera passa a mencionar que o encaixe registra a origem no Agendamento
- [ ] `npm run lint`, `npm test` e `npm run build` passam

**Consequência a registrar, não a evitar:** a partir deste ticket os encaixes vindos da fila deixam de ser contados como "Painel" no relatório de origem. Períodos anteriores não são reescritos, então a comparação entre um período que atravessa a data de entrega e um anterior mostra uma queda aparente em "Painel". Isso é a descontinuidade esperada de uma origem que passou a ser medida, não um defeito.
