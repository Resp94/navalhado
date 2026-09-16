export type FluxoCaixaGranularity = 'day' | 'week' | 'month';
export type FluxoCaixaBucketKind = 'past' | 'current' | 'future';

export interface FluxoCaixaInflowByMethod {
  dinheiro: number;
  pix: number;
  cartao: number;
  outros: number;
}

/** Total de Quitação de Comissão ou de vale de um profissional num agrupamento. */
export interface FluxoCaixaValorPorProfissional {
  professional_id: string;
  professional_name: string;
  amount: number;
}

/**
 * Conta a Pagar (spec 036) prevista ou vencida dentro de um agrupamento
 * (spec 037, ticket 07). `overdue` distingue as duas: `false` é Saída
 * Prevista (vencimento hoje ou depois), `true` é Conta a Pagar Vencida
 * (vencimento passado, sempre no agrupamento atual) -- nunca as duas ao
 * mesmo tempo para a mesma conta.
 */
export interface FluxoCaixaPayableForecast {
  payable_id: string;
  description: string;
  remaining_amount: number;
  due_date: string;
  overdue: boolean;
}

/** Total de Baixa paga (valor líquido) de uma Categoria de Despesa num agrupamento (ticket 08). */
export interface FluxoCaixaValorPorCategoria {
  category_id: string;
  category_name: string;
  amount: number;
}

/**
 * Detalhamento de um agrupamento. Ticket 01: entradas por forma de
 * pagamento. Ticket 02: Quitações de Comissão e vales por profissional.
 * Ticket 03: dias estimados e dias fechados (só dias futuros do
 * agrupamento). Ticket 07: Contas a Pagar previstas e vencidas. Ticket 08:
 * Baixas pagas por Categoria de Despesa.
 */
export interface FluxoCaixaBucketDetail {
  inflow_by_method: FluxoCaixaInflowByMethod;
  payouts_by_professional: FluxoCaixaValorPorProfissional[];
  advances_by_professional: FluxoCaixaValorPorProfissional[];
  payables_forecast: FluxoCaixaPayableForecast[];
  settlements_by_category: FluxoCaixaValorPorCategoria[];
  /** Dias futuros do agrupamento em que a barbearia funciona (recebem estimativa, mesmo que zero). */
  estimated_days: number;
  /** Dias futuros do agrupamento em que a barbearia não funciona (horário de funcionamento inativo ou ausente). */
  closed_days: number;
}

export type FluxoCaixaEstimateStatus = 'ok' | 'insufficient_history';

export const FLUXO_CAIXA_WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type FluxoCaixaWeekdayKey = (typeof FLUXO_CAIXA_WEEKDAY_KEYS)[number];

export type FluxoCaixaWeekdayAverages = Record<FluxoCaixaWeekdayKey, number>;

/**
 * Estado da estimativa de entradas por dia da semana (spec 037, ticket 03):
 * média do recebido nas N ocorrências mais recentes do mesmo dia da semana,
 * N limitado a 8. `weeks_used` abaixo de 4 vira `insufficient_history`, e a
 * tela nunca some o número quando o histórico é insuficiente, só o rotula
 * como não confiável.
 */
export interface FluxoCaixaEstimate {
  status: FluxoCaixaEstimateStatus;
  weeks_used: number;
  weekday_averages: FluxoCaixaWeekdayAverages;
}

/**
 * Um agrupamento do Fluxo de Caixa Projetado (dia, semana ou mês, conforme a
 * granularidade pedida). `kind` classifica o agrupamento em relação a
 * `business_today`: passado (termina antes de hoje), atual (contém hoje) ou
 * futuro (começa depois de hoje) -- nunca a data local do navegador.
 */
export interface FluxoCaixaBucket {
  start_date: string;
  end_date: string;
  kind: FluxoCaixaBucketKind;
  inflow_realized: number;
  /**
   * Entrada estimada por dia da semana (ticket 03), só dias futuros. `null`
   * quando o histórico é insuficiente e o agrupamento tem dia futuro ativo:
   * "vazio", nunca "zerado" -- a tela nunca mostra um zero que pareça uma
   * previsão real. `0` é o valor correto quando não há dia futuro ativo no
   * agrupamento (nada a estimar).
   */
  inflow_estimated: number | null;
  /**
   * Saída realizada: Quitações de Comissão (líquidas do abate de vale),
   * vales dados no agrupamento (ticket 02) e Baixas de Conta a Pagar pelo
   * valor pago -- principal, mais juros, menos desconto (ticket 08),
   * excluindo estornos.
   */
  outflow_realized: number;
  /**
   * Saída Prevista (ticket 07): soma do saldo restante de Contas a Pagar em
   * aberto ou parcialmente pagas com vencimento hoje ou depois, no
   * agrupamento do próprio vencimento.
   */
  outflow_forecast: number;
  /**
   * Conta a Pagar Vencida (ticket 07): soma do saldo restante de Contas a
   * Pagar em aberto ou parcialmente pagas com vencimento já passado --
   * sempre no agrupamento atual (o que contém `business_today`), nunca
   * somada em `outflow_forecast`.
   */
  outflow_overdue: number;
  /**
   * O que, dentro deste agrupamento, ainda não está no saldo de hoje: soma
   * entradas estimadas, o realizado com data posterior a `business_today`
   * (entradas futuras somam, saídas futuras subtraem), e subtrai
   * integralmente `outflow_forecast` e `outflow_overdue` (nenhuma das duas
   * já saiu da gaveta).
   */
  pending_flow: number;
  detail: FluxoCaixaBucketDetail;
}

/**
 * Compromissos sem Data (spec 037, ticket 05): quanto a barbearia deve hoje
 * à equipe entre comissões e gorjetas em aberto, já descontados os vales a
 * abater, com piso zero por profissional. Calculado no momento da consulta
 * -- nunca entra em nenhum agrupamento, no `pending_flow` nem na curva,
 * porque distribuí-lo exigiria inventar uma data de quitação.
 */
export interface FluxoCaixaUndatedCommitments {
  commission_open: number;
  tips_open: number;
  advances_open: number;
  net_due: number;
}

/**
 * Contrato de leitura do Fluxo de Caixa Projetado (`get_projected_cash_flow`,
 * spec 037). `timezone` e `business_today` vêm do banco: a tela nunca decide
 * sozinha qual é o dia de hoje.
 */
export interface FluxoCaixaProjetado {
  timezone: string;
  business_today: string;
  estimate: FluxoCaixaEstimate;
  undated_commitments: FluxoCaixaUndatedCommitments;
  buckets: FluxoCaixaBucket[];
}

export interface ObterFluxoCaixaInput {
  tenantId: string;
  startDate: string;
  endDate: string;
  granularity: FluxoCaixaGranularity;
}

export interface IFluxoCaixaAdapter {
  obterFluxoCaixaProjetado(input: ObterFluxoCaixaInput): Promise<FluxoCaixaProjetado>;
}
