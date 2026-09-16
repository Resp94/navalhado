import type { CashSession } from '../../../modules/caixa/types';
import type { TenantContextType } from '../../../components/GerenteLayout';

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
 * Recarga dos dados próprios de uma aba. O painel a chama depois de recarregar métricas e
 * Sessão de Caixa ativa, passando a sessão recém-carregada.
 */
export type TabReload = (activeSession: CashSession | null) => Promise<void>;

/**
 * Estado que as abas Caixa e Comissões do Hub Financeiro compartilham. Fica no layout do painel
 * (`PainelLayout`) e desce para as abas via contexto de rota; o que só uma aba usa fica nela.
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
  /**
   * Recarrega métricas e Sessão de Caixa ativa e, em seguida, as recargas registradas pelas
   * abas. Resolve quando tudo terminou. A página também a chama na entrada, na troca de
   * período e a cada evento realtime.
   */
  refresh: () => Promise<void>;
  /** Registra a recarga de uma aba; devolve a função que desfaz o registro. */
  registerTabReload: (reload: TabReload) => () => void;
  /**
   * Muda a cada evento realtime das tabelas do Hub, independentemente da recarga do painel.
   * Serve ao que só se recarrega por realtime, como o resumo por dia da aba de Caixa.
   */
  realtimeVersion: number;
}

/**
 * Contexto de rota que o layout do painel (sem segmento de URL, sob `/financeiro`) entrega às
 * abas Caixa e Comissões via `useOutletContext`: o contexto do tenant que ele recebeu do layout
 * do Hub, estendido com o estado compartilhado do painel. Cada aba é montada pela própria rota
 * (`/financeiro/caixa`, `/financeiro/comissoes`), então só a aba selecionada existe no DOM.
 */
export interface PainelContext extends TenantContextType, PainelFinanceiro {}
