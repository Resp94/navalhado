import type { PaymentMethod } from '../caixa/types';

export interface RegistrarQuitacaoInput {
  professional_id: string;
  amount: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  paid_at?: string | null;
  tenant_id?: string | null;
  cash_session_id?: string | null;
  /** Valor de vale em aberto a ser abatido nesta quitação (débito, não gera novo movimento de caixa). */
  advance_amount?: number;
  /** Valor de crédito de gorjeta a ser pago nesta quitação. */
  credit_amount?: number;
}

export interface QuitacaoRegistrada {
  success: boolean;
  payout_id: string;
  amount: number;
  professional_id: string;
  allocated_amount?: number;
  legacy_amount?: number;
  advance_amount?: number;
  advance_allocated_amount?: number;
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
  advances_open_amount?: number;
  credits_open_amount?: number;
  suggested_net_amount?: number;
  [key: string]: unknown;
}

export interface EstornarQuitacaoInput {
  payout_id: string;
  tenant_id?: string | null;
  reason: string;
}

export interface QuitacaoEstornada {
  reversed: boolean;
  reversed_at?: string;
  [key: string]: unknown;
}

export interface ObterExtratoInput {
  professional_id: string;
  tenant_id?: string | null;
}

export type ProfessionalAccountEntryKind = 'vale' | 'gorjeta' | 'quitacao';

export interface ProfessionalAccountStatementEntry {
  kind: ProfessionalAccountEntryKind;
  id: string;
  amount: number;
  /** Presente apenas em lançamentos de vale/gorjeta. */
  settled_amount?: number;
  direction: 'credit' | 'debit';
  reason: string | null;
  status: string;
  comanda_id?: string | null;
  created_at: string;
  created_by: string | null;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
  /** Presentes apenas em lançamentos de quitação. */
  advance_amount?: number;
  credit_amount?: number;
  payment_method?: string;
  [key: string]: unknown;
}

export interface ProfessionalAccountStatement {
  entries: ProfessionalAccountStatementEntry[];
  current_balance: SaldoComissaoProfissional;
}

export interface IComissaoAdapter {
  registrarQuitacao(input: RegistrarQuitacaoInput): Promise<QuitacaoRegistrada>;
  obterSaldoProfissional(input: ConsultarSaldoInput): Promise<SaldoComissaoProfissional>;
  estornarQuitacao(input: EstornarQuitacaoInput): Promise<QuitacaoEstornada>;
  obterExtratoProfissional(input: ObterExtratoInput): Promise<ProfessionalAccountStatement>;
}
