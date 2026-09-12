import { supabase } from '../../../lib/supabase';
import type {
  ConsultarSaldoInput,
  IComissaoAdapter,
  QuitacaoRegistrada,
  RegistrarQuitacaoInput,
  SaldoComissaoProfissional,
} from '../types';

export class SupabaseComissaoAdapter implements IComissaoAdapter {
  async registrarQuitacao(input: RegistrarQuitacaoInput): Promise<QuitacaoRegistrada> {
    const { data, error } = await supabase.rpc('register_commission_payout', {
      p_professional_id: input.professional_id,
      p_amount: input.amount,
      p_payment_method: input.payment_method,
      p_notes: input.notes ?? null,
      p_paid_at: input.paid_at ?? new Date().toISOString(),
      p_tenant_id: input.tenant_id ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao registrar quitação de comissão.');
    }

    return data as QuitacaoRegistrada;
  }

  async obterSaldoProfissional(input: ConsultarSaldoInput): Promise<SaldoComissaoProfissional> {
    const { data, error } = await supabase.rpc('get_professional_commission_balance', {
      p_professional_id: input.professional_id,
      p_start_date: input.start_date ?? null,
      p_end_date: input.end_date ?? null,
      p_tenant_id: input.tenant_id ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao consultar saldo de comissão do profissional.');
    }

    return data as SaldoComissaoProfissional;
  }
}
