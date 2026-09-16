# Validação de responsividade — Agenda desktop fluida

Data: 04/09/2026
Rota: `http://localhost:5173/agenda`
Ambiente: navegador lateral, usuário de teste gerente autenticado.

## Objetivo e método

Validar a grade da Agenda nas visões Dia e Semana, observando a ocupação
horizontal fluida, a escala vertical, o overflow horizontal e a regressão
mobile. A inspeção foi feita no navegador autenticado, com medições de DOM e
estilos computados. O dia corrente exibido inicialmente foi 04/09/2026; ele
não possuía atendimentos, enquanto a semana continha cards renderizados. Para
complementar a inspeção da visão Dia sem criar dados persistentes, naveguei
para 01/09/2026, que já possuía atendimentos no ambiente de teste.

A escala temporal vertical continua em pixels: os cards observados mantiveram
`height: 69px` e posições `top` alinhadas à grade. A ocupação horizontal usa
percentuais relativos à coluna, com margem externa de 4 px e desconto de 8 px.

## Viewports planejados e observados

| Viewport | Visão | Observações observadas |
|---|---|---|
| 1440×900 | Dia | 2 colunas de 514/513 px; board 1092 px; 01/09 exibiu cards solo renderizados em largura integral. |
| 1280×800 | Dia | 2 colunas de 434/433 px; board 932 px; 0 cards no dia corrente. |
| 1920×1080 | Dia | 2 colunas de 650/649 px; board 1364 px; 0 cards no dia corrente. |
| 2560×1440 | Dia | 2 colunas de 650/649 px; board 1364 px; 0 cards no dia corrente. |
| 1440×900 | Semana | 7 colunas de 173 px; board 1092 px e `scrollWidth` 1275 px. |
| 1280×800 | Semana | 7 colunas de 154 px; board 932 px e `scrollWidth` 1148 px. |
| 1920×1080 | Semana | 7 colunas de 220 px; board 1364 px e `scrollWidth` 1605 px. |
| 2560×1440 | Semana | 7 colunas de 220 px; board 1364 px e `scrollWidth` 1605 px. |
| 390×844 | Mobile | view desktop `display:none`, view mobile `display:block`; navegação inferior fixa. |

## Evidências visuais e de layout

- Na Semana, foram observados dois cards concorrentes no mesmo horário:
  `left: 4px` e `width: calc(50% - 8px)` no primeiro; `left: calc(50% + 4px)`
  e a mesma largura no segundo. Em 1440×900, cada um mediu 78 px; em
  1280×800, 68 px; em 1920×1080 e 2560×1440, 102 px.
- Também foram observados cards solo com `left: 4px` e
  `width: calc(100% - 8px)`. Em 1440×900, um card solo mediu 164 px; em
  1280×800, 145 px; em 1920×1080 e 2560×1440, 211 px.
- Na visão Dia, em 01/09/2026, foram observados cards solo de 09:00–09:20,
  09:40–10:10, 17:40–18:10 e 20:00–20:30 na coluna de Jonathas Teste;
  visualmente eles ocuparam a largura útil integral da coluna, com apenas as
  margens laterais previstas.
- O primeiro par concorrente observado manteve `top: 446px` e `height: 69px`
  em 1440×900 e 1280×800; em telas maiores, o `top` observado foi 405 px,
  com a mesma altura.
- A régua temporal apresentou `position: sticky`, `top: 0px` e `z-index: 50`.
- O `scrollWidth` maior que a largura do board na Semana confirma overflow
  horizontal disponível quando as larguras mínimas das colunas são excedidas.
- Não foi observado um cenário real de três cards concorrentes nos dados
  carregados. A cobertura automatizada da Task 4 contempla as três faixas e o
  módulo compartilhado é o mesmo usado em Dia e Semana, mas isso não substitui
  uma inspeção visual com dados renderizados; criar registros temporários seria
  uma alteração persistente desnecessária no ambiente de teste.

## Verificações automatizadas

## Atualização funcional dos cards

- As ações rápidas `Reagendar` e `Não compareceu` foram removidas dos cards
  desktop de Dia e Semana, evitando que a divisão horizontal comprima nomes e
  controles.
- `Não compareceu` agora aparece no cabeçalho da `ComandaCheckoutModal`,
  imediatamente à direita de `Reagendar`, mantendo a confirmação e as regras
  existentes de elegibilidade.
- A inspeção visual autenticada em 01/09/2026 confirmou cards sem ações
  embutidas e o modal com os dois controles lado a lado.

### `npm test`

Resultado: aprovado — 61 arquivos de teste e 354 testes, 0 falhas.

### `npm run build`

Resultado: falhou com código 1 por erros TypeScript preexistentes, fora do
escopo de validação visual e sem alteração nesta Task:

- `src/pages/__tests__/Agenda.test.tsx`: quatro fixtures preexistentes sem a
  propriedade obrigatória `id` no cliente. O fixture adicionado para três
  compromissos foi corrigido posteriormente para incluir esse id.
- `src/pages/gerente/__tests__/AgendaEquipeFilter.test.tsx`: import `React`
  não utilizado.
- `src/pages/gerente/Agenda.tsx`: `FilterIcon`, `pxPerMinute` e
  `totalGridMinutes` não utilizados.

O teste completo passou apesar do bloqueio de compilação estrita do build.

## Ressalvas e recomendações

Não houve alteração em `MobileAgendaView` ou CSS mobile. A lógica de negócio
de não comparecimento foi preservada; a mudança de markup ficou restrita aos
cards desktop e ao cabeçalho da comanda. A checagem mobile foi somente
regressiva.

O Dia foi complementado com um dia que contém atendimentos. Se for necessário
validar visualmente três cards concorrentes, recomenda-se usar fixtures ou um
ambiente descartável; não foram criados registros temporários no ambiente
compartilhado. Também é recomendável resolver os erros TypeScript acima em uma
mudança separada antes de considerar o build geral verde.

## Veredicto

A responsividade desktop observada em Dia e Semana está consistente com o
objetivo: colunas fluidas, cards solo ocupando a coluna, cards concorrentes
dividindo a largura e scroll horizontal disponível quando necessário. A
concorrência em três vias permanece coberta por teste automatizado, mas não foi
reproduzida visualmente por falta de dados correspondentes no estado observado;
o build geral permanece bloqueado pelos erros preexistentes listados acima.
