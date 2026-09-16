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

**Status:** done

- [x] Saídas realizadas de cada agrupamento somam Quitações de Comissão pelo valor pago, no dia de
      negócio do pagamento, sem o valor de abate de vale.
- [x] Quitação estornada deixa de contar como saída.
- [x] Vales contam pelo valor no dia de negócio da criação, qualquer que seja a forma de pagamento.
- [x] Vale estornado deixa de contar como saída.
- [x] Vale abatido numa Quitação de Comissão não conta de novo: o dinheiro que saiu uma vez aparece
      uma vez só.
- [x] Quitações antigas, sem rateio, contam pelo valor pago.
- [x] Sangria e suprimento registrados no período não alteram nenhum número do contrato; sobras,
      quebras, ajustes de sessão de caixa e entradas de estoque também ficam de fora.
- [x] Uma Quitação com data de pagamento posterior a hoje entra no fluxo pendente do agrupamento.
- [x] Detalhamento de cada agrupamento devolve quitações por profissional e vales por profissional.
- [x] Índice parcial de Quitações de Comissão por tenant e data de pagamento, restrito às não
      estornadas, criado na migração.
- [x] Aba mostra o cartão de saídas realizadas no resumo e a saída realizada em cada linha da tabela
      e em cada cartão de celular.
- [x] Adaptador Supabase converte os campos novos, com teste de campos ausentes.
- [x] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado criado no ticket 01.
- [x] `npm run test` e `npm run test:db` verdes.

**Notas de implementação:**

- **Migration:** `supabase/migrations/20260914170000_fluxo_de_caixa_projetado_saidas_quitacao_vale.sql`
  — `create or replace` das duas funções do ticket 01, mesma assinatura. Índice novo
  `commission_payouts_tenant_paid_at_idx` (parcial, `where reversed_at is null`);
  `professional_account_entries (tenant_id, created_at)` já existia (spec 034).
- **Achado corrigido antes de aplicar no DEV (não estava no plano original):** juntar
  `daily_agg`/`payouts_agg`/`advances_agg` (cada um podendo ter várias linhas por bucket) num único
  `GROUP BY` produz produto cartesiano e multiplica as três somas sempre que mais de uma fonte tiver
  mais de um dia no mesmo agrupamento. Pego por um teste manual via MCP antes de escrever o pgTAP
  (outflow saiu 360 em vez de 180 com dois profissionais e datas diferentes). Corrigido agregando cada
  fonte em CTEs `bucket_inflow` / `bucket_payouts` / `bucket_advances` isoladas (uma linha por bucket
  cada) e só então juntando por `bucket_start`/`bucket_end`.
- **`pending_flow`:** estendido para `inflow_pending − payouts_pending − advances_pending` (entrada
  futura soma, saída futura subtrai), conforme a spec ("qualquer realizado com data posterior a
  hoje").
- **Detalhamento por profissional:** `payouts_by_professional` / `advances_by_professional`, arrays de
  `{professional_id, professional_name, amount}` ordenados por nome, agregados por bucket via
  `left join lateral` sobre CTEs diárias por profissional (mesmo cuidado de não juntar fontes
  "many-rows" direto).
- **Migration do ticket 01 nunca tinha sido de fato aplicada no DEV** (só testada via MCP em
  begin/rollback em sessão anterior) — foi aplicada nesta sessão antes da do ticket 02, na ordem
  correta.
- **pgTAP:** casos novos acrescentados ao mesmo arquivo do ticket 01
  (`supabase/tests/database/31_fluxo_de_caixa_projetado.test.sql`), plano 31 → 34. Contexto próprio em
  julho/2026 (`ticket32_context`) para não colidir com as datas de junho já usadas pelo ticket 01.
  Validado com `begin`/`rollback` via MCP antes de aplicar, e revalidado ao vivo contra o DEV depois
  da aplicação (arquivo real, sem redefinição inline das funções).
- **Frontend:** `FluxoCaixaBucket.outflow_realized` e `FluxoCaixaBucketDetail.payouts_by_professional`
  /`advances_by_professional` novos em `types.ts`; `SupabaseFluxoCaixaAdapter` converte os campos
  novos (`toValoresPorProfissional`, testado com campos ausentes); `FluxoCaixaResumo` ganha o cartão
  "Saídas realizadas"; `FluxoCaixaTabela` ganha a coluna "Saída realizada".
