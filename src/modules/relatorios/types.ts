/**
 * Tipos de domínio do Módulo de Relatórios (spec 038). Nasceu no ticket 01
 * só com o relatório de Faturamento por período (`get_revenue_report`); o
 * ticket 05 estende este mesmo arquivo com Equipe e Serviços
 * (`get_team_services_report`) -- cada contrato ganha sua própria
 * interface aqui, nunca reaproveitando `RelatorioFaturamento` para outra
 * forma de dado. Os dois contratos restantes (Agenda, Clientes/Clientes
 * sem Retorno) chegam nos tickets seguintes do mesmo jeito.
 */

export type RelatoriosGranularity = 'day' | 'week' | 'month';

/**
 * Qualidade do dado do período, na mesma classificação de
 * `get_tenant_financial_metrics`: `confirmed` (tudo com snapshot completo),
 * `estimated` (snapshot parcial), `legacy` (sem snapshot, dado histórico),
 * `mixed` (mistura dos três) ou `unavailable` (nenhuma Comanda fechada no
 * período).
 */
export type RelatoriosDataQualityStatus = 'confirmed' | 'estimated' | 'legacy' | 'mixed' | 'unavailable';

export interface RelatoriosDataQuality {
  status: RelatoriosDataQualityStatus;
  confirmed_comandas: number;
  estimated_comandas: number;
  legacy_comandas: number;
}

export interface RelatoriosPeriodo {
  start: string;
  end: string;
}

/**
 * Totais de faturamento de um período ou de um agrupamento: bruto,
 * descontos, líquido, líquido de serviços, líquido de produtos, gorjetas
 * (fora do faturamento) e Comandas fechadas.
 */
export interface RelatorioFaturamentoTotais {
  gross: number;
  discounts: number;
  net: number;
  services_net: number;
  products_net: number;
  tips: number;
  closed_comandas: number;
  /**
   * Líquido reconhecido / Comandas fechadas com ao menos um item
   * reconhecido (spec 038, ticket 03). `null` quando não há Comanda com
   * item reconhecido no período/agrupamento -- ticket vazio, nunca zero,
   * para um período fechado não parecer um período de ticket ruim.
   */
  average_ticket: number | null;
  received_total: number;
}

/**
 * Ticket por profissional (spec 038, ticket 03, histórias 30-31): todos os
 * profissionais com ao menos um item reconhecido no período, inclusive
 * inativos e arquivados. Uma Comanda dividida entre profissionais conta
 * uma Comanda distinta para cada um -- a tela avisa isso.
 */
export interface TicketPorProfissional {
  professional_id: string;
  name: string;
  is_active: boolean;
  archived: boolean;
  net: number;
  comandas: number;
  average_ticket: number | null;
}

/**
 * Recebido por forma de pagamento (spec 038, ticket 02). No nível do
 * período (`received_by_method`, topo do contrato) `share` é a
 * participação da forma no recebido total do período -- `null` quando o
 * período não teve recebimento (nunca divisão por zero). No nível do
 * agrupamento (`RelatorioFaturamentoBucket.received_by_method`) não há
 * `share`: a spec só pede participação para o período inteiro.
 */
export interface RelatorioRecebidoPorForma {
  method: string;
  label: string;
  amount: number;
  payments_count: number;
  share: number | null;
}

export type RelatorioRecebidoPorFormaBucket = Omit<RelatorioRecebidoPorForma, 'share'>;

/**
 * Um agrupamento (dia/semana/mês) não tem `received_total`: o campo do
 * período inteiro é `totals.received_total` (topo do contrato); o
 * agrupamento tem `received`, o recebido daquele agrupamento específico.
 */
export interface RelatorioFaturamentoBucket extends Omit<RelatorioFaturamentoTotais, 'received_total'> {
  start_date: string;
  end_date: string;
  received: number;
  received_by_method: RelatorioRecebidoPorFormaBucket[];
}

