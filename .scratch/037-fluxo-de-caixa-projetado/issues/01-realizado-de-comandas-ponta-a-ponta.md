# 01: Realizado de Comandas ponta a ponta

**What to build:** o gestor abre a aba Fluxo de Caixa Projetado no Hub Financeiro e vê, num único
lugar, quanto a barbearia recebeu de Comandas, agrupado por dia, semana ou mês. Hoje o recebido do
dia vive na aba de Caixa, e qualquer visão de período exige somar à mão.

Este é o tracer bullet da spec: atravessa contrato de leitura, módulo e aba com a fonte mais simples
(pagamentos de Comanda), e deixa pronta a estrutura que os tickets seguintes só estendem. Entradas
realizadas são os pagamentos de Comandas fechadas, no dia de negócio do pagamento no fuso do tenant,
com o mesmo predicado de "recebido" do resumo financeiro diário. A tabela viva de pagamentos já está
líquida de estornos: reabrir a Comanda tira a entrada do dia original, e o arquivo de estornos não é
subtraído, senão o estorno contaria duas vezes.

O contrato é uma única leitura que devolve tudo o que a aba mostra, incluindo o fuso e o dia de
negócio de hoje calculados no banco. A tela nunca decide sozinha qual é o dia de hoje. A função
pública valida acesso e parâmetros, resolve "hoje" e delega a um núcleo privado que recebe "hoje"
como parâmetro, para que os testes que dependem do relógio sejam determinísticos. O campo de fluxo
pendente de cada agrupamento já existe aqui (nesta fatia, só realizado com data posterior a hoje) e
é estendido pelos tickets seguintes.

Não há realtime: o contrato agrega várias tabelas e reagir a cada pagamento refaria uma consulta
pesada durante o movimento da recepção. Não há adaptador em memória: o contrato é só de leitura e
um adaptador simulado cobre repositório e hook.

Spec: `specs/037-fluxo-de-caixa-projetado/spec.md`, seções "Fontes do realizado, lidas nos livros de
origem", "Períodos e agrupamento", "Contrato de leitura", "Índices", "Módulo" e "Tela".

**Blocked by:** 035/02 — Hub Financeiro em sub-rotas.

**Status:** ready-for-agent

- [x] Contrato de leitura do fluxo recebe tenant, data inicial, data final e granularidade, e
      devolve fuso, dia de negócio de hoje, agrupamentos e, em cada agrupamento, entradas
      realizadas, fluxo pendente e detalhamento de entradas por forma de pagamento.
- [x] Função pública em modo definidor com caminho de busca vazio, sem execução para público e
      anônimo, e com concessão a autenticado e serviço; núcleo privado recebe "hoje" como parâmetro.
- [x] O fuso é lido do tenant dentro da função, sem parâmetro de fuso vindo do cliente, e os limites
      de dia seguem o padrão do projeto (início do dia inicial até antes do dia seguinte ao final, no
      fuso do tenant).
- [x] Acesso: barbeiro recebe erro de acesso; gerente pedindo outro tenant é recusado; o
      `proprietario` recebe exatamente o tratamento das RPCs financeiras existentes (aceito para
      qualquer tenant, intencionalmente).
- [x] Validação com mensagens em pt-BR e código de erro de parâmetro inválido: datas nulas, fim antes
      do início, início depois de hoje, início antes de hoje − 365 dias, fim depois de hoje + 365
      dias, extensão acima de 366 dias, granularidade desconhecida e granularidade diária acima de 92
      dias.
- [x] Agrupamento: semanas começam na segunda-feira, meses são civis, primeiro e último agrupamento
      são recortados aos limites do período e cada agrupamento devolve as próprias datas de início e
      fim.
- [x] Cada agrupamento é classificado como passado (termina antes de hoje), atual (contém hoje) ou
      futuro (começa depois de hoje).
- [x] Entradas realizadas contam pagamentos de Comandas fechadas pelo valor gravado, já líquido de
      troco, no dia de negócio do pagamento.
