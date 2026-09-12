import type { PaymentMethod } from '../caixa/types';

export type ProfessionalAccountEntryType = 'vale' | 'gorjeta';
export type ProfessionalAccountEntryDirection = 'credit' | 'debit';
export type ProfessionalAccountEntryStatus = 'open' | 'partially_paid' | 'settled' | 'reversed';

/**
 * Um lançamento da Conta do Profissional (`professional_account_entries`).
 * Gorjeta é crédito (ticket 04 da spec 034); vale é débito (ticket 05).
 */
export interface ProfessionalAccountEntry {
  id: string;
  tenant_id: string;
  professional_id: string;
  entry_type: ProfessionalAccountEntryType;
  direction: ProfessionalAccountEntryDirection;
  amount: number;
  settled_amount: number;
  status: ProfessionalAccountEntryStatus;
  reason: string;
  comanda_id: string | null;
  cash_movement_id: string | null;
  created_by: string | null;
  created_at: string;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
}

export interface RegistrarValeInput {
  professional_id: string;
  amount: number;
  reason: string;
  payment_method: PaymentMethod;
  tenant_id?: string | null;
  cash_session_id?: string | null;
}

export interface ValeRegistrado {
  success: boolean;
  entry_id: string;
  professional_id: string;
  amount: number;
  cash_movement_id: string | null;
  cash_session_id: string | null;
  [key: string]: unknown;
}

export interface EstornarValeInput {
  entry_id: string;
  tenant_id?: string | null;
  reason: string;
}

export interface ValeEstornado {
  reversed: boolean;
  reversed_at?: string;
  [key: string]: unknown;
}

export interface IContaProfissionalAdapter {
  registrarVale(input: RegistrarValeInput): Promise<ValeRegistrado>;
  estornarVale(input: EstornarValeInput): Promise<ValeEstornado>;
  listarLancamentos(professionalId: string, tenantId: string): Promise<ProfessionalAccountEntry[]>;
}