/**
 * Contrato de leitura do Faturamento por período (`get_revenue_report`,
 * spec 038, relatórios 1-3 -- este ticket cobre só o relatório 1).
 * `timezone` e `business_today` vêm do banco: a tela nunca decide sozinha
 * qual é o dia de hoje.
 */
export interface RelatorioFaturamento {
  timezone: string;
  business_today: string;
  period: RelatoriosPeriodo;
  previous_period: RelatoriosPeriodo;
  data_quality: RelatoriosDataQuality;
  totals: RelatorioFaturamentoTotais;
  previous_totals: RelatorioFaturamentoTotais;
  received_by_method: RelatorioRecebidoPorForma[];
  buckets: RelatorioFaturamentoBucket[];
  ticket_by_professional: TicketPorProfissional[];
}

export interface ObterFaturamentoPorPeriodoInput {
  tenantId: string;
  startDate: string;
  endDate: string;
  granularity: RelatoriosGranularity;
}

/**
 * Ranking de profissionais da página Equipe e Serviços (spec 038, ticket
 * 05, histórias 32-37): todos os profissionais com item reconhecido no
 * período, inclusive inativos e arquivados -- diferente do painel de Caixa
 * e Comissões, que lista só os ativos. `share` é a participação no líquido
 * total (`totals.net`), `null` quando o total é zero (nunca dividido por
 * zero). `average_ticket` é o líquido do profissional dividido pelos
 * atendimentos dele (Comandas distintas com item de serviço), `null` sem
 * atendimento -- venda só de produto tem `attendances` 0 e
 * `average_ticket` nulo, mas ainda aparece com `products_net` e
 * `commission`. `commission` é a comissão gerada (snapshot), não a paga.
 */
export interface ProfissionalRanking {
  professional_id: string;
  name: string;
  is_active: boolean;
  archived: boolean;
  net: number;
  gross: number;
  share: number | null;
  attendances: number;
  services_quantity: number;
  products_net: number;
  average_ticket: number | null;
  commission: number;
}

/**
 * Ranking de serviços da página Equipe e Serviços (spec 038, ticket 05):
 * todos os serviços executados no período, inclusive arquivados. `share` é
 * a participação no líquido de serviços do período (`totals.services_net`),
 * `null` quando esse total é zero. `average_unit_net` é o líquido dividido
 * pela quantidade, `null` sem quantidade. `p_professional_id` (opcional)
 * filtra só esta lista -- o ranking de profissionais nunca é filtrado.
 */
export interface ServicoRanking {
  service_id: string;
  name: string;
  category: string;
  archived: boolean;
  quantity: number;
  net: number;
  share: number | null;
  average_unit_net: number | null;
}

/**
 * Totais do relatório de Equipe e Serviços: líquido, líquido de serviços e
 * atendimentos do período inteiro -- a mesma base que soma exatamente o
 * líquido/atendimentos da lista de profissionais (reconciliação por
 * construção, ver comentário da migração do ticket 05).
 */
export interface RelatorioEquipeServicosTotais {
  net: number;
  services_net: number;
  attendances: number;
}

/**
 * Contrato de leitura de Equipe e Serviços (`get_team_services_report`,
 * spec 038, relatórios 4-5, ticket 05). Sem `granularity` e sem
 * `previous_period`: é um ranking de período único, mais simples que o
 * Faturamento -- interface própria, nunca reaproveitando
 * `RelatorioFaturamento`.
 */
export interface RelatorioEquipeServicos {
  timezone: string;
  business_today: string;
  period: RelatoriosPeriodo;
  data_quality: RelatoriosDataQuality;
  professionals: ProfissionalRanking[];
  services: ServicoRanking[];
  totals: RelatorioEquipeServicosTotais;
}

export interface ObterEquipeEServicosInput {
  tenantId: string;
  startDate: string;
  endDate: string;
  /** Filtra só `services[]` -- o ranking de profissionais nunca é filtrado. */
  professionalId?: string;
}

