import type { PaymentMethod } from '../caixa/types';

export interface RegistrarQuitacaoInput {
  professional_id: string;
  amount: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  paid_at?: string | null;
  tenant_id?: string | null;
  cash_session_id?: string | null;
}

export interface QuitacaoRegistrada {
  success: boolean;
  payout_id: string;
  amount: number;
  professional_id: string;
  allocated_amount?: number;
  legacy_amount?: number;
  [key: string]: unknown;
}

export interface ConsultarSaldoInput {
  professional_id: string;
  start_date?: string | null;
  end_date?: string | null;
  tenant_id?: string | null;
}

export interface SaldoComissaoProfissional {
  current_open_balance: number;
  generated_commission: number;
  paid_commission: number;
  [key: string]: unknown;
}

export interface IComissaoAdapter {
  registrarQuitacao(input: RegistrarQuitacaoInput): Promise<QuitacaoRegistrada>;
  obterSaldoProfissional(input: ConsultarSaldoInput): Promise<SaldoComissaoProfissional>;
}
