# 06: Gráfico e detalhamento

**What to build:** o gestor passa a enxergar o fluxo num gráfico de barras de entrada e saída por
agrupamento, com a curva por cima, e toca num agrupamento para entender de onde vem cada número: o
detalhamento abre com as entradas por forma de pagamento e as saídas por profissional.

O gráfico é SVG próprio, sem biblioteca nova. O projeto não tem biblioteca de gráficos, já tem
precedente de gráfico SVG feito à mão no painel administrativo, e um gráfico de barras com uma linha,
com no máximo 92 agrupamentos, não justifica uma dependência de dezenas de kB no bundle de todos os
usuários. A tabela continua sendo o equivalente acessível do gráfico.

Estimado e previsto nunca se distinguem só por cor: no gráfico têm preenchimento distinto
(hachurado ou translúcido) e legenda.

O detalhamento vem na mesma resposta do contrato, então abrir um agrupamento não faz a tela esperar.
O realizado não é listado item a item, só em totais. Este ticket só toca tela e não altera o contrato.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seção "Tela `/financeiro/fluxo-de-caixa`".

**Blocked by:** 03 (entradas estimadas por dia da semana), 04 (curva, saldo informado e primeiro
período negativo).

**Status:** done

- [x] Gráfico com barras de entrada e de saída por agrupamento e a curva com o rótulo vigente
      (Resultado Acumulado ou Saldo Projetado).
- [x] Entradas estimadas aparecem no gráfico com preenchimento distinto do realizado e legenda
      textual; a distinção não depende só de cor.
- [x] O destaque do primeiro período negativo aparece também no gráfico.
- [x] Em granularidade diária com muitos agrupamentos, o gráfico rola na horizontal dentro do próprio
      contêiner, sem rolagem horizontal da página, inclusive no celular.
- [x] O SVG leva um título descritivo, e a tabela permanece como equivalente acessível.
- [x] Nenhuma dependência nova de gráficos é adicionada ao projeto.
- [x] Tocar num agrupamento na tabela, nos cartões de celular ou no gráfico abre o detalhamento em
      gaveta lateral.
- [x] Detalhamento mostra as datas do agrupamento, entradas realizadas por forma de pagamento,
      Quitações de Comissão por profissional, vales por profissional e, quando houver estimativa, dias
      estimados e dias fechados.
- [x] O realizado aparece em totais, sem lista item a item.
- [x] Gráfico, tabela e cartões não ganham arquivos de teste próprios; o teste da aba com repositório
      falso injetado cobre a abertura do detalhamento.
- [x] `npm run test` verde.

**Notas de implementação:**

- **`FluxoCaixaGrafico.tsx`** (novo): SVG feito à mão, mesmo precedente do `src/pages/admin/Dashboard.tsx`
  (`viewBox`, gradientes/CSS vars, sem lib). Duas barras por agrupamento (entrada empilhada
  realizado+estimado, saída realizada) e uma linha para a curva, todas na mesma escala (domínio
  `[min(0, ...saldos válidos), max(...entradas, ...saídas, ...saldos válidos, 1)]` -- saldo `null` de
  agrupamento passado com saldo informado fica de fora do domínio e quebra a linha nesse ponto, nunca
  interpolado como zero). Entrada estimada usa `<pattern>` de hachura (`fluxo-caixa-hachura-estimado`),
  nunca só cor. Primeiro período negativo (`curva.primeiroNegativoIndex`) pinta a faixa do agrupamento e
  de todos os seguintes, mesmo critério já usado na tabela (`index >= primeiroNegativoIndex`). Largura
  do SVG cresce com o número de agrupamentos (`buckets.length * BUCKET_WIDTH`, mínimo 520px de área
  útil) dentro de um `<div class="fluxo-caixa-grafico-scroll">` com `overflow-x: auto` -- a rolagem fica
  presa ao contêiner, nunca a página, em qualquer largura. `<title>` descritivo dentro do `<svg>`; a
  tabela (`FluxoCaixaTabela`) continua o equivalente acessível, sem mudança de conteúdo.
- **Interação de abrir o detalhamento:** cada grupo do gráfico (`<g role="button" tabIndex={0}>`) e cada
  `<tr>` da tabela (que já vira cartão no celular pelo CSS responsivo existente, sem view separada)
  chamam o mesmo `onSelecionarBucket(index)`, subido até `FluxoCaixaTab`, que guarda só o índice
  selecionado (`bucketSelecionadoIndex`) -- sem repositório novo, o `bucket` já está em memória.
- **`FluxoCaixaDetalheDrawer.tsx`** (novo): usa o `Drawer` genérico (`src/components/ui/feedback/Drawer.tsx`,
  mesmo precedente do `ContaPagarDetalheDrawer` da spec 036) -- sem chamada de rede, o detalhamento
  já vem no `bucket.detail` da consulta. Seções: entradas por forma de pagamento (`inflow_by_method`,
  sempre as quatro chaves, mesmo zeradas), entrada estimada (`FluxoCaixaValorEstimado` reusado, com
  dias estimados/fechados, só fora de `kind === 'past'`), Quitações de Comissão e vales por profissional
  (`payouts_by_professional`/`advances_by_professional`, mensagem própria quando vazio) e um bloco de
  totais (recebido, saída realizada). Nenhuma lista item a item: o próprio contrato de leitura só
  devolve agregados, então "realizado em totais" já vem satisfeito pela forma do dado.
- **Teste:** `FluxoCaixaTab.test.tsx` ganhou um quarto caso -- clica no botão "Ver detalhamento de
  16/06" (aparece duas vezes, uma na tabela e uma no gráfico, por isso `getAllByRole`/`[0]`) e confirma
  que a gaveta abre com "Quitações de Comissão por profissional" e o nome do profissional. Nenhum
  arquivo de teste novo para `FluxoCaixaGrafico`/`FluxoCaixaDetalheDrawer`, como pedido.
- `npm run test`: 83 arquivos, 809 testes, verde. `npx tsc --noEmit` sem erros. Sem migration: não
  precisa de `npm run test:db` nem de aplicação no DEV.
