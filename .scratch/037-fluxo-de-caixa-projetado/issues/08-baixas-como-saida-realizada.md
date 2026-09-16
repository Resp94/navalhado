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

**Status:** done

- [x] Saídas realizadas de cada agrupamento somam o valor pago das Baixas na data do pagamento, com
      juros e multa somados e desconto abatido.
- [x] Baixa estornada deixa de contar como saída.
- [x] Baixa de valor pago zero não gera saída realizada e reduz a saída prevista da conta pelo
      principal abatido.
- [x] Baixas contam pelo próprio estado de estorno, qualquer que seja o estado da Conta a Pagar.
- [x] Baixa pela gaveta conta uma vez: o movimento de caixa correspondente não altera nenhum número
      do contrato.
- [x] Detalhamento de cada agrupamento devolve Baixas pagas por Categoria de Despesa, e a aba as
      exibe no detalhamento.
- [x] Nenhum índice é criado nas tabelas da spec 036; a consulta usa os índices que ela já criou.
- [x] Adaptador Supabase converte os campos novos, com teste de campos ausentes.
- [x] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado.
- [x] `npm run test` e `npm run test:db` verdes.

**Notas de implementação:**

- **Migration:** `supabase/migrations/20260914210000_fluxo_de_caixa_projetado_baixas_como_saida_realizada.sql`
  -- `create or replace` das duas funções (mesma assinatura dos tickets 01-07), última da cadeia
  sequencial. Sem índice novo -- a consulta a `public.payable_settlements` usa
  `idx_payable_settlements_tenant_payment_date_active` (tenant_id, payment_date, `where reversed_at is
  null`), já criado pela spec 036.
- **`daily_settlements` (CTE nova):** `payment_date` já é uma data de negócio (coluna `date`, não
  `timestamptz`), e `settle_payable` recusa data futura -- por isso, ao contrário de
  `daily_payouts`/`daily_advances`, não precisa de filtro de "pendente" nenhum, só entra direto em
  `outflow_realized`. Soma `paid_amount` (coluna gerada de `payable_settlements`, já
  `principal + interest_amount - discount_amount`), sem recompor a fórmula. Filtra só por
  `reversed_at is null`, nunca pelo `status` da Conta a Pagar (join com `payables` é só para pegar
  `category_id`) -- confirmado por smoke test com uma Baixa numa conta já `'paid'`, que contou do mesmo
  jeito.
- **`settings_by_category`:** agregação por bucket via `left join lateral`, mesmo padrão de
  `payouts_by_professional`/`advances_by_professional` (isolada antes de juntar, para não repetir o
  cartesiano já documentado nos tickets anteriores).
- **Achado confirmado por smoke test (não exigiu mudança no ticket 07):** `settle_payable` incrementa
  `payables.paid_amount` pelo **principal** da Baixa, nunca pelo `paid_amount` líquido -- então uma
  Baixa de valor pago zero (principal todo abatido por desconto) já reduz corretamente o saldo restante
  (e a Saída Prevista) sem precisar tocar o CTE `payables_relevant` do ticket 07.
- **Baixa pela gaveta conta uma vez:** confirmado por smoke test e por caso pgTAP dedicado -- um
  `cash_movement` de sangria com valor *diferente* (999) do principal da Baixa (20) na mesma sessão de
  caixa, para provar que um eventual vazamento para `cash_movements` apareceria imediatamente como
  soma errada. `outflow_realized` bateu exatamente com o principal da Baixa, nunca com o movimento.
- **pgTAP:** `supabase/tests/database/31_fluxo_de_caixa_projetado.test.sql`, plano 46 -> 52. Seção
  `ticket38_context` própria (tenant/gerente/categorias dedicados, "hoje" fixo em `2026-09-01`), duas
  Contas a Pagar e cinco Baixas cobrindo cada regra do checklist. Validado em transação revertida antes
  de aplicar (52/52) e de novo contra as funções já aplicadas no DEV como porta de regressão final
  (52/52).
- **Frontend:** `FluxoCaixaBucketDetail` ganha `settlements_by_category: FluxoCaixaValorPorCategoria[]`;
  comentário de `outflow_realized` em `types.ts` atualizado. `FluxoCaixaDetalheDrawer` ganha a seção
  "Baixas pagas por Categoria de Despesa". Nenhuma mudança em `FluxoCaixaResumo`/`FluxoCaixaTabela`/
  `FluxoCaixaGrafico` -- todos já exibem `outflow_realized` como um total só, que agora inclui as
  Baixas automaticamente, sem precisar saber a origem.
- `npm run test`: verde (ver commit). `npx tsc --noEmit`: sem erros. Spec 037 completa -- todos os 8
  tickets fechados.
