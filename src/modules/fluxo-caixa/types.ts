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
 * pagamento. Ticket 02: Quitações de Comissão e vales por profissional. Os
 * tickets seguintes (03 a 08) acrescentam aqui categorias de despesa e
 * Contas a Pagar previstas.
 */
export interface FluxoCaixaBucketDetail {
  inflow_by_method: FluxoCaixaInflowByMethod;
  payouts_by_professional: FluxoCaixaValorPorProfissional[];
  advances_by_professional: FluxoCaixaValorPorProfissional[];
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
   * Saída realizada: Quitações de Comissão (líquidas do abate de vale) e
   * vales dados no agrupamento, excluindo estornos (ticket 02). Os tickets
   * seguintes somam aqui Baixas de Contas a Pagar.
   */
  outflow_realized: number;
  /**
   * O que, dentro deste agrupamento, ainda não está no saldo de hoje: soma
   * o realizado com data posterior a `business_today` (entradas futuras
   * somam, saídas futuras subtraem). Os tickets seguintes somam aqui
   * entradas estimadas, saídas previstas e vencidas.
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
