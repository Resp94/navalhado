import { supabase } from '../../../lib/supabase';
import type { AbrirCaixaInput, CashSession, FecharCaixaInput, ICaixaAdapter } from '../types';

export class SupabaseCaixaAdapter implements ICaixaAdapter {
  async obterSessaoAtiva(tenantId: string): Promise<CashSession | null> {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar sessão de caixa ativa: ${error.message}`);
    }

    return data as CashSession | null;
  }

  async abrirCaixa(input: AbrirCaixaInput): Promise<CashSession> {
    const { data, error } = await supabase
      .from('cash_sessions')
      .insert({
        tenant_id: input.tenant_id,
        opened_by: input.opened_by || null,
        initial_amount: input.initial_amount,
        status: 'open',
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao abrir sessão de caixa: ${error?.message}`);
    }

    return data as CashSession;
  }

  async fecharCaixa(input: FecharCaixaInput): Promise<CashSession> {
    const { data, error } = await supabase
      .from('cash_sessions')
      .update({
        closed_by: input.closed_by || null,
        closing_amount: input.closing_amount,
        status: 'closed',
        closed_at: new Date().toISOString(),
        notes: input.notes || null,
      })
      .eq('id', input.session_id)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao fechar sessão de caixa: ${error?.message}`);
    }

    return data as CashSession;
  }
}
