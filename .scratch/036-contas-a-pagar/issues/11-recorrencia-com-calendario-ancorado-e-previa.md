# 11: Recorrência com calendário ancorado e prévia

**What to build:** o gestor cadastra o aluguel uma vez só. Ele lança uma despesa recorrente
semanal, quinzenal, mensal ou anual, informa quantas ocorrências gerar, confere na tela as datas e
os valores de cada uma e só então confirma — para não gerar sessenta contas erradas. Cada
ocorrência gerada é uma Conta a Pagar comum, com Baixa, estorno, edição e cancelamento próprios.

Uma recorrência mensal no dia 31 vence no último dia dos meses mais curtos e volta ao dia 31 nos
meses seguintes, porque cada vencimento é calculado a partir da data âncora, nunca da ocorrência
anterior — senão o vencimento iria encolhendo mês a mês. A quinzenal usa catorze dias, e não
quinze, para manter o dia da semana.

**As ocorrências são materializadas na criação**, sem motor de regra e sem processo agendado: uma
regra avaliada em tempo de leitura faria a lista, o alerta e o fluxo de caixa da 037
reinterpretarem a regra cada um. **O calendário é calculado num único lugar no servidor**, e a
prévia usa esse mesmo cálculo; replicar aritmética de datas no navegador reabriria, em outro
domínio, o defeito da prévia da gaveta corrigido no ticket 02.

**Chave estrangeira de Série.** As colunas de Série e de posição na Série já existem na Conta a
Pagar desde o ticket 06, sem chave estrangeira. Este ticket cria a tabela de Série e só então
acrescenta a **chave estrangeira** dessas colunas.

Spec: `specs/036-contas-a-pagar/spec.md`, seção "Entrega 3 — Série: Parcelamento e Recorrência".

**Blocked by:** 06 — Lançar Conta a Pagar avulsa e vê-la na lista paginada.

**Status:** ready-for-agent

- [ ] Tabela de Série com tipo (Parcelamento ou Recorrência), periodicidade, data âncora
      (vencimento da primeira ocorrência), valor informado na criação, autor e momento.
- [ ] Chave estrangeira acrescentada às colunas de Série da Conta a Pagar criadas no ticket 06, com
      índice; a posição é única dentro da Série.
- [ ] Calendário único no servidor: a ocorrência de posição *i* vence na âncora deslocada *i*
      períodos — semanal sete dias; quinzenal catorze dias; mensal e anual no mesmo dia da âncora
      no mês-alvo, limitado ao último dia desse mês (histórias 22 e 23).
- [ ] Contrato de leitura de prévia devolve datas e valores das ocorrências usando o mesmo cálculo
      da criação (história 24).
- [ ] RPC de criação de Recorrência gera de 1 a 60 ocorrências, todas com o mesmo valor, cada uma
      com o próprio vencimento como competência, com autor e momento (história 38).
- [ ] Categoria de Despesa ativa obrigatória e Fornecedor ativo opcional, como na conta avulsa.
- [ ] Acesso da tabela de Série no mesmo padrão das tabelas de Conta a Pagar e Baixa; profissional
      não lê (história 39).
- [ ] O contrato de detalhe passa a devolver o resumo da Série da conta (história 35).
- [ ] A lista mostra a posição na Série e continua rápida com o volume de ocorrências geradas
      (história 37).
- [ ] Formulário ganha a variante explícita de Recorrência sobre a mesma casca, escolhida pelo
      controle segmentado; a prévia de ocorrências pertence só à variante de Série.
- [ ] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [ ] âncora em 31 de janeiro passando por fevereiro e voltando a 31;
  - [ ] âncora em 29 de fevereiro vencendo em 28 de fevereiro em ano não bissexto;
  - [ ] quinzenal mantendo o dia da semana;
  - [ ] a prévia da Série igual às ocorrências efetivamente criadas;
  - [ ] quantidade fora de 1 a 60 recusada;
  - [ ] profissional não lê Séries nem executa a criação; gerente de outro tenant não lê nem
        escreve.
- [ ] Testes de repositório e de adaptador do módulo cobrem prévia e criação de Recorrência.
- [ ] Teste da aba cobre a alternância de variantes do formulário e a prévia.
- [ ] Glossário do projeto atualizado com Série e Recorrência.
- [ ] `npm run test` e `npm run test:db` verdes.
