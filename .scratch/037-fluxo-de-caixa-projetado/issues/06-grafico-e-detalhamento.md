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

**Status:** ready-for-agent

- [ ] Gráfico com barras de entrada e de saída por agrupamento e a curva com o rótulo vigente
      (Resultado Acumulado ou Saldo Projetado).
- [ ] Entradas estimadas aparecem no gráfico com preenchimento distinto do realizado e legenda
      textual; a distinção não depende só de cor.
- [ ] O destaque do primeiro período negativo aparece também no gráfico.
- [ ] Em granularidade diária com muitos agrupamentos, o gráfico rola na horizontal dentro do próprio
      contêiner, sem rolagem horizontal da página, inclusive no celular.
- [ ] O SVG leva um título descritivo, e a tabela permanece como equivalente acessível.
- [ ] Nenhuma dependência nova de gráficos é adicionada ao projeto.
- [ ] Tocar num agrupamento na tabela, nos cartões de celular ou no gráfico abre o detalhamento em
      gaveta lateral.
- [ ] Detalhamento mostra as datas do agrupamento, entradas realizadas por forma de pagamento,
      Quitações de Comissão por profissional, vales por profissional e, quando houver estimativa, dias
      estimados e dias fechados.
- [ ] O realizado aparece em totais, sem lista item a item.
- [ ] Gráfico, tabela e cartões não ganham arquivos de teste próprios; o teste da aba com repositório
      falso injetado cobre a abertura do detalhamento.
- [ ] `npm run test` verde.
