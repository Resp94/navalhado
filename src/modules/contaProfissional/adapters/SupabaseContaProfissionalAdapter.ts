import { supabase } from '../../../lib/supabase';
import type {
  EstornarValeInput,
  IContaProfissionalAdapter,
  ProfessionalAccountEntry,
  RegistrarValeInput,
  ValeEstornado,
  ValeRegistrado,
} from '../types';

export class SupabaseContaProfissionalAdapter implements IContaProfissionalAdapter {
  async registrarVale(input: RegistrarValeInput): Promise<ValeRegistrado> {
    const { data, error } = await supabase.rpc('register_professional_advance', {
      p_professional_id: input.professional_id,
      p_amount: input.amount,
      p_reason: input.reason,
      p_payment_method: input.payment_method,
      p_tenant_id: input.tenant_id ?? null,
      p_cash_session_id: input.cash_session_id ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao lançar vale do profissional.');
    }

    return data as ValeRegistrado;
  }

  async estornarVale(input: EstornarValeInput): Promise<ValeEstornado> {
    const { data, error } = await supabase.rpc('reverse_professional_advance', {
      p_entry_id: input.entry_id,
      p_tenant_id: input.tenant_id ?? null,
      p_reason: input.reason,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao estornar vale do profissional.');
    }

    return data as ValeEstornado;
  }

  async listarLancamentos(professionalId: string, tenantId: string): Promise<ProfessionalAccountEntry[]> {
    const { data, error } = await supabase
      .from('professional_account_entries')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Erro ao listar lançamentos da Conta do Profissional.');
    }

    return (data || []) as ProfessionalAccountEntry[];
  }
}
