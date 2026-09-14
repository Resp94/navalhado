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

**Status:** done

- [x] Tabela de Série com tipo (Parcelamento ou Recorrência), periodicidade, data âncora
      (vencimento da primeira ocorrência), valor informado na criação, autor e momento.
- [x] Chave estrangeira acrescentada às colunas de Série da Conta a Pagar criadas no ticket 06, com
      índice; a posição é única dentro da Série.
- [x] Calendário único no servidor: a ocorrência de posição *i* vence na âncora deslocada *i*
      períodos — semanal sete dias; quinzenal catorze dias; mensal e anual no mesmo dia da âncora
      no mês-alvo, limitado ao último dia desse mês (histórias 22 e 23).
- [x] Contrato de leitura de prévia devolve datas e valores das ocorrências usando o mesmo cálculo
      da criação (história 24).
- [x] RPC de criação de Recorrência gera de 1 a 60 ocorrências, todas com o mesmo valor, cada uma
      com o próprio vencimento como competência, com autor e momento (história 38).
- [x] Categoria de Despesa ativa obrigatória e Fornecedor ativo opcional, como na conta avulsa.
- [x] Acesso da tabela de Série no mesmo padrão das tabelas de Conta a Pagar e Baixa; profissional
      não lê (história 39).
- [x] O contrato de detalhe passa a devolver o resumo da Série da conta (história 35).
- [x] A lista mostra a posição na Série e continua rápida com o volume de ocorrências geradas
      (história 37).
- [x] Formulário ganha a variante explícita de Recorrência sobre a mesma casca, escolhida pelo
      controle segmentado; a prévia de ocorrências pertence só à variante de Série.
- [x] Casos na suíte pgTAP `29_contas_a_pagar`:
  - [x] âncora em 31 de janeiro passando por fevereiro e voltando a 31;
  - [x] âncora em 29 de fevereiro vencendo em 28 de fevereiro em ano não bissexto;
  - [x] quinzenal mantendo o dia da semana;
  - [x] a prévia da Série igual às ocorrências efetivamente criadas;
  - [x] quantidade fora de 1 a 60 recusada;
  - [x] profissional não lê Séries nem executa a criação; gerente de outro tenant não lê nem
        escreve.
- [x] Testes de repositório e de adaptador do módulo cobrem prévia e criação de Recorrência.
- [x] Teste da aba cobre a alternância de variantes do formulário e a prévia.
- [x] Glossário do projeto atualizado com Série e Recorrência.
- [x] `npm run test` e `npm run test:db` verdes.

## Notas de implementação

- Migration `supabase/migrations/20260914120000_recorrencia_com_calendario_ancorado_e_previa.sql`
  aplicada em cinco partes no DEV via MCP `apply_migration` (tabela `payable_series`, calendário
  `private.compute_series_due_date`, `preview_payable_series`, `create_recurring_payable_series`,
  e um DROP+CREATE de `get_payable` para acrescentar o resumo da Série ao retorno — a única parte
  desta spec que exigiu trocar assinatura em vez de só `CREATE OR REPLACE`, porque adicionar
  colunas ao `RETURNS TABLE` muda o tipo de retorno).
- `payable_series` é tabela mínima (tipo, periodicidade, âncora, valor, autor, momento) — descrição,
  categoria, fornecedor, documento e observação vivem só em cada ocorrência, nunca duplicados,
  decisão registrada no glossário.
- `private.compute_series_due_date` é a única fonte do calendário, compartilhada por
  `preview_payable_series` e `create_recurring_payable_series` (e será reusada pelo Parcelamento no
  ticket 12/036). Validado ao vivo no DEV antes mesmo de aplicar a migration: âncora 31/jan
  (ano não bissexto) → 28/fev → 31/mar; âncora 29/fev (ano bissexto) → 28/fev no ano seguinte.
- `preview_payable_series` já aceita `p_series_type` (`installment` ou `recurring`) desde este
  ticket, mesmo só a Recorrência estando disponível — o Parcelamento do ticket 12/036 reusa a
  mesma RPC sem trocar assinatura, incluindo a divisão truncada com resíduo na última ocorrência
  (já implementada na função, só não exercida por `create_recurring_payable_series`).
- `list_payables` e `get_payable` ganharam parâmetros/colunas acrescentados ao final (não no meio),
  mesmo arranjo já usado nos tickets 07 e 09/036, para a maioria das mudanças não exigir o ciclo de
  derrubar, recriar e reconceder privilégios.
- Módulo estendido com `visualizarPreviaSerie`/`criarRecorrencia`; `ContaPagarForm.tsx` ganhou a
  variante "Recorrência" no `SegmentedControl` (periodicidade, data âncora, quantidade, botão "Ver
  prévia" e lista de ocorrências), e `ContaPagarDetalheDrawer.tsx` exibe o resumo da Série quando
  presente.
- Suíte pgTAP `29_contas_a_pagar.test.sql` estendida de 128 para 155 asserções (a seção nova
  validada isoladamente no DEV, 27/27, com contexto próprio `ticket29j_context`).
- Testes de front: `ContasPagarRepository.test.ts` (+21 casos), `SupabaseContasPagarAdapter.test.ts`
  (+8 casos) e `ContasPagarTab.test.tsx` (+2 casos: alternância de variante com prévia e criação, e
  prévia limpa ao voltar para Avulsa). `npx tsc -b` e `npx oxlint` limpos.
- Verificação visual em navegador não foi feita nesta sessão, pela mesma limitação já registrada
  nos tickets anteriores desta spec.