- [x] Um pagamento às 23h30 no horário local cai no dia local, e não no dia UTC.
- [x] Uma Comanda reaberta deixa de contar como entrada, sem subtrair o arquivo de estornos.
- [x] Teste cruzado: a entrada de um dia é igual ao recebido do resumo financeiro diário no mesmo
      dia, e falha se as duas definições de "recebido" divergirem.
- [x] Somas feitas sem precisão fixa e arredondadas a duas casas só na saída, sem truncar valores de
      nenhuma origem.
- [x] Índice de pagamentos de Comanda por tenant e momento do pagamento criado na migração.
- [x] Nenhuma função existente é alterada.
- [x] Arquivo pgTAP novo do fluxo de caixa projetado cobrindo acesso, fuso, entradas realizadas,
      teste cruzado, agrupamento e cada limite de validação; casos dependentes de "hoje" usam o
      núcleo com relógio injetado, casos de acesso e de fuso usam a função pública.
- [x] Módulo do fluxo de caixa com interface do adaptador, repositório que valida período e
      granularidade com os mesmos limites do banco e rejeita com erro de validação próprio em pt-BR
      antes da ida à rede, adaptador Supabase que converte o retorno em números e tipos do domínio, e
      hook que recebe o repositório injetado e expõe dados, carregamento, erro e recarga.
- [x] Função pura de atalhos de período a partir do dia de hoje do tenant: próximos 30 dias (padrão,
      hoje a hoje + 29, dia), este mês (primeiro ao último dia, dia), próximos 3 meses (hoje a
      hoje + 89, semana), próximos 12 meses (hoje a hoje + 364, mês) e personalizado; mais sugestão de
      granularidade dentro dos limites.
- [x] Aba em `/financeiro/fluxo-de-caixa`, montada na estrutura de abas do Hub, composta por partes
      de responsabilidade única: filtros (atalho de período, datas, granularidade), resumo com
      cartão de entradas realizadas e tabela com uma linha por agrupamento.
- [x] Atalhos e datas iniciais usam o dia de hoje no fuso do tenant, nunca a data local do navegador;
      a classificação de agrupamento usa o dia de hoje devolvido pelo contrato.
- [x] Em largura de celular a tabela vira lista de cartões pela mesma composição responsiva, sem
      visão móvel separada, e a aba é alcançada pela navegação entre abas do Hub.
- [x] A aba recarrega ao mudar filtro, ao voltar o foco para a janela e pelo botão "Atualizar", sem
      assinatura em tempo real.
- [x] A aba usa sempre "recebido", nunca "faturamento".
- [x] O profissional não alcança a aba nem o contrato.
- [x] `CONTEXT.md` ganha o termo Fluxo de Caixa Projetado.
- [x] Testes de módulo: repositório com adaptador simulado (validação e mensagens), atalhos de
      período incluindo virada de mês e um instante em que o dia UTC já é outro, e adaptador Supabase
      (conversão de números e de campos ausentes) mockando o cliente Supabase como nos adaptadores
      existentes.
- [x] `npm run test` e `npm run test:db` verdes (o segundo, via MCP do Supabase — ver notas).

**Notas de implementação:**

- **Contrato (nomes que os tickets 02–08 estendem):** RPC pública
  `public.get_projected_cash_flow(p_tenant_id uuid, p_start_date date, p_end_date date, p_granularity text) returns jsonb`,
  delega para o núcleo `private.get_projected_cash_flow_core(p_tenant_id, p_start_date, p_end_date,
  p_granularity, p_today date, p_timezone text) returns jsonb`. Ambas em
  `supabase/migrations/20260913170000_fluxo_de_caixa_projetado_realizado_comandas.sql`. Nesta fatia o
  JSON devolvido é `{ timezone, business_today, buckets: [{ start_date, end_date, kind,
  inflow_realized, pending_flow, detail: { inflow_by_method: { dinheiro, pix, cartao, outros } } }] }`
  — os tickets seguintes acrescentam campos a `buckets[]` (inflow_estimated, outflow_*, mais detail) e
  as chaves de topo `estimate` e `undated_commitments`, sempre via `CREATE OR REPLACE FUNCTION` nas
  duas funções, numa migration nova.
