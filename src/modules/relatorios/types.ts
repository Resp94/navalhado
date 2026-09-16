/**
 * Tipos de domínio do Módulo de Relatórios (spec 038, ticket 01). Cobrem só
 * o relatório de Faturamento por período (`get_revenue_report`), o
 * primeiro contrato da spec -- os outros quatro (Equipe e Serviços, Agenda,
 * Clientes, Clientes sem Retorno) chegam nos tickets seguintes, cada um
 * estendendo este arquivo com sua própria interface, nunca reaproveitando
 * `RelatorioFaturamento` para outra forma de dado.
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
}

export interface RelatorioFaturamentoBucket extends RelatorioFaturamentoTotais {
  start_date: string;
  end_date: string;
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
  buckets: RelatorioFaturamentoBucket[];
}

export interface ObterFaturamentoPorPeriodoInput {
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
}
