# 02: Quitações de Comissão e vales como saída realizada

**What to build:** o dinheiro repassado à equipe passa a aparecer como saída no Fluxo de Caixa
Projetado. O gestor vê, em cada agrupamento, quanto saiu em Quitações de Comissão e em vales, e o
detalhamento por profissional.

A regra que sustenta a spec aparece aqui pela primeira vez com risco real de duplicidade: **o fluxo
lê cada fato no livro onde ele nasce e nunca lê movimentos de caixa.** Uma quitação ou um vale em
dinheiro também gera movimento de caixa; somar os dois contaria a mesma saída duas vezes, e somar só
movimentos ignoraria o que foi pago em PIX. Pelo mesmo motivo, sangria, suprimento, sobra e quebra
de caixa não são entrada nem saída: são dinheiro que só mudou de lugar.

A Quitação conta pelo valor pago, que é todo o dinheiro desembolsado (comissão e gorjeta); o abate
de vale não é dinheiro. O vale conta quando é dado, qualquer que seja a forma de pagamento. Quando é
abatido depois, a quitação já sai menor pelo abate, e o vale não é contado de novo. Quitações antigas,
sem rateio, contam do mesmo jeito.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 03,
05, 07 e 08. Não pode correr em paralelo com outro ticket da cadeia, senão uma migração sobrescreve a
outra sem conflito visível.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seção "Fontes do realizado, lidas nos livros de
origem".

**Blocked by:** 01 (realizado de Comandas ponta a ponta).

**Status:** ready-for-agent

- [ ] Saídas realizadas de cada agrupamento somam Quitações de Comissão pelo valor pago, no dia de
      negócio do pagamento, sem o valor de abate de vale.
- [ ] Quitação estornada deixa de contar como saída.
- [ ] Vales contam pelo valor no dia de negócio da criação, qualquer que seja a forma de pagamento.
- [ ] Vale estornado deixa de contar como saída.
- [ ] Vale abatido numa Quitação de Comissão não conta de novo: o dinheiro que saiu uma vez aparece
      uma vez só.
- [ ] Quitações antigas, sem rateio, contam pelo valor pago.
- [ ] Sangria e suprimento registrados no período não alteram nenhum número do contrato; sobras,
      quebras, ajustes de sessão de caixa e entradas de estoque também ficam de fora.
- [ ] Uma Quitação com data de pagamento posterior a hoje entra no fluxo pendente do agrupamento.
- [ ] Detalhamento de cada agrupamento devolve quitações por profissional e vales por profissional.
- [ ] Índice parcial de Quitações de Comissão por tenant e data de pagamento, restrito às não
      estornadas, criado na migração.
- [ ] Aba mostra o cartão de saídas realizadas no resumo e a saída realizada em cada linha da tabela
      e em cada cartão de celular.
- [ ] Adaptador Supabase converte os campos novos, com teste de campos ausentes.
- [ ] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado criado no ticket 01.
- [ ] `npm run test` e `npm run test:db` verdes.
