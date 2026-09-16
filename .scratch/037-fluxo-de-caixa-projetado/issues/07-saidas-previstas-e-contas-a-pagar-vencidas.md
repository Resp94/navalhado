# 07: Saídas previstas e Contas a Pagar Vencidas

**What to build:** o gestor passa a ver o que ainda vai sair: cada Conta a Pagar em aberto aparece
como Saída Prevista na data de vencimento, pelo saldo restante. Uma conta paga em parte não é contada
inteira, e uma conta cancelada não pesa na projeção.

As Contas a Pagar Vencidas e ainda não pagas entram no período que contém hoje, destacadas como
atrasadas e com a data original de vencimento no detalhamento. Sumir com uma dívida porque ela venceu
no passado é o erro mais caro que um fluxo de caixa pode cometer. Previstas e vencidas ficam em campos
separados e nenhuma conta é contada nos dois. Juros e multa de atraso futuros não são projetados:
só existem quando a Baixa acontece.

O saldo restante é o valor da conta menos o valor baixado, e por isso este ticket depende das Baixas
da spec 036, e não só do livro de Contas a Pagar.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 02,
03, 05 e 08. Não pode correr em paralelo com outro ticket da cadeia.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seções "Dependência e posição na sequência" e
"Saídas previstas".

**Blocked by:** 05 (Compromissos sem Data), 06 (gráfico e detalhamento), 036/07 — Baixa fora do
caixa e Estorno de Baixa.

**Status:** done

- [x] Toda Conta a Pagar em aberto ou parcialmente paga gera saída prevista pelo saldo restante, no
      agrupamento que contém o vencimento, quando o vencimento é hoje ou depois.
- [x] Conta parcialmente paga é prevista pelo saldo restante, e não pelo valor inteiro.
- [x] Contas pagas e canceladas não geram previsão; conta cancelada não aparece no fluxo.
- [x] Conta vencida (em aberto ou parcialmente paga, com vencimento anterior ao dia de negócio de
      hoje) entra só no agrupamento atual, no campo de vencidas, marcada como atrasada.
- [x] Nenhuma conta aparece ao mesmo tempo em saídas previstas e vencidas.
- [x] Conta com vencimento depois do fim do período não aparece.
- [x] Juros e multa futuros não são projetados.
- [x] Saídas previstas e vencidas entram no fluxo pendente do agrupamento, e a curva passa a
      considerá-las.
- [x] Um período inteiramente passado não devolve previsão nem vencidas.
- [x] Detalhamento devolve a lista de Contas a Pagar previstas com descrição, saldo restante,
      vencimento original e marca de atrasada.
- [x] Na aba, cartão de saídas previstas no resumo com vencidas em destaque; valores previstos com
      rótulo textual "previsto" e, no gráfico, preenchimento distinto com legenda.
- [x] No detalhamento, cada Conta a Pagar prevista leva à própria conta na aba de Contas a Pagar.
- [x] Teste da aba com repositório falso injetado cobre o destaque de vencidas.
- [x] Adaptador Supabase converte os campos novos e a lista de previstas.
- [x] `CONTEXT.md` ganha o termo Saída Prevista.
- [x] Casos adicionados ao arquivo pgTAP do fluxo de caixa projetado, usando o núcleo com relógio
      injetado para as vencidas.
- [x] `npm run test` e `npm run test:db` verdes.

**Notas de implementação:**

- **Migration:** `supabase/migrations/20260914200000_fluxo_de_caixa_projetado_saidas_previstas_e_vencidas.sql`
  -- `create or replace` das duas funções (mesma assinatura dos tickets 01-05). Sem índice novo (a
  consulta a `public.payables` usa os índices que a spec 036 já criou, `idx_payables_tenant_due_date`
  e `idx_payables_tenant_due_date_open`).
