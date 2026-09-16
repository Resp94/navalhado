# ADR 021: Fluxo de Caixa Projetado

## Status

Aceita em 2026-09-14.

## Contexto e Problema

A spec 037 responde à pergunta que motivou o Hub Financeiro desde o início: vai sobrar ou vai
faltar dinheiro nas próximas semanas? A resposta depende de somar dinheiro que já entrou, dinheiro
que já saiu, dinheiro que ainda deve entrar e dinheiro que ainda deve sair — hoje espalhados por
Caixa, Comissões e Contas a Pagar, cada um com sua própria fonte de verdade.

Três decisões atravessam toda a spec e valiam a pena registrar juntas: onde o fluxo lê cada fato,
como ele estima o que ainda não aconteceu, e como ele mostra "quanto sobra" sem inventar um dado
que o sistema não guarda.

## Decisões Tomadas

1. **O fluxo lê cada fato no livro onde ele nasce, e nunca lê `cash_movements`.** Entradas
   realizadas vêm de `comanda_pagamentos` (ticket 01); saídas realizadas vêm de
   `commission_payouts` e `professional_account_entries` (ticket 02) e, nos tickets seguintes, da
   coluna de valor pago de `payables`. `cash_movements` é espelho de um fato registrado em outro
   lugar (repasse de comissão, vale, Baixa pela gaveta) ou transferência interna (sangria,
   suprimento, sobra, quebra) — nunca receita nem despesa. Somar os movimentos junto com os livros
   de origem contaria a mesma saída duas vezes; somar só os movimentos ignoraria tudo que foi pago
   fora da gaveta. A consequência prática, encontrada só ao implementar o ticket 02: juntar duas ou
   mais fontes "muitas linhas por agrupamento" (entrada, Quitação, vale, e depois estimativa) num
   único `GROUP BY` produz produto cartesiano e multiplica as somas — cada fonte precisa da própria
   CTE de agregação por agrupamento antes de juntar por `bucket_start`/`bucket_end`.

2. **A entrada futura é estimada pela média por dia da semana, sem nenhuma persistência.** O
   ticket 03 calcula, a cada consulta, a média do recebido nas N ocorrências mais recentes do
   mesmo dia da semana (N até 8, contado a partir do primeiro pagamento de Comanda do tenant — não
   da criação do tenant), e nunca grava o resultado em tabela nenhuma. Abaixo de 4 semanas de
   histórico a estimativa fica marcada como `insufficient_history`, e o valor por agrupamento vira
   `null` — vazio, não zero — sempre que houver dia futuro ativo a estimar; zero só é correto
   quando não há mesmo nada a estimar (agrupamento todo passado, ou só dias fechados). Guardar uma
   média calculada tornaria a estimativa uma fonte de verdade paralela, que ficaria defasada a cada
   novo pagamento e exigiria uma rotina de recálculo que a spec não precisa: recalcular a cada
   consulta é barato (uma soma sobre um índice) e sempre atual.

3. **O saldo inicial da curva é entrada só de tela.** O gestor pode informar quanto tem hoje na
   gaveta para que a curva vire Saldo Projetado em vez de Resultado Acumulado (ticket 04), mas esse
   número nunca é gravado, nunca vai ao banco, nunca entra na URL e nunca fica em armazenamento do
   navegador — some ao recarregar a página. A curva inteira é composta no navegador por uma função
   pura do módulo (`computeFluxoCaixaCurva`), para que digitar cada dígito do saldo não refaça a
   consulta pesada ao contrato de leitura. Saldo persistido por conta pertence à futura spec de
   subcontas e contas bancárias — este ticket não antecipa esse modelo, só simula em cima do que já
   existe.

## Consequências

- Uma extensão futura do fluxo (por exemplo, receita de venda de produtos fora de Comanda) segue o
  mesmo molde: uma nova CTE de agregação por agrupamento no núcleo, lendo o livro de origem
  específico, nunca `cash_movements`.
- Qualquer novo agregado "por dia dentro do agrupamento" (estimativa, saída prevista, vencida)
  repete o padrão de CTE isolada por fonte — reincidir no `GROUP BY` único é o erro mais fácil de
  cometer de novo, e o mais caro de notar (os números saem plausíveis, só errados).
- A tela nunca pode tratar `inflow_estimated: null` como `0` em soma nenhuma — fazer isso
  silenciaria o aviso de histórico insuficiente e mostraria uma estimativa de confiança que o
  sistema não tem.
- Uma spec futura de subcontas e saldo bancário persistido não reaproveita `saldoInformadoInput`
  como está: esse estado nasceu deliberadamente efêmero, e persisti-lo exigiria decisões novas
  (por conta, por tenant, sincronizado entre dispositivos) que esta spec não resolve.
