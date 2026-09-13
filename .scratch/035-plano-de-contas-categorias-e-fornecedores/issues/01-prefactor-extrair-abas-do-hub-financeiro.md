# 01: Prefactor — extrair as abas do Hub Financeiro em componentes

**What to build:** nenhuma mudança de comportamento visível. A página do Hub Financeiro, hoje com
mais de mil e duzentas linhas, cerca de trinta estados locais e duas abas escritas em linha, passa
a delegar cada aba (Caixa diário e turnos, Repasses de comissões) a um componente próprio. As abas
continuam trocadas por estado de componente, exatamente como hoje: as sub-rotas chegam no
ticket 02. Make the change easy, then make the easy change.

O ticket existe separado das sub-rotas para que a extração seja verificável por "nada mudou": o
teste atual da página do Hub, sem nenhuma alteração, é a prova. Se ele precisar mudar, o
comportamento mudou.

A divisão de estado já segue a regra que as sub-rotas vão precisar: o que as duas abas consomem
fica na página e desce por propriedade; o que só uma aba consome desce para ela. Ficam na página o
período, as métricas, a Sessão de Caixa ativa e a função de atualização — a Sessão de Caixa ativa
fica em cima porque a Quitação de Comissão e o lançamento de vale também a recebem.

Spec: `specs/035-plano-de-contas-categorias-e-fornecedores/spec.md`, seção "Entrega 1 — Hub
Financeiro em sub-rotas".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Cada aba do Hub Financeiro vive num componente próprio; a página mantém só o título, a
      navegação entre abas, o filtro de período, os KPIs e o estado compartilhado.
- [x] Período, métricas, Sessão de Caixa ativa e função de atualização ficam na página e são
      entregues às duas abas.
- [x] Descem para a aba de Caixa o resumo do turno, os movimentos, o histórico de sessões, o resumo
      por dia e os modais de abertura, fechamento e extrato.
- [x] Descem para a aba de Comissões o histórico de quitações, o estado de estorno de quitação e os
      modais de quitação, vale, detalhes e extrato do profissional.
- [x] A assinatura realtime continua cobrindo as mesmas quatro tabelas (comandas, pagamentos de
      comanda, sessões de caixa e movimentos de caixa) e continua atualizando tudo que a aba
      visível exibe.
- [x] O tipo das métricas financeiras, hoje exportado pela página e importado pela visão móvel de
      caixa, passa a morar num arquivo de tipos do Hub, por expand-contract: primeiro o tipo novo,
      depois a visão móvel migrada, por fim nenhum reexport restante na página.
- [x] A folha de estilo do Hub continua única e compartilhada.
- [x] As abas continuam trocadas por estado de componente; nenhuma rota, URL ou posição de
      navegação muda neste ticket.
- [x] Nenhuma correção de comportamento entra junto: filtro de período em data local do navegador,
      prévia da gaveta que ignora repasses e vales e KPI "Lucro líquido livre" ficam como estão.
- [x] A suíte de testes da página do Hub Financeiro e a da visão móvel de caixa passam **sem
      alteração nas asserções**.
- [x] `npm run test` verde.

## Notas da implementação

**Arquivos.** `src/pages/gerente/financeiro/`: `CaixaTab.tsx`, `ComissoesTab.tsx`, `types.ts`
(`FinancialMetrics`, `PainelFinanceiro`, `PainelTabProps`, `TabReload`) e `formatacao.ts`
(`formatDate`, usado pelas duas abas). `Financeiro.tsx` continua no lugar, com o título, o filtro
de período, os KPIs, a navegação, o realtime e o estado compartilhado. `Financeiro.css` continua
único.

**As duas abas ficam montadas; só a selecionada exibe o conteúdo de desktop** (`isActive`). É o que
a página fazia antes, quando o `activeTab` só escolhia qual bloco de JSX renderizar. Montar apenas
a aba selecionada foi tentado e revertido na revisão: zerava o estado da aba (o filtro do resumo
por dia, um estorno em preenchimento), mostrava totais zerados até a nova busca e, com Comissões
selecionada numa largura de celular, deixava a página em branco, porque a visão móvel de caixa vive
na aba de Caixa. O ticket 02 monta a aba pela rota e aí o desmonte passa a ser o comportamento
esperado.

**Recarga.** Cada aba registra a sua recarga na página (`registerTabReload`), e o `refresh` da
página recarrega métricas, Sessão de Caixa ativa e, em seguida, uma recarga de cada vez, como o
`fetchFinancialData` original fazia numa função só. A primeira falha interrompe as seguintes e a
página emite a única mensagem de erro, como antes. `realtimeVersion` existe para o resumo por dia,
que só se recarregava por realtime e não junto das mutações.

**Espaçamento.** O conteúdo da aba é irmão do cabeçalho do painel no DOM, porque a visão móvel de
caixa precisa ficar fora do bloco de desktop. A regra `.financeiro-tab-content` repõe os 2rem que
separavam a navegação do conteúdo. Nada muda na tela.