- **`payables_relevant` (CTE nova):** uma linha por Conta a Pagar em aberto/parcialmente paga do
  tenant, com `remaining_amount = amount - paid_amount`, `overdue = due_date < p_today`, e uma
  `assigned_date` -- o próprio vencimento quando é hoje ou depois (prevista), sempre `p_today` quando
  já passou (vencida). Juntar essa `assigned_date` contra o intervalo de cada bucket resolve as duas
  regras de uma vez: `p_today` só cai dentro de algum bucket quando o período pedido tem um
  agrupamento "atual" (`p_end_date >= p_today`), então um período inteiramente passado (`p_end_date <
  p_today`) não tem bucket nenhum para juntar a vencida, e a prevista (vencimento sempre >= p_today >
  p_end_date nesse caso) também nunca cai no período -- as duas regras do checklist saem da mesma
  junção, sem `if` separado.
- **`bucket_payables` e `bucket_payables_list`:** somam `outflow_forecast`/`outflow_overdue` por
  bucket (filtrando por `overdue`) e agregam a lista `payables_forecast` (jsonb, ordenada por
  vencimento e descrição) com `payable_id`, `description`, `remaining_amount`, `due_date`, `overdue`.
  `pending_flow` passa a subtrair as duas por inteiro (não só a parte "futura" como o realizado --
  nenhuma das duas já saiu da gaveta, então mesmo a prevista vencendo hoje conta como pendente).
- **pgTAP:** `supabase/tests/database/31_fluxo_de_caixa_projetado.test.sql`, plano 40 -> 46. Seção
  `ticket37_context` própria (tenant/gerente dedicados, "hoje" fixo em `2026-08-15`), seis Contas a
  Pagar cobrindo cada regra do checklist (prevista futura, prevista vencendo hoje, vencida, paga,
  cancelada, fora do período). Validado em transação revertida antes de aplicar (46/46) e de novo
  contra as funções já aplicadas no DEV como porta de regressão final (46/46).
- **Frontend:** `FluxoCaixaBucket` ganha `outflow_forecast`/`outflow_overdue`; `FluxoCaixaBucketDetail`
  ganha `payables_forecast: FluxoCaixaPayableForecast[]`. `curva.ts` -- `resultadoDoBucket` deixa de
  usar o tipo local opcional `FluxoCaixaBucketComPrevisao` (criado no ticket 04 como placeholder) e lê
  os campos reais direto do contrato. `FluxoCaixaValorPrevisto.tsx` (novo): mesmo padrão do
  `FluxoCaixaValorEstimado` -- valor sempre com rótulo textual "previsto"/"vencido" ao lado, nunca só
  cor. Coluna "Previsto" na tabela; cartão "Saídas previstas" no resumo com o total vencido destacado
  (mesma classe `fluxo-caixa-saldo-negativo` do primeiro período negativo) quando > 0. No gráfico, a
  barra de saída ganha dois segmentos empilhados a mais (prevista com hachura em ângulo oposto ao da
  estimativa, vencida com hachura própria), cada um só aparece quando > 0, com legenda textual. No
  detalhamento, seção "Contas a Pagar previstas e vencidas" lista cada conta com vencimento e a marca
  "vencido", e um link "Ver na aba de Contas a Pagar" -- mesmo padrão do link de Compromissos sem Data
  para a aba de Comissões (ticket 05); a tela de Contas a Pagar não tem deep-link por id ainda, então o
  link vai para a aba, não para a conta específica.
- **Teste:** `curva.test.ts` ganhou um caso confirmando que `outflow_forecast`/`outflow_overdue` entram
  no resultado do bucket. Nenhum arquivo de teste novo para os componentes de tela (mesma disciplina do
  ticket 06); `FluxoCaixaTab.test.tsx` não precisou de caso novo porque nenhum dos seus quatro testes
  existentes dependia dos campos novos além de precisar declará-los nos fixtures (agora obrigatórios,
  não mais opcionais).
- `npm run test`: verde (ver commit). `npx tsc --noEmit`: sem erros.
