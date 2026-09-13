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

- [ ] Cada aba do Hub Financeiro vive num componente próprio; a página mantém só o título, a
      navegação entre abas, o filtro de período, os KPIs e o estado compartilhado.
- [ ] Período, métricas, Sessão de Caixa ativa e função de atualização ficam na página e são
      entregues às duas abas.
- [ ] Descem para a aba de Caixa o resumo do turno, os movimentos, o histórico de sessões, o resumo
      por dia e os modais de abertura, fechamento e extrato.
- [ ] Descem para a aba de Comissões o histórico de quitações, o estado de estorno de quitação e os
      modais de quitação, vale, detalhes e extrato do profissional.
- [ ] A assinatura realtime continua cobrindo as mesmas quatro tabelas (comandas, pagamentos de
      comanda, sessões de caixa e movimentos de caixa) e continua atualizando tudo que a aba
      visível exibe.
- [ ] O tipo das métricas financeiras, hoje exportado pela página e importado pela visão móvel de
      caixa, passa a morar num arquivo de tipos do Hub, por expand-contract: primeiro o tipo novo,
      depois a visão móvel migrada, por fim nenhum reexport restante na página.
- [ ] A folha de estilo do Hub continua única e compartilhada.
- [ ] As abas continuam trocadas por estado de componente; nenhuma rota, URL ou posição de
      navegação muda neste ticket.
- [ ] Nenhuma correção de comportamento entra junto: filtro de período em data local do navegador,
      prévia da gaveta que ignora repasses e vales e KPI "Lucro líquido livre" ficam como estão.
- [ ] A suíte de testes da página do Hub Financeiro e a da visão móvel de caixa passam **sem
      alteração nas asserções**.
- [ ] `npm run test` verde.
