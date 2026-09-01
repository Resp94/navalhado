export type CaixaStatus = 'open' | 'closed';

export type PaymentMethod =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'transfer'
  | 'other';

export type PaymentCategory = 'dinheiro' | 'pix' | 'cartao' | 'outros';

export function getPaymentCategory(method?: string | null): PaymentCategory {
  const m = (method || '').toLowerCase().trim();
  if (m === 'cash' || m === 'dinheiro') return 'dinheiro';
  if (m === 'pix') return 'pix';
  if (
    m === 'credit_card' ||
    m === 'debit_card' ||
    m === 'cartao_credito' ||
    m === 'cartao_debito' ||
    m === 'card' ||
    m.includes('cartao') ||
    m.includes('card')
  ) {
    return 'cartao';
  }
  return 'outros';
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod | string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  cash: 'Dinheiro em espécie',
  transfer: 'Transferência bancária',
  other: 'Outros',
};

export interface CashSession {
  id: string;
  tenant_id: string;
  opened_by: string | null;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  initial_amount: number;
  closing_amount: number | null;
  status: CaixaStatus;
  notes: string | null;
  created_at?: string;
  opened_by_name?: string;
  closed_by_name?: string;
  total_revenue?: number;
  payment_count?: number;
}

export interface AbrirCaixaInput {
  tenant_id: string;
  opened_by?: string | null;
  initial_amount: number;
  notes?: string | null;
}

export interface FecharCaixaInput {
  session_id: string;
  closed_by?: string | null;
  closing_amount: number;
  notes?: string | null;
}

export type CashMovementType = 'sangria' | 'suprimento';

export interface CashMovement {
  id: string;
  tenant_id: string;
  cash_session_id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  performed_by?: string | null;
  created_at: string;
}

export interface RegistrarMovimentacaoInput {
  tenant_id: string;
  cash_session_id: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  performed_by?: string | null;
}

export interface TurnPaymentsSummary {
  total: number;
  dinheiro: number;
  pix: number;
  cartao: number;
  outros: number;
  count: number;
}

export interface DailyFinancialSummaryQuery {
  tenantId: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  cashSessionId?: string;
}

export interface DailyFinancialSummary {
  date: string;
  realized_revenue: number;
  received_total: number;
  by_method: Record<PaymentCategory, number>;
  closed_comandas_count: number;
  payment_count: number;
}

export interface ICaixaAdapter {
  obterSessaoAtiva(tenantId: string): Promise<CashSession | null>;
  abrirCaixa(input: AbrirCaixaInput): Promise<CashSession>;
  fecharCaixa(input: FecharCaixaInput): Promise<CashSession>;
  listarHistorico(tenantId: string, limit?: number): Promise<CashSession[]>;
  obterEntradasDinheiro(tenantId: string, sinceDate: string, sessionId?: string): Promise<number>;
  obterResumoTurno(tenantId: string, sinceDate: string, sessionId?: string): Promise<TurnPaymentsSummary>;
  obterResumoFinanceiroDiario(query: DailyFinancialSummaryQuery): Promise<DailyFinancialSummary[]>;
  registrarMovimentacao(input: RegistrarMovimentacaoInput): Promise<CashMovement>;
  listarMovimentacoes(sessionId: string): Promise<CashMovement[]>;
  obterResumoMovimentacoes(sessionId: string): Promise<{ suprimentos: number; sangrias: number }>;
}
