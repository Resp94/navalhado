# Migração para Tailwind CSS — Relatório de Impacto e Riscos

> Gerado em 2026-09-16, a pedido do Jonathas, para avaliar a troca do CSS vanilla atual por Tailwind CSS.

## 1. Estado atual do CSS no projeto

| Métrica | Valor |
| :--- | :--- |
| Arquivos `.css` dedicados | 10 |
| Linhas totais em `.css` | 6.289 |
| Componentes `.tsx` no projeto | 195 |
| Componentes com `<style>{...}</style>` inline (CSS-in-JSX manual) | 77 |
| Arquivos usando `var(--color-...)` (design tokens) | 98 |
| Usos de `!important` | 183 |
| Definições `@keyframes` | 48 |
| Referências à classe `.dark-theme` | 160 ocorrências em 33 arquivos |
| Media queries `prefers-color-scheme` | 0 |
| Framework CSS/CSS-in-JS já instalado | Nenhum (`styled-components`, `emotion`, `sass`, `postcss` ausentes do `package.json`) |

### Maiores arquivos CSS (candidatos a maior esforço de migração)

1. `src/pages/gerente/Clientes.css` — 1.363 linhas
2. `src/pages/gerente/Whatsapp.css` — 1.118 linhas
3. `src/components/cliente/cliente.css` — 879 linhas
4. `src/pages/gerente/Financeiro.css` — 839 linhas
5. `src/components/GlassSidebar.css` — 663 linhas
6. `src/pages/gerente/financeiro/fluxo-caixa/FluxoCaixa.css` — 532 linhas
7. `src/index.css` — 357 linhas (contém os **design tokens globais**: `--color-brand-primary`, `--color-bg-primary`, `--radius-*`, `--font-family-base` etc.)

### Padrão de tema

O tema claro/escuro **não** usa `prefers-color-scheme` — é 100% controlado por uma classe `.dark-theme` aplicada via JS/contexto em 33 arquivos. Isso é relevante porque o Tailwind, por padrão, também prefere a estratégia `dark: class` (basta configurar `darkMode: 'class'`), então **essa parte é compatível** e não é um risco alto.

### Padrão de componentização de estilo

77 dos 195 componentes (~40%) escrevem CSS via tag `<style>{\`...\`}</style>` solta dentro do JSX — **não** é `styled-jsx` real (o pacote não está instalado), é CSS global sendo injetado no DOM a cada render do componente, escopado só por convenção de nome de classe (ex.: `mobile-agenda__*`). Isso já é uma fonte de acoplamento frágil hoje, independente do Tailwind.

## 2. O que a migração implica na prática

Tailwind **não substitui** CSS automaticamente — ele é adotado incrementalmente, arquivo por arquivo. Duas abordagens possíveis:

### Opção A — Convivência (recomendada)
Instalar Tailwind, mapear os tokens de `index.css` (`--color-brand-primary` etc.) para `tailwind.config` via `theme.extend`, e usar Tailwind **só em componentes novos ou reescritos**. Os 10 `.css` + 77 blocos inline continuam funcionando sem tocar.

- **Risco de regressão:** baixo. Nada existente é removido ou reescrito à força.
- **Custo:** só o setup inicial (Tailwind v4 + plugin Vite nativo, sem PostCSS manual).
- **Contra:** o projeto passa a ter **dois sistemas de estilo coexistindo por tempo indeterminado**, aumentando a carga cognitiva até a migração terminar (se terminar).

### Opção B — Migração completa
Reescrever os 6.289 + linhas de CSS e os 77 blocos inline para classes utilitárias.

- **Risco de regressão:** alto. Cada um dos 195 componentes é um ponto de quebra visual potencial, principalmente:
  - **183 usos de `!important`** — geralmente existem para vencer conflito de especificidade contra outro seletor. Ao converter para utilities, é preciso achar e resolver manualmente cada um desses conflitos, ou o layout muda de comportamento silenciosamente.
  - **48 `@keyframes`** — animações customizadas não têm equivalente automático em utility classes; migram para `tailwind.config` (`theme.extend.keyframes`) uma a uma, testando cada uma.
  - **Media queries de responsividade manuais** (breakpoints custom por arquivo) precisam ser remapeadas para os breakpoints do Tailwind (`sm/md/lg/xl`) — se os breakpoints atuais não baterem com os do Tailwind, elementos que hoje quebram em `768px` podem passar a quebrar em outro valor.
  - **Especificidade de seletor**: hoje há CSS global sem escopo (BEM-like manual, ex. `.mobile-agenda__empty-title`). Utilities do Tailwind são de baixa especificidade (uma classe = uma propriedade); se sobrar CSS legado global não removido corretamente, ele pode **vencer** a utility e produzir bug visual difícil de rastrear (comportamento observado recentemente: banner órfão de CSS após remoção de JSX, só resolvido explicitamente).
- **Custo:** alto — estimativa grosseira, tratando ~200 pontos de conversão (10 arquivos CSS + 77 componentes inline + validação visual de cada tela em ambos os temas), a um ritmo conservador de revisão manual + teste visual, é trabalho de várias sprints, não de uma tarefa única.

## 3. Riscos específicos deste projeto

