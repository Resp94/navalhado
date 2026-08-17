export type CaixaStatus = 'open' | 'closed';

export type PaymentMethod =
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'transfer'
  | 'other';

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

export interface ICaixaAdapter {
  obterSessaoAtiva(tenantId: string): Promise<CashSession | null>;
  abrirCaixa(input: AbrirCaixaInput): Promise<CashSession>;
  fecharCaixa(input: FecharCaixaInput): Promise<CashSession>;
  listarHistorico(tenantId: string, limit?: number): Promise<CashSession[]>;
}
