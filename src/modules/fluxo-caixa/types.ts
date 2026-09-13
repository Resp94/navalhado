export type FluxoCaixaGranularity = 'day' | 'week' | 'month';
export type FluxoCaixaBucketKind = 'past' | 'current' | 'future';

export interface FluxoCaixaInflowByMethod {
  dinheiro: number;
  pix: number;
  cartao: number;
  outros: number;
}

/**
 * Detalhamento de um agrupamento. Nesta fatia (ticket 01 da spec 037), só
 * entradas por forma de pagamento. Os tickets seguintes (02 a 08) acrescentam
 * aqui categorias de despesa, profissionais e Contas a Pagar previstas.
 */
export interface FluxoCaixaBucketDetail {
  inflow_by_method: FluxoCaixaInflowByMethod;
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
   * O que, dentro deste agrupamento, ainda não está no saldo de hoje: nesta
   * fatia, só o realizado com data posterior a `business_today`. Os tickets
   * seguintes somam aqui entradas estimadas, saídas previstas e vencidas.
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
