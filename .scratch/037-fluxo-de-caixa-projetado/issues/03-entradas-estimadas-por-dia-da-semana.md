# 03: Entradas estimadas por dia da semana

**What to build:** o gestor passa a ver quanto deve entrar em cada dia futuro, com base no que a
barbearia costuma receber naquele dia da semana. Hoje ele sabe que sábado é forte e segunda é fraca,
mas faz a conta de cabeça.

A Entrada Estimada de um dia futuro é a média do recebido nas N ocorrências mais recentes do mesmo
dia da semana, com N limitado a 8. A janela são os N × 7 dias de negócio imediatamente anteriores a
hoje, o que dá a cada dia da semana exatamente N amostras em dias inteiros, sem escolher em que dia a
semana começa. Dias sem recebimento na janela entram como zero. N vem do histórico real, contado a
partir do primeiro dia com pagamento de Comanda vivo, para que o intervalo entre o cadastro e o
primeiro atendimento não vire semanas de zero. Com menos de 4 semanas não há estimativa: um único
dia atípico dominaria a média.

Dias em que a barbearia está fechada pelo horário de funcionamento configurado valem zero, mesmo com
histórico. Dia ausente na configuração é lido como fechado, como a agenda já faz. Hoje não recebe
estimativa: somar a média do dia inteiro ao que já entrou de manhã duplicaria receita, e a projeção
fica deliberadamente conservadora. Feriados, sazonalidade e tendência ficam fora. A estimativa é
calculada a cada consulta e nunca gravada.

A estimativa aparece sempre rotulada e visualmente distinta do realizado, como variante explícita, e
a tela lembra que ela não desconta as comissões que essa receita vai gerar.

**Cadeia sequencial:** este ticket redefine a mesma função de leitura do fluxo que os tickets 01, 02,
05, 07 e 08. Não pode correr em paralelo com outro ticket da cadeia.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seção "Entradas estimadas: média por dia da
semana".

**Blocked by:** 02 (Quitações de Comissão e vales como saída realizada).

**Status:** done

- [x] Contrato devolve o estado da estimativa (ok ou histórico insuficiente), o número de semanas
      usadas e as sete médias por dia da semana, para que a tela rotule sem recalcular.
- [x] Média com 8 semanas: soma do recebido do dia da semana na janela dividida por 8, arredondada a
      duas casas.
- [x] Média com N entre 4 e 7 usa N semanas e devolve o número de semanas usadas correto.
- [x] Com N abaixo de 4 o estado é histórico insuficiente e as entradas estimadas futuras ficam
      vazias, e não zeradas.
- [x] N é contado a partir do primeiro dia de negócio com pagamento de Comanda vivo no tenant, e não
      da criação do tenant.
- [x] Dias sem recebimento dentro da janela contam como zero na média.
- [x] Dia marcado como inativo, ou ausente, no horário de funcionamento do tenant tem estimativa zero.
- [x] Hoje fica fora da janela e não recebe estimativa; a estimativa começa amanhã.
- [x] Agrupamentos somam a entrada estimada dos seus dias futuros, e o detalhamento devolve dias
      estimados e dias fechados.
- [x] Entradas estimadas entram no fluxo pendente do agrupamento.
- [x] Um período inteiramente passado não devolve estimativa.
- [x] Na aba, todo número estimado leva o rótulo textual "estimado" e é uma variante explícita de
      exibição, não um atributo booleano espalhado; a distinção nunca depende só de cor.
- [x] Cartão de entradas estimadas no resumo e coluna estimada na tabela e nos cartões de celular.
- [x] Avisos: "histórico insuficiente para estimar entradas" ou "estimativa baseada em N semanas";
      "a estimativa de entradas não desconta comissões que essa receita vai gerar"; "hoje mostra
      apenas o realizado".
- [x] Teste da aba com repositório falso injetado cobre o rótulo de estimativa visível e o aviso de
      histórico insuficiente.
- [x] Adaptador Supabase converte o objeto de estimativa e os campos novos.
- [x] `CONTEXT.md` ganha o termo Entrada Estimada.
- [x] Casos de estimativa adicionados ao arquivo pgTAP do fluxo de caixa projetado, usando o núcleo
      com relógio injetado.
- [x] `npm run test` e `npm run test:db` verdes.