1. **Tema escuro amplamente espalhado (33 arquivos, 160 ocorrências)** — qualquer token que não for migrado corretamente para `dark:` quebra consistência de cor silenciosamente (texto ilegível, fundo errado). Precisa de checklist tela a tela, claro e escuro.
2. **Ausência de testes visuais automatizados** — o projeto tem `vitest` (testes de lógica), mas nenhum teste de snapshot visual/E2E encontrado. Regressão de CSS não quebra o `npm test`, só aparece no navegador. Migração completa sem cobertura visual é o maior risco real do projeto.
3. **`!important` em massa (183 usos)** — cada um é candidato a "por que isso não ficou igual" depois de migrar; costuma indicar que dois seletores competem pelo mesmo elemento hoje. Sem mapear a origem de cada conflito antes, a conversão para utilities reintroduz ou esconde o bug.
4. **CSS solto por componente sem escopo real** — como não há `styled-jsx`/CSS Modules, uma classe `.mobile-agenda__empty-title` pode, em teoria, colidir com outra igual em outro arquivo se o nome se repetir. Ao migrar um componente para Tailwind e apagar seu bloco `<style>`, é preciso confirmar que nenhuma outra tela dependia daquela classe "vazando" globalmente.
5. **Vite 8 + Tailwind v4**: a stack atual (Vite 8.1, React 19.2, TS 6.0) é recente o suficiente para usar o plugin `@tailwindcss/vite` (Tailwind v4), que dispensa `postcss.config` e `tailwind.config.js` manual — reduz o risco de configuração comparado à v3, mas ainda é peça nova na build.

## 4. Recomendação

Não migrar tudo de uma vez. Sugestão de ordem:

1. Instalar Tailwind v4 via `@tailwindcss/vite`, mapear tokens de `index.css` para `theme.extend.colors` (mantendo os nomes atuais `brand-primary`, `bg-primary` etc. para não quebrar leitura mental da equipe).
2. Confirmar `darkMode: 'class'` reaproveitando a `.dark-theme` já existente — não muda o mecanismo de toggle atual.
3. Aplicar Tailwind só em telas novas ou já em refatoração (ex.: a série de mudanças mobile em andamento na `feature/melhorias-design-mobile`).
4. Migrar CSS legado arquivo por arquivo, começando pelos **menores** (`PlanoContas.css`, 90 linhas) para validar o processo antes de encarar `Clientes.css` (1.363 linhas).
5. Não apagar `.css`/`<style>` legado até a tela equivalente ser conferida manualmente em claro e escuro, mobile e desktop.

## 5. Estimativa de linhas de CSS economizadas (migração completa)

Levantamento adicional incluindo os blocos `<style>{...}</style>` inline (que a seção 1 já apontava, mas não somava):

| Fonte | Linhas | Blocos de regra CSS |
| :--- | ---: | ---: |
| `.css` dedicados (10 arquivos) | 6.289 | 782 |
| `<style>{...}</style>` inline (77 componentes) | 18.853 | 1.881 |
| **Total combinado** | **25.142** | **2.663** |

Ou seja: o projeto tem **~4x mais CSS dentro dos componentes `.tsx`** do que nos arquivos `.css` dedicados — é o maior bloco de risco/esforço da migração, não os 10 arquivos `.css`.

### O que desaparece vs. o que fica

- **Convertível para utilities (some para 0 linhas de CSS):** regras simples de box-model, cor, tipografia, espaçamento, flex/grid — a maioria dos ~2.663 blocos de regra. Inclui a maior parte dos 346 usos de `!important` (183 em `.css` + 163 inline), porque a guerra de especificidade que hoje exige `!important` geralmente some quando não há mais seletor global concorrendo.
- **Não desaparece, só migra de lugar:** 89 blocos `@keyframes` (48 em `.css` + 41 inline) — viram `theme.extend.keyframes` no `tailwind.config`, mesmo tanto de linhas, só centralizado num arquivo em vez de espalhado.
- **Fica como CSS mesmo com Tailwind:** seletores compostos, combinadores (`~`, `>`, `:not()`), e casos que dependem de valor dinâmico vindo de JS (ex. cor calculada em runtime) — viram utilities com valor arbitrário (`w-[123px]`) quando dá, ou continuam em um CSS residual pequeno quando não dá.

### Estimativa

Com base na proporção observada (regras simples dominando, ~89 blocos de keyframes irredutíveis, ~346 pontos de conflito de especificidade que tendem a sumir), uma migração completa e bem-feita tende a eliminar **70–75% das 25.142 linhas atuais**, ou seja:

- **Economia estimada: ~17.600–18.900 linhas de CSS.**
- **Remanescente estimado: ~6.200–7.500 linhas** (tokens de tema, `@keyframes` centralizados, casos de seletor complexo).

**Ressalva importante:** isso é economia de *linhas de CSS*, não de "código total do projeto". Utility classes deslocam a complexidade para dentro do `className` do JSX — um componente com 40 linhas de `<style>` hoje pode virar um `className` de uma linha só, mas essa linha fica bem mais longa (ex.: `className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-brand-light"`). O `.tsx` não necessariamente fica menor em linhas totais, fica mais denso por linha.

## 6. Não-riscos (para não superestimar o custo)

- Instalar Tailwind **não quebra nada por si só** — é aditivo até o CSS ser de fato reescrito.
- A estratégia de tema por classe (`.dark-theme`) já é compatível com o padrão do Tailwind, sem necessidade de reescrever o mecanismo de troca de tema.
- O projeto não usa nenhum outro framework CSS-in-JS que competiria com o Tailwind — não há conflito de ferramentas a resolver antes.
