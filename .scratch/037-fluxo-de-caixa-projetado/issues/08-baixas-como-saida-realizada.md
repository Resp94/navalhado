# 08: Baixas como saída realizada

**What to build:** o pagamento de contas passa a aparecer como saída realizada no Fluxo de Caixa
Projetado, na data do pagamento e pelo valor que de fato saiu: juros e multa somados, desconto
abatido. O gestor vê no detalhamento quanto foi pago por Categoria de Despesa.

A Baixa conta pelo valor pago que a spec 036 já grava, sem recompor a fórmula: há uma única definição
desse número. Uma Baixa de valor pago zero (abatimento concedido pelo fornecedor) não gera saída, mas
reduz o saldo restante da conta e, com ele, a Saída Prevista. As Baixas contam pelo próprio estado de
estorno, qualquer que seja o estado da conta.

Uma Baixa paga com dinheiro da gaveta também gera movimento de caixa. Como o fluxo nunca lê movimentos
de caixa, ela conta uma vez só. Este ticket fecha a prova dessa regra para o último livro de origem.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 02,
03, 05 e 07. Não pode correr em paralelo com outro ticket da cadeia.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seção "Fontes do realizado, lidas nos livros de
origem".

**Blocked by:** 07 (saídas previstas e Contas a Pagar Vencidas), 036/15 — Baixa pela gaveta e seu
estorno.

**Status:** ready-for-agent

- [ ] Saídas realizadas de cada agrupamento somam o valor pago das Baixas na data do pagamento, com
      juros e multa somados e desconto abatido.
- [ ] Baixa estornada deixa de contar como saída.
- [ ] Baixa de valor pago zero não gera saída realizada e reduz a saída prevista da conta pelo
      principal abatido.
- [ ] Baixas contam pelo próprio estado de estorno, qualquer que seja o estado da Conta a Pagar.
- [ ] Baixa pela gaveta conta uma vez: o movimento de caixa correspondente não altera nenhum número
      do contrato.
- [ ] Detalhamento de cada agrupamento devolve Baixas pagas por Categoria de Despesa, e a aba as
      exibe no detalhamento.
- [ ] Nenhum índice é criado nas tabelas da spec 036; a consulta usa os índices que ela já criou.
- [ ] Adaptador Supabase converte os campos novos, com teste de campos ausentes.
- [ ] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado.
- [ ] `npm run test` e `npm run test:db` verdes.