/**
 * Totais por status de um período (atual ou anterior) do relatório de
 * Agenda (`get_schedule_report`, spec 038, ticket 07). `unresolved`
 * (Agendamento sem Desfecho) é o pendente/confirmado/em andamento com
 * início já passado -- fica fora das duas taxas. `future` é o mesmo grupo
 * de status com início ainda não chegado -- também fora das taxas.
 * `attendance_rate` = concluídos / (concluídos + faltas); `cancellation_rate`
 * = cancelados / (total - futuros); ambas `null` com denominador zero,
 * nunca `0`.
 */
export interface RelatorioAgendaStatusTotais {
  total: number;
  completed: number;
  no_show: number;
  canceled: number;
  unresolved: number;
  future: number;
  attendance_rate: number | null;
  cancellation_rate: number | null;
}

export type RelatorioAgendaOrigem = 'manual' | 'whatsapp' | 'client_channel' | 'online';

/**
 * Totais por origem do Agendamento (spec 038, ticket 07): sem `future` (a
 * spec não pede futuros por origem) e sem `cancellation_rate` (a taxa de
 * cancelamento só existe no nível do período inteiro).
 */
export interface RelatorioAgendaOrigemTotais {
  origin: RelatorioAgendaOrigem;
  total: number;
  completed: number;
  no_show: number;
  canceled: number;
  unresolved: number;
  attendance_rate: number | null;
}

/**
 * Totais por profissional do relatório de Agenda: SEMPRE a lista inteira
 * do tenant no período, nunca filtrada por `p_professional_id` -- o
 * inverso da regra do ticket 05/06 (lá, o filtro nunca atingia o ranking
 * de profissionais; aqui, o filtro atinge tudo, menos esta lista).
 * Inativos e arquivados com Agendamento no período aparecem marcados.
 */
export interface RelatorioAgendaProfissionalTotais {
  professional_id: string;
  name: string;
  is_active: boolean;
  archived: boolean;
  total: number;
  completed: number;
  no_show: number;
  canceled: number;
  unresolved: number;
  attendance_rate: number | null;
}

/**
 * Motivo de cancelamento normalizado (trim + minúsculas) e contado (spec
 * 038, ticket 07): vazio vira "sem motivo informado", dez primeiros mais
 * frequentes seguidos de "outros" quando sobra resto.
 */
export interface RelatorioAgendaMotivoCancelamento {
  reason: string;
  count: number;
}

/**
 * Célula do mapa de calor da Agenda (spec 038, ticket 08): `weekday` usa a
 * convenção nativa do Postgres (`extract(dow)`), `0` = domingo até `6` =
 * sábado -- nunca a convenção ISO (segunda = 1). `count` é sempre um
 * inteiro presente (nunca `null`): conta Agendamento não cancelado (falta
 * conta) no fuso do tenant. O núcleo do banco só devolve combinações com
 * pelo menos 1 Agendamento -- uma combinação ausente vale `0`, e cabe à
 * tela cruzar `hours` x os 7 dias para desenhar a grade completa.
 */
export interface RelatorioAgendaHeatmapCelula {
  weekday: number;
  hour: number;
  count: number;
}

/**
 * Mapa de calor por dia da semana e hora (spec 038, ticket 08, histórias
 * 50-55): `hours` é o intervalo (já ordenado) da menor hora de abertura à
 * maior hora de fechamento entre os dias ativos de `tenants.business_hours`,
 * ampliado (nunca reduzido) por qualquer Agendamento fora do expediente.
 * `p_professional_id` filtra este mapa (ao contrário de `by_professional`,
 * que nunca é filtrado).
 */
export interface RelatorioAgendaHeatmap {
  hours: number[];
  cells: RelatorioAgendaHeatmapCelula[];
}

/**
 * Contrato de leitura da Agenda (`get_schedule_report`, spec 038,
 * relatórios 6-7, tickets 07-08): comparecimento, cancelamento, no-show e
 * mapa de calor do período. Sem `granularity` (ranking/totais de período
 * único, como Equipe e Serviços) mas COM `previous_period`/
 * `previous_status_totais` (as taxas comparam com o período anterior, como
 * o Faturamento). Sem `data_quality`: esse conceito é da Receita
 * Reconhecida de Comanda, sem uso aqui.
 */