**Notas de implementação:**

- **Migration:** `supabase/migrations/20260914180000_fluxo_de_caixa_projetado_entradas_estimadas.sql`
  — `create or replace` das duas funções (mesma assinatura dos tickets 01/02). Sem índice novo:
  a consulta de histórico já usa `comanda_pagamentos_tenant_paid_at_idx` (ticket 01).
- **Achado corrigido antes de aplicar no DEV (não estava no plano original):** o ticket 01 nunca tinha
  sido de fato aplicado no DEV (só testado via MCP em rollback em sessão anterior), então a migration
  do ticket 03 (que já assume as funções do ticket 01/02 existentes) foi aplicada só depois de aplicar
  as duas anteriores nesta mesma sessão, na ordem correta.
- **N (semanas usadas):** `floor((hoje − primeiro pagamento de Comanda do tenant) / 7)`, capado em 8,
  lido de `comanda_pagamentos` sem filtro de período (independe de `p_start_date`/`p_end_date`).
  Abaixo de 4, `status = 'insufficient_history'`.
- **Janela das médias:** `[hoje − N×7, hoje − 1]`, hoje sempre fora. Sete médias (`v_avg_mon`..`v_avg_sun`)
  calculadas com `extract(dow from ...)` (0=domingo) e `filter` por dia da semana, cada uma
  `sum(...) / N` arredondada a 2 casas -- dia sem recebimento já soma zero por causa do `coalesce`.
- **Horário de funcionamento:** `tenants.business_hours` (chaves em português: `segunda`..`domingo`,
  campo `active`); dia ausente ou sem `active` lido como fechado via `coalesce(..., false)`, mesma
  leitura que a agenda já faz.
- **`inflow_estimated` nulo vs. zero:** `case when v_status <> 'ok' and estimated_days > 0 then null
  else round(inflow_estimated_raw, 2) end` -- nulo só quando o histórico é insuficiente E há pelo
  menos um dia futuro ativo no agrupamento (haveria o que estimar, mas não dá pra confiar); zero
  quando não há dia futuro ativo nenhum (agrupamento todo passado, ou só dias fechados), porque aí não
  há mesmo nada a estimar. `estimated_days`/`closed_days` sempre contam a partir do horário de
  funcionamento, independente do status.
- **Cartesian product (mesmo padrão do ticket 02):** `daily_estimate` virou mais uma fonte "many rows
  per bucket", agregada em sua própria CTE `bucket_estimate` antes de juntar às demais por
  `bucket_start`/`bucket_end` -- confirmado por smoke test via MCP antes de escrever o pgTAP.
- **pgTAP:** casos novos no mesmo arquivo dos tickets 01/02
  (`supabase/tests/database/31_fluxo_de_caixa_projetado.test.sql`), plano 34 → 38. Dois tenants novos
  de contexto (`ticket33_context` com 8 semanas de histórico e horário próprio; `ticket33_insuf_context`
  com 2 semanas). **Atenção:** o contrato exige `p_start_date <= p_today` sempre -- para testar um
  agrupamento futuro é preciso incluir "hoje" no início do período pedido (não só o agrupamento futuro
  isolado), e filtrar o bucket específico por `start_date` quando o período gerar mais de um
  agrupamento (achado ao rodar o smoke test: `throws_ok` "A data inicial não pode ser posterior a
  hoje." e depois "more than one row returned by a subquery" até ajustar as datas).
- **Frontend:** `FluxoCaixaBucket.inflow_estimated` (`number | null`), `FluxoCaixaEstimate` (`status`,
  `weeks_used`, `weekday_averages`) e `detail.estimated_days`/`closed_days` novos em `types.ts`;
  `SupabaseFluxoCaixaAdapter` converte com `toNullableNumber`/`toWeekdayAverages`/`toEstimate`;
  `FluxoCaixaValorEstimado.tsx` (novo) é o componente compartilhado que sempre mostra o rótulo textual
  "estimado" ao lado do valor (nunca só cor), usado no cartão de resumo e na coluna da tabela;
  `FluxoCaixaResumo` ganha o cartão "Entradas estimadas" e os avisos; `FluxoCaixaTab` ganha suporte a
  repositório injetado (`repository?: FluxoCaixaRepository`, como os demais componentes de aba) para o
  teste com adaptador falso.
