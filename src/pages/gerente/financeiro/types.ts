import type { CashSession } from '../../../modules/caixa/types';

export interface FinancialMetrics {
  total_revenue: number;
  services_revenue: number;
  products_revenue: number;
  products_count: number;
  products_cost: number;
  total_commission: number;
  paid_commission: number;
  pending_commission: number;
  net_revenue: number;
  discounts_total?: number;
  tips_total?: number;
  operational_revenue?: number;
  historical_data_quality?: 'confirmed' | 'estimated' | 'mixed' | 'legacy' | 'unavailable';
  snapshot_comandas_count?: number;
  estimated_comandas_count?: number;
  legacy_comandas_count?: number;
  revenue_by_method: Record<string, number>;
  commissions_by_professional: Array<{
    professional_id: string;
    professional_name: string;
    gross_sum?: number;
    commission_sum: number;
    paid_sum: number;
    pending_sum: number;
    appointments_count: number;
  }>;
}

/**
 * Estado que as abas Caixa e Comissões do Hub Financeiro compartilham. Fica na página
 * (no ticket 02, no layout do painel) e desce para as abas; o que só uma aba usa fica nela.
 */
export interface PainelFinanceiro {
  /** Início do período selecionado, em ISO. */
  periodStart: string;
  /** Fim do período selecionado, em ISO. */
  periodEnd: string;
  metrics: FinancialMetrics | null;
  /** Sessão de Caixa ativa. A Quitação de Comissão e o lançamento de vale também a recebem. */
  activeSession: CashSession | null;
  setActiveSession: (session: CashSession | null) => void;
  /** Recarrega métricas e Sessão de Caixa ativa; ao concluir com sucesso, `painelVersion` muda. */
  refresh: () => Promise<void>;
  /**
   * Muda a cada carga bem-sucedida do painel (entrada, período, realtime ou `refresh`).
   * Começa em 0, antes da primeira carga. As abas recarregam o que exibem quando ela muda.
   */
  painelVersion: number;
  /**
   * Muda a cada evento realtime das tabelas do Hub, antes e independentemente da recarga do
   * painel. Para o que só se recarrega por realtime, como o resumo por dia da aba de Caixa.
   */
  realtimeVersion: number;
}
