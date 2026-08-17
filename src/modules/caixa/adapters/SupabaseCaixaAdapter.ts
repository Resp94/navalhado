import { supabase } from '../../../lib/supabase';
import type { AbrirCaixaInput, CashSession, FecharCaixaInput, ICaixaAdapter } from '../types';

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
      return (fallbackData || []) as CashSession[];
    }

    const rows = (data || []) as unknown as CashSessionJoinedRow[];
    return rows.map((row) => ({
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
    })) as CashSession[];
  }

  async obterEntradasDinheiro(tenantId: string, sinceDate: string): Promise<number> {
    const { data, error } = await supabase
      .from('comanda_pagamentos')
      .select('amount')
      .eq('tenant_id', tenantId)
      .eq('payment_method', 'cash')
      .gte('paid_at', sinceDate);

    if (error) {
      throw new Error(`Erro ao apurar entradas em dinheiro: ${error.message}`);
    }

    const rows = (data || []) as Array<{ amount: number | string }>;
    return rows.reduce((acc: number, p) => acc + (Number(p.amount) || 0), 0);
  }
}