- **Predicado de "recebido":** o núcleo lê só `public.comanda_pagamentos` (tenant + janela de
  `paid_at` no fuso), sem juntar com `comandas` nem filtrar por status — de propósito, para casar
  byte a byte com o predicado de `get_daily_financial_summary` (a reabertura de Comanda já apaga a
  linha viva). O teste cruzado (`31_fluxo_de_caixa_projetado.test.sql`) trava essa igualdade.
- **pgTAP:** arquivo novo `supabase/tests/database/31_fluxo_de_caixa_projetado.test.sql`, `plan(31)`.
  Os próximos tickets da spec 037 continuam a numeração a partir de `32_...` ou acrescentam casos
  aqui mesmo (a decidir por ticket) — qualquer um que estenda este arquivo deve ajustar o `plan()`.
  **Atenção pgTAP:** `throws_ok` na forma de 3 argumentos é `(sql, errcode, message)`, não
  `(sql, errcode, description)` — a descrição só existe na forma de 4 argumentos
  `(sql, errcode, message, description)`. Usar a forma de 3 sem saber disso faz todo `throws_ok` picar
  como "falha" mesmo com o erro certo (a mensagem virou o "wanted"); use sempre a forma de 4
  argumentos com a mensagem exata da exceção.
- **Migrations não aplicadas no DEV.** Testado via MCP `execute_sql` com `begin;` + as três migrations
  pendentes (`20260913100000`, `20260913110000`, a desta) + o conteúdo do arquivo pgTAP + `rollback;`,
  numa única chamada, exatamente como o protocolo pede. Confirmado com um SELECT pós-rollback que nada
  ficou persistido.
- **Rota nova:** `/financeiro/fluxo-de-caixa`, rota-filha direta de `/financeiro` (irmã do bloco que
  envolve `FinanceiroPainel`), **fora** do `PainelLayout` — filtro de período próprio, não o "Este mês
  / Últimos 30 / Últimos 90 dias" do painel de Caixa e Comissões. Link novo em `HubLayout.tsx`
  (`ChartLineData01Icon`).
- **Módulo `src/modules/fluxo-caixa/`:** `types.ts` (contrato do domínio), `FluxoCaixaRepository.ts`
  (`FluxoCaixaValidationError`), `calendario.ts` (aritmética de data compartilhada — `parseDateOnly`,
  `calendarExtentInDays` — usada pelo repositório e por `periodo.ts`, achado do code review para não
  duplicar a contagem de dias), `periodo.ts` (`getFluxoCaixaPeriodShortcutRange`,
  `suggestFluxoCaixaGranularity`, `isGranularityWithinLimits`), `adapters/SupabaseFluxoCaixaAdapter.ts`,
  `useFluxoCaixa.ts` (hook com guarda contra resposta obsoleta — a chamada mais recente sempre vence,
  achado do code review).
- **Tela:** `src/pages/gerente/financeiro/FluxoCaixaTab.tsx` (dono do estado de filtro) +
  `src/pages/gerente/financeiro/fluxo-caixa/{FluxoCaixaFiltros,FluxoCaixaResumo,FluxoCaixaTabela,
  FluxoCaixa.css}`. A granularidade só é editável em modo "Personalizado"; ao editar as datas nesse
  modo, a escolha manual do gestor é preservada e só cai para a sugestão automática se deixar de caber
  no novo período (achado do code review).
- **Fora de escopo desta fatia** (ticket 01), confirmado: saídas realizadas, entradas estimadas,
  saídas previstas, Compromissos sem Data, curva/saldo informado, gráfico, Drawer de detalhamento e a
  ADR 021 (ticket 04). `pending_flow`, nesta fatia, é só o realizado com data posterior a hoje.