export interface RelatorioAgenda {
  timezone: string;
  business_today: string;
  period: RelatoriosPeriodo;
  previous_period: RelatoriosPeriodo;
  status_totals: RelatorioAgendaStatusTotais;
  previous_status_totals: RelatorioAgendaStatusTotais;
  by_origin: RelatorioAgendaOrigemTotais[];
  by_professional: RelatorioAgendaProfissionalTotais[];
  cancellation_reasons: RelatorioAgendaMotivoCancelamento[];
  heatmap: RelatorioAgendaHeatmap;
}

export interface ObterAgendaInput {
  tenantId: string;
  startDate: string;
  endDate: string;
  /** Filtra status_totals/by_origin/cancellation_reasons, mas NUNCA by_professional. */
  professionalId?: string;
}

/** Faixa de atraso do relatório de Clientes sem Retorno (spec 038, ticket 09). */
export type RelatorioClientesSemRetornoBand = 'up_to_15' | 'd16_30' | 'd31_60' | 'over_60';

/**
 * Totais do topo do contrato (spec 038, ticket 09): ignoram paginação e o
 * filtro de faixa (`p_overdue_band`), mas respeitam o filtro de
 * profissional (pela última Visita). Chegam mesmo com a página vazia --
 * por isso o contrato é `jsonb` e não linhas, como `list_payables`.
 */
export interface RelatorioClientesSemRetornoTotais {
  without_return: number;
  within_return: number;
  no_visit_ever: number;
}

/**
 * Contagem por faixa de atraso (até 15, 16-30, 31-60, mais de 60 dias):
 * mesma regra dos totais -- ignora paginação e `p_overdue_band`, respeita
 * `p_professional_id`.
 */
export interface RelatorioClientesSemRetornoFaixas {
  up_to_15: number;
  d16_30: number;
  d31_60: number;
  over_60: number;
}

/**
 * Uma linha da lista paginada (spec 038, ticket 09): `phone` e
 * `last_service_name`/`last_professional_name` são `string | null` de
 * propósito -- cliente sem telefone cadastrado, ou última Visita sem
 * serviço/profissional identificável (o núcleo do banco devolve `null`,
 * nunca string vazia), nunca convertidos para um valor padrão.
 */
export interface ClienteSemRetornoItem {
  customer_id: string;
  name: string;
  phone: string | null;
  has_phone: boolean;
  last_visit_date: string;
  last_service_name: string | null;
  last_professional_name: string | null;
  return_period_days: number;
  days_since: number;
  days_overdue: number;
}

/**
 * Contrato de leitura de Clientes sem Retorno (`get_customers_without_return`,
 * spec 038, relatório 8, ticket 09). Sem `period`/`granularity`: é uma
 * fotografia de hoje, a única página do módulo sem filtro de período.
 * `total_count` é contado sobre o conjunto filtrado (profissional + faixa),
 * antes da paginação.
 */
export interface RelatorioClientesSemRetorno {
  timezone: string;
  business_today: string;
  totals: RelatorioClientesSemRetornoTotais;
  bands: RelatorioClientesSemRetornoFaixas;
  items: ClienteSemRetornoItem[];
  total_count: number;
}

export interface ObterClientesSemRetornoInput {
  tenantId: string;
  /** Filtra só a lista paginada -- totais e faixas ignoram este filtro. */
  overdueBand?: RelatorioClientesSemRetornoBand;
  /** Filtra totais, faixas e lista, pela última Visita do cliente. */
  professionalId?: string;
  limit: number;
  offset: number;
}

/**
 * Visitantes de um período do relatório "Novos x recorrentes"
 * (`get_customer_report`, spec 038, ticket 10): únicos, novos (primeira
 * Visita da vida cai no período), recorrentes (já tinham Visita antes do
 * início do período) e atendimentos sem cliente identificado (Comanda
 * fechada sem `customer_id`, não é Visita). `new_customers +
 * returning_customers = unique_customers`, mutuamente exclusivos.
 * `new_single_visit` é o Cliente Novo cuja única Visita, até hoje, é a do
 * período (o candidato a Cliente de Uma Visita).
 */
