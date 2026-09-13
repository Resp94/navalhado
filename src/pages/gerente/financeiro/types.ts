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
