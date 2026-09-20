import { supabase } from '../../../lib/supabase';
import type {
  ConsultarItensComissaoInput,
  ConsultarSaldoInput,
  EstornarQuitacaoInput,
  IComissaoAdapter,
  ItemComissaoGerada,
  ObterExtratoInput,
  ProfessionalAccountStatement,
  QuitacaoEstornada,
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
      p_cash_session_id: input.cash_session_id ?? null,
      p_advance_amount: input.advance_amount ?? 0,
      p_credit_amount: input.credit_amount ?? 0,
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

  async estornarQuitacao(input: EstornarQuitacaoInput): Promise<QuitacaoEstornada> {
    const { data, error } = await supabase.rpc('reverse_commission_payout', {
      p_payout_id: input.payout_id,
      p_tenant_id: input.tenant_id ?? null,
      p_reason: input.reason,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao estornar quitação de comissão.');
    }

    return data as QuitacaoEstornada;
  }

  async obterExtratoProfissional(input: ObterExtratoInput): Promise<ProfessionalAccountStatement> {
    const { data, error } = await supabase.rpc('get_professional_account_statement', {
      p_professional_id: input.professional_id,
      p_tenant_id: input.tenant_id ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao consultar o extrato do profissional.');
    }

    return data as ProfessionalAccountStatement;
  }

  async obterItensComissao(input: ConsultarItensComissaoInput): Promise<ItemComissaoGerada[]> {
    const { data, error } = await supabase.rpc('get_professional_commission_items', {
      p_professional_id: input.professional_id,
      p_start_date: input.start_date ?? null,
      p_end_date: input.end_date ?? null,
      p_tenant_id: input.tenant_id ?? null,
    });

    if (error) {
      throw new Error(error.message || 'Erro ao consultar os itens de comissão do profissional.');
    }

    return ((data as ItemComissaoGerada[] | null) ?? []).map((item) => ({
      ...item,
      net_amount: Number(item.net_amount ?? 0),
      commission_amount: Number(item.commission_amount ?? 0),
      commission_percentage: item.commission_percentage == null ? null : Number(item.commission_percentage),
    }));
  }
}
