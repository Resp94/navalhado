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

- [x] `/financeiro` vira rota-pai com layout próprio (título e navegação entre abas), e Caixa e
      Comissões viram rotas-filhas, ainda sob o guarda de rota de gerente e o layout de gerente que
      já existem.
- [x] `/financeiro` sem sub-rota e qualquer sub-rota desconhecida redirecionam para
      `/financeiro/caixa` com substituição de histórico, sem laço no botão voltar.
- [x] Um layout intermediário sem segmento de URL envolve apenas Caixa e Comissões, guarda o
      período, busca as métricas e a Sessão de Caixa ativa e entrega esses dados às duas abas.
- [x] Alternar entre Caixa e Comissões preserva o período sem nova busca de métricas; sair para
      outra aba do Hub e voltar reinicia o período em "Este mês".
- [x] A navegação entre abas é feita por links de rota com estado ativo derivado da URL; o estado
      local de aba ativa deixa de existir. Uma aba pode ser aberta em outra guia.
- [x] O botão voltar do navegador leva à aba anterior do Hub.
- [x] Os dois layouts novos repassam o contexto do tenant às rotas-filhas, e o layout do painel o
      estende com os dados compartilhados em vez de substituí-lo.
- [x] A navegação entre abas fica logo abaixo do título do Hub, acima do filtro de período e dos
      KPIs.
- [x] A navegação entre abas aparece no celular, com rolagem horizontal. A aba de Caixa continua
      servindo a visão móvel de caixa; a aba de Comissões passa a ser exibida no celular com as
      tabelas roláveis que já tem (adaptação para cartões fica fora).
- [x] O item "Financeiro" da sidebar fica ativo em qualquer sub-rota de `/financeiro`, com o mesmo
      tratamento por prefixo que a sidebar já dá a Profissionais. A barra inferior do celular não
      muda.
- [x] Nenhuma outra mudança visível e nenhuma correção de defeito das abas existentes.
- [x] O teste da página do Hub deixa de simular o roteador inteiro e passa a renderizar o Hub dentro
      de um roteador em memória, com as **mesmas asserções de conteúdo**: os cinco KPIs, o resumo
      por dia, a tabela de comissões, o lançamento de vale e o erro de carregamento. A troca de aba
      vira navegação por link.
- [x] Casos novos no teste do Hub: `/financeiro` abre Caixa; sub-rota desconhecida redireciona para
      Caixa; alternar Caixa e Comissões preserva o período sem nova busca de métricas.
- [x] O teste da sidebar ganha o caso de item ativo em sub-rota.
- [x] Os testes verificam só comportamento observável (qual aba a URL abre, o que é exibido, se a
      busca de métricas ocorre), nunca estrutura interna de componente, nome de estado ou ordem de
      chamadas.
- [x] O verbete Hub Financeiro no `CONTEXT.md` deixa de descrever duas abas e passa a descrever abas
      endereçáveis por sub-rota.
- [x] `npm run test` verde.

## Notas de implementação

**Arquivos novos.** `src/pages/gerente/financeiro/HubLayout.tsx` exporta `FinanceiroHub`: título,
navegação entre abas (`NavLink`) e `<Outlet context={tenant}>`. `src/pages/gerente/financeiro/
PainelLayout.tsx` exporta `FinanceiroPainel`: todo o estado que antes vivia em `Financeiro.tsx`
(período, métricas, Sessão de Caixa ativa, `registerTabReload`, realtime, animação GSAP), o filtro
de período e os KPIs, entregues às rotas-filhas por `<Outlet context={outletContext}>`. O antigo
`src/pages/gerente/Financeiro.tsx` foi removido; `Financeiro.css` continua único, importado por
`HubLayout.tsx`.

**Rotas** (`App.tsx`): `/financeiro` (elemento `FinanceiroHub`) com `index` e `*` redirecionando
para `/financeiro/caixa` (`replace`), e uma rota sem `path` com elemento `FinanceiroPainel`
envolvendo `caixa` e `comissoes`.

**Contrato que as próximas abas (Plano de Contas, Contas a Pagar, Fluxo de Caixa) consomem:**
`CaixaTab` e `ComissoesTab` deixaram de receber propriedades e passaram a ler tudo de
`useOutletContext<PainelContext>()` — `PainelContext` (`financeiro/types.ts`) é a interseção de
`TenantContextType` com `PainelFinanceiro`. `isActive` e `PainelTabProps` foram removidos: cada
rota já desmonta a outra, então a aba renderiza seu conteúdo de desktop incondicionalmente. Uma
aba nova que **não** precisa do período/métricas/Sessão de Caixa (Plano de Contas, por exemplo) é
uma rota-filha direta de `/financeiro` (irmã da rota sem `path` do painel), lendo só
`useOutletContext<TenantContextType>()`.

**CSS.** `.financeiro-tab-content` ganhou `display:flex; flex-direction:column; gap:2rem;
width:100%` (antes só `margin-top`), porque a aba de Comissões agora usa essa classe sozinha (sem
`.financeiro-desktop-view`) para ficar visível no celular com suas tabelas roláveis. Nova classe
`.financeiro-panel-header` (`margin-top:0.5rem`) no wrapper de período+KPIs do `PainelLayout`,
para preservar o espaçamento de 2rem que existia quando título, nav e período+KPIs estavam todos
dentro do mesmo `.financeiro-desktop-view`. `.nav-tab-btn` ganhou `text-decoration:none`,
`white-space:nowrap` e `flex-shrink:0` (virou `<a>` via `NavLink`); `.financeiro-nav-tabs` ganhou
`overflow-x:auto` em `max-width:768px` para a rolagem horizontal no celular.

**Mudança visível inerente à arquitetura, não listada nos critérios mas decorrente deles:** o
filtro de período deixou de ficar ao lado do título na mesma linha (`.financeiro-header` só tem o
título agora) porque período e título vivem em layouts de rota diferentes por decisão da spec
("filtro de período + KPIs" no layout do painel, "título, navegação" no layout do Hub). O filtro
agora fica em bloco próprio, abaixo da navegação de abas.

**Teste do Hub** (`__tests__/Financeiro.test.tsx`): `renderHub(path)` monta `MemoryRouter` com a
mesma árvore de rotas do `App.tsx` sob um `FakeGerenteLayout` que só entrega o contexto do tenant
(sem a autenticação e carga real do `GerenteLayout`). Trocas de aba usam `getByRole('link', ...)` e
`fireEvent.click`, não mais `getByRole('button', ...)`.
