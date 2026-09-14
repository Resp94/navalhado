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
 * Detalhamento de um agrupamento. Ticket 01: entradas por forma de
 * pagamento. Ticket 02: Quitações de Comissão e vales por profissional.
 * Ticket 03: dias estimados e dias fechados (só dias futuros do
 * agrupamento). Os tickets seguintes (05 a 08) acrescentam aqui categorias
 * de despesa e Contas a Pagar previstas.
 */
export interface FluxoCaixaBucketDetail {
  inflow_by_method: FluxoCaixaInflowByMethod;
  payouts_by_professional: FluxoCaixaValorPorProfissional[];
  advances_by_professional: FluxoCaixaValorPorProfissional[];
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
   * Saída realizada: Quitações de Comissão (líquidas do abate de vale) e
   * vales dados no agrupamento, excluindo estornos (ticket 02). Os tickets
   * seguintes somam aqui Baixas de Contas a Pagar.
   */
  outflow_realized: number;
  /**
   * O que, dentro deste agrupamento, ainda não está no saldo de hoje: soma
   * entradas estimadas e o realizado com data posterior a `business_today`
   * (entradas futuras somam, saídas futuras subtraem). Os tickets seguintes
   * somam aqui saídas previstas e vencidas.
   */
  pending_flow: number;
  detail: FluxoCaixaBucketDetail;
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
