export type CaixaStatus = 'open' | 'closed';

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
}
