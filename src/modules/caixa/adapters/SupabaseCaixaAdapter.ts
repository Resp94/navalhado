import { supabase } from '../../../lib/supabase';
import type {
  AbrirCaixaInput,
  CashMovement,
  CashSession,
  FecharCaixaInput,
  ICaixaAdapter,
  RegistrarMovimentacaoInput,
  TurnPaymentsSummary,
} from '../types';

interface CashSessionJoinedRow {
  id: string;
  tenant_id: string;
  opened_by: string | null;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  initial_amount: number | string;
  closing_amount: number | string | null;
  status: 'open' | 'closed';
  notes: string | null;
  opened_user?: { name: string } | null;
  closed_user?: { name: string } | null;
}

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

  async listarHistorico(tenantId: string, limit = 20): Promise<CashSession[]> {
    const { data, error } = await supabase
      .from('cash_sessions')
      .select(`
        *,
        opened_user:users!opened_by(name),
        closed_user:users!closed_by(name)
      `)
      .eq('tenant_id', tenantId)
      .order('opened_at', { ascending: false })
      .limit(limit);

    let rows: CashSessionJoinedRow[] = [];
    if (error) {
      // Fallback seguro caso o relacionamento de chave estrangeira com users use select simples
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('opened_at', { ascending: false })
        .limit(limit);

      if (fallbackError) {
        throw new Error(`Erro ao listar histórico de caixas: ${fallbackError.message}`);
      }
      rows = (fallbackData || []) as unknown as CashSessionJoinedRow[];
    } else {
      rows = (data || []) as unknown as CashSessionJoinedRow[];
    }

    if (rows.length === 0) return [];

    // Buscar faturamento acumulado em comanda_pagamentos por sessão
    const sessionIds = rows.map((r) => r.id);
    const { data: paymentsData } = await supabase
      .from('comanda_pagamentos')
      .select('cash_session_id, amount')
      .in('cash_session_id', sessionIds);

    const revenueMap = new Map<string, { total: number; count: number }>();
    for (const p of (paymentsData || []) as Array<{ cash_session_id: string; amount: number | string }>) {
      if (!p.cash_session_id) continue;
      const cur = revenueMap.get(p.cash_session_id) || { total: 0, count: 0 };
      cur.total += Number(p.amount) || 0;
      cur.count += 1;
      revenueMap.set(p.cash_session_id, cur);
    }

    return rows.map((row) => {
      const rev = revenueMap.get(row.id) || { total: 0, count: 0 };
      return {
        id: row.id,
        tenant_id: row.tenant_id,
        opened_by: row.opened_by,
        closed_by: row.closed_by,
        opened_at: row.opened_at,
        closed_at: row.closed_at,
        initial_amount: Number(row.initial_amount) || 0,
        closing_amount: row.closing_amount !== null ? Number(row.closing_amount) : null,
        status: row.status,
        notes: row.notes,
        opened_by_name: row.opened_user?.name || undefined,
        closed_by_name: row.closed_user?.name || undefined,
        total_revenue: rev.total,
        payment_count: rev.count,
      };
    }) as CashSession[];
  }

  async obterEntradasDinheiro(tenantId: string, sinceDate: string, sessionId?: string): Promise<number> {
    const summary = await this.obterResumoTurno(tenantId, sinceDate, sessionId);
    return summary.dinheiro;
  }

  async obterResumoTurno(tenantId: string, sinceDate: string, sessionId?: string): Promise<TurnPaymentsSummary> {
    let query = supabase
      .from('comanda_pagamentos')
      .select('payment_method, amount')
      .eq('tenant_id', tenantId);

    if (sessionId) {
      query = query.or(`cash_session_id.eq.${sessionId},paid_at.gte.${sinceDate}`);
    } else if (sinceDate) {
      query = query.gte('paid_at', sinceDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao apurar pagamentos do turno:', error);
      return { total: 0, dinheiro: 0, pix: 0, cartao: 0, outros: 0, count: 0 };
    }

    const rows = (data || []) as Array<{ payment_method: string; amount: number | string }>;
    let total = 0;
    let dinheiro = 0;
    let pix = 0;
    let cartao = 0;
    let outros = 0;

    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      total += amt;
      const method = (r.payment_method || '').toLowerCase();
      if (method === 'cash' || method === 'dinheiro') {
        dinheiro += amt;
      } else if (method === 'pix') {
        pix += amt;
      } else if (
        method === 'credit_card' ||
        method === 'debit_card' ||
        method === 'cartao_credito' ||
        method === 'cartao_debito' ||
        method === 'card'
      ) {
        cartao += amt;
      } else {
        outros += amt;
      }
    }

    return { total, dinheiro, pix, cartao, outros, count: rows.length };
  }

  async registrarMovimentacao(input: RegistrarMovimentacaoInput): Promise<CashMovement> {
    const { data, error } = await supabase
      .from('cash_movements')
      .insert({
        tenant_id: input.tenant_id,
        cash_session_id: input.cash_session_id,
        type: input.type,
        amount: input.amount,
        reason: input.reason,
        performed_by: input.performed_by || null,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao registrar ${input.type}: ${error?.message}`);
    }

    return {
      ...data,
      amount: Number(data.amount) || 0,
    } as CashMovement;
  }

  async listarMovimentacoes(sessionId: string): Promise<CashMovement[]> {
    const { data, error } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao listar movimentações de caixa: ${error.message}`);
    }

    return ((data || []) as any[]).map((row) => ({
      ...row,
      amount: Number(row.amount) || 0,
    })) as CashMovement[];
  }

  async obterResumoMovimentacoes(sessionId: string): Promise<{ suprimentos: number; sangrias: number }> {
    const movements = await this.listarMovimentacoes(sessionId);
    let suprimentos = 0;
    let sangrias = 0;

    for (const m of movements) {
      if (m.type === 'suprimento') {
        suprimentos += m.amount;
      } else if (m.type === 'sangria') {
        sangrias += m.amount;
      }
    }

    return { suprimentos, sangrias };
  }
}

