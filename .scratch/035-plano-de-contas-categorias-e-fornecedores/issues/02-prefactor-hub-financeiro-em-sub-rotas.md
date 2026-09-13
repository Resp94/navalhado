# 02: Prefactor — Hub Financeiro em sub-rotas

**What to build:** o gestor passa a abrir o Hub Financeiro direto na aba que interessa por um link
(`/financeiro/caixa`, `/financeiro/comissoes`), volta a ela pelo favorito ou pelo histórico, e o
botão voltar do navegador leva à aba anterior em vez de sair do Hub. No celular, a navegação entre
abas passa a aparecer — hoje só a visão de caixa é alcançável, o que tornaria inalcançáveis o Plano
de Contas (ticket 03) e as abas das specs 036 e 037.

Nada do que as abas fazem muda. Este é o pré-requisito estrutural da aba desta spec e das abas de
Contas a Pagar e Fluxo de Caixa Projetado, e precisa estar estável antes de qualquer aba nova.

**O filtro de período e os KPIs não são cabeçalho do Hub.** O mesmo período alimenta os
recebimentos por forma de pagamento, a tabela de saldos de comissão, o histórico de quitações e o
detalhamento de comandas do profissional: é o filtro do painel operacional. Torná-lo global
colocaria dois filtros de período concorrentes na tela de Contas a Pagar, exibiria "Lucro líquido
livre" ao lado de despesas que ele não desconta e rodaria a busca de métricas em abas que não usam
o resultado. Por isso um layout intermediário, sem segmento de URL, envolve só Caixa e Comissões.

Spec: `specs/035-plano-de-contas-categorias-e-fornecedores/spec.md`, seção "Entrega 1 — Hub
Financeiro em sub-rotas".

**Blocked by:** 01 (extrair as abas do Hub Financeiro em componentes).

**Status:** ready-for-agent

- [ ] `/financeiro` vira rota-pai com layout próprio (título e navegação entre abas), e Caixa e
      Comissões viram rotas-filhas, ainda sob o guarda de rota de gerente e o layout de gerente que
      já existem.
- [ ] `/financeiro` sem sub-rota e qualquer sub-rota desconhecida redirecionam para
      `/financeiro/caixa` com substituição de histórico, sem laço no botão voltar.
- [ ] Um layout intermediário sem segmento de URL envolve apenas Caixa e Comissões, guarda o
      período, busca as métricas e a Sessão de Caixa ativa e entrega esses dados às duas abas.
- [ ] Alternar entre Caixa e Comissões preserva o período sem nova busca de métricas; sair para
      outra aba do Hub e voltar reinicia o período em "Este mês".
- [ ] A navegação entre abas é feita por links de rota com estado ativo derivado da URL; o estado
      local de aba ativa deixa de existir. Uma aba pode ser aberta em outra guia.
- [ ] O botão voltar do navegador leva à aba anterior do Hub.
- [ ] Os dois layouts novos repassam o contexto do tenant às rotas-filhas, e o layout do painel o
      estende com os dados compartilhados em vez de substituí-lo.
- [ ] A navegação entre abas fica logo abaixo do título do Hub, acima do filtro de período e dos
      KPIs.
- [ ] A navegação entre abas aparece no celular, com rolagem horizontal. A aba de Caixa continua
      servindo a visão móvel de caixa; a aba de Comissões passa a ser exibida no celular com as
      tabelas roláveis que já tem (adaptação para cartões fica fora).
- [ ] O item "Financeiro" da sidebar fica ativo em qualquer sub-rota de `/financeiro`, com o mesmo
      tratamento por prefixo que a sidebar já dá a Profissionais. A barra inferior do celular não
      muda.
- [ ] Nenhuma outra mudança visível e nenhuma correção de defeito das abas existentes.
- [ ] O teste da página do Hub deixa de simular o roteador inteiro e passa a renderizar o Hub dentro
      de um roteador em memória, com as **mesmas asserções de conteúdo**: os cinco KPIs, o resumo
      por dia, a tabela de comissões, o lançamento de vale e o erro de carregamento. A troca de aba
      vira navegação por link.
- [ ] Casos novos no teste do Hub: `/financeiro` abre Caixa; sub-rota desconhecida redireciona para
      Caixa; alternar Caixa e Comissões preserva o período sem nova busca de métricas.
- [ ] O teste da sidebar ganha o caso de item ativo em sub-rota.
- [ ] Os testes verificam só comportamento observável (qual aba a URL abre, o que é exibido, se a
      busca de métricas ocorre), nunca estrutura interna de componente, nome de estado ou ordem de
      chamadas.
- [ ] O verbete Hub Financeiro no `CONTEXT.md` deixa de descrever duas abas e passa a descrever abas
      endereçáveis por sub-rota.
- [ ] `npm run test` verde.