export interface RelatorioClientesVisitantes {
  unique_customers: number;
  new_customers: number;
  returning_customers: number;
  new_single_visit: number;
  unidentified_attendances: number;
}

/**
 * Visitantes do período ANTERIOR: sem `new_single_visit` -- decisão
 * documentada na migração do ticket 10 (`private.get_customer_report_core`):
 * "Cliente de Uma Visita" depende de "até hoje" (um corte móvel), o que não
 * faz sentido para um período anterior FIXO no passado. O backend nunca
 * envia essa chave para `previous_visitors`; o tipo aqui reflete isso e não
 * inventa o campo.
 */
export type RelatorioClientesVisitantesAnterior = Omit<RelatorioClientesVisitantes, 'new_single_visit'>;

/**
 * Um agrupamento (dia/semana/mês) de Novos x recorrentes (spec 038, ticket
 * 10): Novo conta no agrupamento da primeira Visita da vida; Recorrente
 * conta no agrupamento da primeira Visita DELE DENTRO DO PERÍODO (não a
 * mais recente).
 */
export interface RelatorioClientesBucket {
  start_date: string;
  end_date: string;
  new_customers: number;
  returning_customers: number;
}

/**
 * Uma linha da lista de Clientes de Uma Visita (spec 038, ticket 10,
 * limitada a 200, mais recentes primeiro): Cliente Novo do período cuja
 * única Visita, até hoje, é a do período. `phone` e `professional_name` são
 * `string | null` de propósito (cliente sem telefone cadastrado, última
 * Visita sem profissional identificável), nunca convertidos para um valor
 * padrão -- mesma decisão de `ClienteSemRetornoItem` (ticket 09).
 */
export interface ClienteUmaVisita {
  customer_id: string;
  name: string;
  phone: string | null;
  visit_date: string;
  professional_name: string | null;
}

/**
 * Contrato de leitura de Novos x recorrentes (`get_customer_report`, spec
 * 038, relatório 9, ticket 10; a QUARTA página do módulo, "Clientes"). COM
 * `granularity`/`previous_period`, como o Faturamento (ticket 01) -- é o
 * único outro contrato do módulo agrupado por dia/semana/mês. Ainda sem
 * `registrations` (origem de cadastro/canal de aquisição): o ticket 11 faz
 * `CREATE OR REPLACE` na mesma função para acrescentar esse campo, não
 * implementado aqui.
 */
export interface RelatorioClientes {
  timezone: string;
  business_today: string;
  period: RelatoriosPeriodo;
  previous_period: RelatoriosPeriodo;
  visitors: RelatorioClientesVisitantes;
  previous_visitors: RelatorioClientesVisitantesAnterior;
  buckets: RelatorioClientesBucket[];
  single_visit_customers: ClienteUmaVisita[];
}

export interface ObterClientesInput {
  tenantId: string;
  startDate: string;
  endDate: string;
  granularity: RelatoriosGranularity;
}

/**
 * Interface do adaptador do módulo de Relatórios: uma consulta por
 * contrato de leitura (spec 038, "Módulo `src/modules/relatorios/`"). Só
 * leitura -- sem adaptador em memória, como a 037: um `vi.fn()` cobre
 * repositório e hooks nos testes.
 */
export interface RelatoriosAdapter {
  obterFaturamentoPorPeriodo(input: ObterFaturamentoPorPeriodoInput): Promise<RelatorioFaturamento>;
  obterEquipeEServicos(input: ObterEquipeEServicosInput): Promise<RelatorioEquipeServicos>;
  obterAgenda(input: ObterAgendaInput): Promise<RelatorioAgenda>;
  obterClientesSemRetorno(input: ObterClientesSemRetornoInput): Promise<RelatorioClientesSemRetorno>;
  obterClientes(input: ObterClientesInput): Promise<RelatorioClientes>;
}
