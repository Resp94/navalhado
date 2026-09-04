# Validação de responsividade — Agenda desktop fluida

Data: 04/09/2026
Rota: `http://localhost:5173/agenda`
Ambiente: navegador lateral, usuário de teste gerente autenticado.

## Objetivo e método

Validar a grade da Agenda nas visões Dia e Semana, observando a ocupação
horizontal fluida, a escala vertical, o overflow horizontal e a regressão
mobile. A inspeção foi feita no navegador autenticado, com medições de DOM e
estilos computados. O dia corrente exibido foi 04/09/2026; ele não possuía
atendimentos, enquanto a semana continha cards renderizados.

A escala temporal vertical continua em pixels: os cards observados mantiveram
`height: 69px` e posições `top` alinhadas à grade. A ocupação horizontal usa
percentuais relativos à coluna, com margem externa de 4 px e desconto de 8 px.

## Viewports planejados e observados

| Viewport | Visão | Observações observadas |
|---|---|---|
| 1440×900 | Dia | 2 colunas de 514/513 px; board 1092 px; 0 cards no dia corrente. |
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
- O primeiro par concorrente observado manteve `top: 446px` e `height: 69px`
  em 1440×900 e 1280×800; em telas maiores, o `top` observado foi 405 px,
  com a mesma altura.
- A régua temporal apresentou `position: sticky`, `top: 0px` e `z-index: 50`.
- O `scrollWidth` maior que a largura do board na Semana confirma overflow
  horizontal disponível quando as larguras mínimas das colunas são excedidas.
- Não foi observado um cenário real de três cards concorrentes nos dados
  carregados. A cobertura automatizada da Task 4 contempla as três faixas,
  mas isso não substitui a inspeção visual com dados renderizados.

## Verificações automatizadas

### `npm test`

Resultado: aprovado — 61 arquivos de teste e 353 testes, 0 falhas.

### `npm run build`

Resultado: falhou com código 1 por erros TypeScript preexistentes, fora do
escopo de validação visual e sem alteração nesta Task:

- `src/pages/__tests__/Agenda.test.tsx`: cinco fixtures sem a propriedade
  obrigatória `id` no cliente.
- `src/pages/gerente/__tests__/AgendaEquipeFilter.test.tsx`: import `React`
  não utilizado.
- `src/pages/gerente/Agenda.tsx`: `FilterIcon`, `pxPerMinute` e
  `totalGridMinutes` não utilizados.

O teste completo passou apesar do bloqueio de compilação estrita do build.

## Ressalvas e recomendações

Não houve alteração em `MobileAgendaView`, CSS mobile, lógica de negócio,
markup, contratos ou testids. A checagem mobile foi somente regressiva.

Recomenda-se ao agente principal complementar a validação visual em Dia com
um dia que contenha atendimentos e, se possível, com um cenário de três cards
concorrentes. Também é recomendável resolver os erros TypeScript acima em uma
mudança separada antes de considerar o build geral verde.

## Veredicto

A responsividade desktop observada na Semana está consistente com o objetivo:
colunas fluidas, cards solo ocupando a coluna, cards concorrentes dividindo a
largura e scroll horizontal disponível quando necessário. A aprovação visual
completa de Dia e da concorrência em três vias permanece pendente por falta de
dados correspondentes no estado observado; o build geral permanece bloqueado
pelos erros preexistentes listados acima.
