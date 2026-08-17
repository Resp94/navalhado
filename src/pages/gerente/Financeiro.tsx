import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Money01Icon,
  UserGroupIcon,
  ShoppingBag01Icon,
  Invoice01Icon,
  Calendar03Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  ScissorIcon,
  PlusSignIcon,
  Clock01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { LockIcon } from '../../components/Icons';

import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import { PAYMENT_METHOD_LABELS } from '../../modules/caixa/types';
import type { CashSession } from '../../modules/caixa/types';
import { formatCurrency } from '../../lib/currency';
import { AberturaAssistidaCaixaModal } from '../../components/caixa/AberturaAssistidaCaixaModal';
import { FechamentoCaixaModal } from '../../components/caixa/FechamentoCaixaModal';
import { QuitacaoComissaoModal } from '../../components/financeiro/QuitacaoComissaoModal';
import { DetalhesComissaoModal } from '../../components/financeiro/DetalhesComissaoModal';

export interface FinancialMetrics {
  total_revenue: number;
  services_revenue: number;
  products_revenue: number;
  products_count: number;
  products_cost: number;
  total_commission: number;
  paid_commission: number;
  pending_commission: number;
  net_revenue: number;
  revenue_by_method: Record<string, number>;
  commissions_by_professional: Array<{
    professional_id: string;
    professional_name: string;
    commission_sum: number;
    paid_sum: number;
    pending_sum: number;
    appointments_count: number;
  }>;
}

export interface CommissionPayoutHistoryItem {
  id: string;
  professional_id: string;
  professional_name: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  paid_at: string;
}

type PeriodType = 'this_month' | 'last_30_days' | 'last_90_days';
type TabType = 'caixa' | 'comissoes';

export const Financeiro: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [activeTab, setActiveTab] = useState<TabType>('caixa');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);

  // Estados de Caixa
  const [caixaRepo] = useState(() => new CaixaRepository(new SupabaseCaixaAdapter()));
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [activeSessionCashReceipts, setActiveSessionCashReceipts] = useState<number>(0);
  const [historySessions, setHistorySessions] = useState<CashSession[]>([]);
  const [isAberturaModalOpen, setIsAberturaModalOpen] = useState(false);
  const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState(false);

  // Estados de Quitação e Detalhes de Comissão
  const [selectedProfForPayout, setSelectedProfForPayout] = useState<FinancialMetrics['commissions_by_professional'][0] | null>(null);
  const [selectedProfForDetails, setSelectedProfForDetails] = useState<{ id: string; name: string } | null>(null);
  const [payoutsHistory, setPayoutsHistory] = useState<CommissionPayoutHistoryItem[]>([]);

  // 1. Cálculo de Período
  const calculateDates = useCallback(() => {
    const now = new Date();
    let startDate = new Date();

    if (period === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === 'last_30_days') {
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'last_90_days') {
      startDate.setDate(now.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    };
  }, [period]);

  // 2. Busca de Dados Financeiros
  const fetchFinancialData = useCallback(async () => {
    if (!tenant?.tenantId) return;

    try {
      setLoading(true);
      const { start, end } = calculateDates();

      // RPC de Métricas Consolidadas
      const { data, error } = await supabase.rpc('get_tenant_financial_metrics', {
        p_start_date: start,
        p_end_date: end,
        p_tenant_id: tenant.tenantId,
      });

      if (error) throw error;
      setMetrics(data as FinancialMetrics);

      // Buscar Sessão de Caixa Ativa e Histórico
      const session = await caixaRepo.getActiveSession(tenant.tenantId);
      setActiveSession(session);

      if (session) {
        // Apurar recebimentos em dinheiro exclusivamente do turno ativo
        const { data: cashPayments } = await supabase
          .from('comanda_pagamentos')
          .select('amount')
          .eq('tenant_id', tenant.tenantId)
          .eq('payment_method', 'cash')
          .gte('created_at', session.opened_at);

        const cashRows = (cashPayments || []) as Array<{ amount: number | string }>;
        const totalCash = cashRows.reduce(
          (acc: number, p) => acc + (Number(p.amount) || 0),
          0
        );
        setActiveSessionCashReceipts(totalCash);
      } else {
        setActiveSessionCashReceipts(0);
      }

      const history = await caixaRepo.listHistory(tenant.tenantId, 15);
      setHistorySessions(history || []);

      // Buscar Histórico de Quitações
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('commission_payouts')
        .select(`
          id,
          professional_id,
          amount,
          payment_method,
          notes,
          paid_at,
          professional:professionals!professional_id(name)
        `)
        .eq('tenant_id', tenant.tenantId)
        .gte('paid_at', start)
        .lte('paid_at', end)
        .order('paid_at', { ascending: false })
        .limit(20);

      if (!payoutsError && payoutsData) {
        interface RawPayoutRow {
          id: string;
          professional_id: string;
          amount: number | string;
          payment_method: string;
          notes: string | null;
          paid_at: string;
          professional?: { name: string } | null;
        }

        const payoutRows = payoutsData as unknown as RawPayoutRow[];
        setPayoutsHistory(
          payoutRows.map((p) => ({
            id: p.id,
            professional_id: p.professional_id,
            professional_name: p.professional?.name || 'Profissional',
            amount: Number(p.amount) || 0,
            payment_method: p.payment_method,
            notes: p.notes,
            paid_at: p.paid_at,
          }))
        );
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados financeiros:', error);
      addToast('Não foi possível carregar os dados do painel financeiro.', 'error');
    } finally {
      setLoading(false);
    }
  }, [tenant?.tenantId, calculateDates, caixaRepo, addToast]);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  // Animações GSAP
  useGSAP(() => {
    const prefersReduced =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
        : false;
    if (prefersReduced) return;

    if (!loading && metrics) {
      gsap.fromTo(
        '.bento-card',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power2.out' }
      );
    }
  }, [loading, metrics, activeTab]);

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const methodsList = useMemo(() => {
    if (!metrics || !metrics.revenue_by_method) return [];

    const rawMap = metrics.revenue_by_method;
    const entries = Object.entries(rawMap);

    if (entries.length === 0) {
      return [
        { key: 'pix', name: PAYMENT_METHOD_LABELS.pix || 'PIX', val: 0 },
        { key: 'credit_card', name: PAYMENT_METHOD_LABELS.credit_card || 'Cartão de crédito', val: 0 },
        { key: 'cash', name: PAYMENT_METHOD_LABELS.cash || 'Dinheiro em espécie', val: 0 },
      ];
    }

    return entries
      .map(([rawKey, val]) => {
        const normalizedKey = rawKey.toLowerCase().trim();
        return {
          key: normalizedKey,
          name: PAYMENT_METHOD_LABELS[normalizedKey] || rawKey,
          val: Number(val) || 0,
        };
      })
      .sort((a, b) => b.val - a.val);
  }, [metrics]);

  const totalRevenueByMethods = useMemo(() => {
    return methodsList.reduce((acc, curr) => acc + curr.val, 0);
  }, [methodsList]);

  const { start: dateStart, end: dateEnd } = calculateDates();

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header do Hub Financeiro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <HugeiconsIcon icon={Money01Icon} className="text-amber-500" size={28} />
            Hub financeiro
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de caixa diário, controle de faturamento operacional e repasses de comissões.
          </p>
        </div>

        {/* Filtro de Período */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto shadow-inner">
          <button
            onClick={() => setPeriod('this_month')}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              period === 'this_month'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Este mês
          </button>
          <button
            onClick={() => setPeriod('last_30_days')}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              period === 'last_30_days'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Últimos 30 dias
          </button>
          <button
            onClick={() => setPeriod('last_90_days')}
            type="button"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              period === 'last_90_days'
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Últimos 90 dias
          </button>
        </div>
      </div>

      {/* 2. Top Bento Grid: 5 Cards de KPIs Consolidados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Faturamento Bruto */}
        <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Faturamento bruto</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <HugeiconsIcon icon={Money01Icon} size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100 tabular-nums">
              {loading ? 'Carregando...' : formatCurrency(metrics?.total_revenue || 0)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Comandas fechadas</p>
          </div>
        </div>

        {/* Card 2: Serviços Prestados */}
        <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Serviços prestados</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <HugeiconsIcon icon={ScissorIcon} size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100 tabular-nums">
              {loading ? 'Carregando...' : formatCurrency(metrics?.services_revenue || 0)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Cortes, barbas e estética</p>
          </div>
        </div>

        {/* Card 3: Venda de Produtos */}
        <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Venda de produtos</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <HugeiconsIcon icon={ShoppingBag01Icon} size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100 tabular-nums">
              {loading ? 'Carregando...' : formatCurrency(metrics?.products_revenue || 0)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              {metrics?.products_count || 0} itens • CMV: {formatCurrency(metrics?.products_cost || 0)}
            </p>
          </div>
        </div>

        {/* Card 4: Comissões da Equipe */}
        <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Comissões da equipe</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <HugeiconsIcon icon={UserGroupIcon} size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100 tabular-nums">
              {loading ? 'Carregando...' : formatCurrency(metrics?.total_commission || 0)}
            </span>
            <p className="text-xs text-amber-400/90 mt-0.5">
              Pendente: {formatCurrency(metrics?.pending_commission || 0)}
            </p>
          </div>
        </div>

        {/* Card 5: Lucro Líquido */}
        <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-sm relative group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Lucro líquido livre</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <HugeiconsIcon icon={Coins01Icon} size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-emerald-400 tabular-nums">
              {loading ? 'Carregando...' : formatCurrency(metrics?.net_revenue || 0)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Faturamento - Comissões - CMV</p>
          </div>
        </div>
      </div>

      {/* 3. Seletor de Abas de Navegação */}
      <div className="flex items-center gap-4 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('caixa')}
          type="button"
          className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'caixa'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HugeiconsIcon icon={Coins01Icon} size={18} />
          Caixa diário & Turnos
        </button>

        <button
          onClick={() => setActiveTab('comissoes')}
          type="button"
          className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'comissoes'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <HugeiconsIcon icon={UserGroupIcon} size={18} />
          Repasses de comissões
          {metrics && metrics.pending_commission > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
              Pendente
            </span>
          )}
        </button>
      </div>

      {/* 4. Conteúdo da Aba 1: Caixa Diário & Turnos */}
      {activeTab === 'caixa' && (
        <div className="space-y-6">
          {/* Banner de Sessão Ativa */}
          <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    activeSession
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}
                >
                  {activeSession ? (
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} />
                  ) : (
                    <LockIcon size={24} />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-100">
                      {activeSession ? 'Caixa aberto no turno atual' : 'Caixa fechado no momento'}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        activeSession
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                      }`}
                    >
                      {activeSession ? 'Turno ativo' : 'Aguardando abertura'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeSession
                      ? `Aberto em ${formatDate(activeSession.opened_at)} • Fundo de troco inicial: ${formatCurrency(activeSession.initial_amount)} • Entradas em dinheiro: ${formatCurrency(activeSessionCashReceipts)}`
                      : 'Abra o caixa do dia informando o fundo de troco para iniciar as operações de comandas.'}
                  </p>
                </div>
              </div>

              {/* Botões de Ação de Caixa */}
              <div className="flex items-center gap-3">
                {activeSession ? (
                  <button
                    onClick={() => setIsFechamentoModalOpen(true)}
                    type="button"
                    className="px-4 py-2 bg-red-600/90 hover:bg-red-600 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
                  >
                    <LockIcon size={16} />
                    Fechar caixa do turno
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAberturaModalOpen(true)}
                    type="button"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm"
                  >
                    <HugeiconsIcon icon={PlusSignIcon} size={16} />
                    Abrir caixa do dia
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Grid Intermediário: Métodos de Pagamento e Histórico de Sessões */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Métodos de Pagamento */}
            <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl shadow-sm">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <HugeiconsIcon icon={Invoice01Icon} size={18} className="text-amber-500" />
                Recebimentos por forma de pagamento
              </h3>

              <div className="space-y-4">
                {methodsList.map((m) => {
                  const pct = totalRevenueByMethods > 0 ? (m.val / totalRevenueByMethods) * 100 : 0;
                  return (
                    <div key={m.key} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 font-medium">{m.name}</span>
                        <span className="text-slate-400 tabular-nums">
                          {formatCurrency(m.val)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Histórico de Sessões de Caixa */}
            <div className="lg:col-span-2 bento-card bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl shadow-sm">
              <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <HugeiconsIcon icon={Clock01Icon} size={18} className="text-amber-500" />
                Histórico de caixas anteriores
              </h3>

              {historySessions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Nenhuma sessão de caixa anterior registrada.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-medium">Abertura</th>
                        <th className="pb-3 font-medium">Fechamento</th>
                        <th className="pb-3 font-medium">Operador</th>
                        <th className="pb-3 font-medium">Troco inicial</th>
                        <th className="pb-3 font-medium">Valor fechado</th>
                        <th className="pb-3 font-medium">Observações</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {historySessions.map((sess) => (
                        <tr key={sess.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 font-medium text-slate-200">{formatDate(sess.opened_at)}</td>
                          <td className="py-3 text-slate-400">{formatDate(sess.closed_at)}</td>
                          <td className="py-3 text-slate-300 font-medium">
                            {sess.opened_by_name || sess.closed_by_name || 'Operador'}
                          </td>
                          <td className="py-3 tabular-nums">{formatCurrency(sess.initial_amount)}</td>
                          <td className="py-3 tabular-nums text-slate-200">
                            {sess.closing_amount !== null ? formatCurrency(sess.closing_amount) : '-'}
                          </td>
                          <td className="py-3 text-slate-400 max-w-[180px] truncate" title={sess.notes || ''}>
                            {sess.notes || '-'}
                          </td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                sess.status === 'open'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {sess.status === 'open' ? 'Aberto' : 'Encerrado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Conteúdo da Aba 2: Repasses de Comissões */}
      {activeTab === 'comissoes' && (
        <div className="space-y-6">
          {/* Tabela de Comissões por Barbeiro */}
          <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <HugeiconsIcon icon={UserGroupIcon} size={18} className="text-amber-500" />
                  Saldos de comissão por profissional
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Acompanhe a produção individual e realize a quitação de repasses da equipe.
                </p>
              </div>
            </div>

            {!metrics?.commissions_by_professional || metrics.commissions_by_professional.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum profissional com produção registrada no período selecionado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-medium">Profissional</th>
                      <th className="pb-3 font-medium text-center">Atendimentos</th>
                      <th className="pb-3 font-medium">Comissão total</th>
                      <th className="pb-3 font-medium">Já quitado</th>
                      <th className="pb-3 font-medium">Saldo pendente</th>
                      <th className="pb-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {metrics.commissions_by_professional.map((p) => (
                      <tr key={p.professional_id || p.professional_name} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-medium text-slate-100 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-xs">
                            {p.professional_name.slice(0, 1).toUpperCase()}
                          </div>
                          <span>{p.professional_name}</span>
                        </td>
                        <td className="py-3 text-center tabular-nums text-slate-400">{p.appointments_count}</td>
                        <td className="py-3 tabular-nums text-slate-200">{formatCurrency(p.commission_sum)}</td>
                        <td className="py-3 tabular-nums text-emerald-400 font-medium">
                          {formatCurrency(p.paid_sum || 0)}
                        </td>
                        <td className="py-3 tabular-nums font-bold text-amber-400">
                          {formatCurrency(p.pending_sum || 0)}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedProfForDetails({ id: p.professional_id, name: p.professional_name })}
                              type="button"
                              className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                            >
                              Ver comandas
                            </button>
                            <button
                              onClick={() => setSelectedProfForPayout(p)}
                              type="button"
                              className="px-2.5 py-1 text-[11px] font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <HugeiconsIcon icon={Coins01Icon} size={14} />
                              Pagar comissão
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Histórico de Repasses Quitados */}
          <div className="bento-card bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl shadow-sm">
            <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} className="text-emerald-400" />
              Histórico de quitações realizadas no período
            </h3>

            {payoutsHistory.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum pagamento de comissão registrado no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-medium">Data do repasse</th>
                      <th className="pb-3 font-medium">Profissional</th>
                      <th className="pb-3 font-medium">Forma de pagamento</th>
                      <th className="pb-3 font-medium">Valor pago</th>
                      <th className="pb-3 font-medium">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {payoutsHistory.map((pay) => (
                      <tr key={pay.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 text-slate-300 font-medium">{formatDate(pay.paid_at)}</td>
                        <td className="py-3 text-slate-100 font-semibold">{pay.professional_name}</td>
                        <td className="py-3 text-slate-400">
                          {PAYMENT_METHOD_LABELS[pay.payment_method] || pay.payment_method}
                        </td>
                        <td className="py-3 tabular-nums font-bold text-emerald-400">
                          {formatCurrency(pay.amount)}
                        </td>
                        <td className="py-3 text-slate-400 max-w-xs truncate">{pay.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modais Integrados */}
      {/* Modal 1: Abertura de Caixa */}
      <AberturaAssistidaCaixaModal
        isOpen={isAberturaModalOpen}
        tenantId={tenant?.tenantId || ''}
        caixaRepo={caixaRepo}
        onCaixaAberto={(newSession) => {
          setActiveSession(newSession);
          setIsAberturaModalOpen(false);
          addToast('Caixa aberto com sucesso!', 'success');
          fetchFinancialData();
        }}
        onClose={() => setIsAberturaModalOpen(false)}
      />

      {/* Modal 2: Fechamento de Caixa com Conferência */}
      <FechamentoCaixaModal
        isOpen={isFechamentoModalOpen}
        session={activeSession}
        cashReceipts={activeSessionCashReceipts}
        caixaRepo={caixaRepo}
        onCaixaFechado={(closedSession) => {
          setActiveSession(null);
          setIsFechamentoModalOpen(false);
          addToast('Caixa do turno encerrado com sucesso!', 'success');
          fetchFinancialData();
        }}
        onClose={() => setIsFechamentoModalOpen(false)}
      />

      {/* Modal 3: Quitação de Comissão */}
      <QuitacaoComissaoModal
        isOpen={!!selectedProfForPayout}
        professional={selectedProfForPayout}
        tenantId={tenant?.tenantId}
        onSuccess={() => {
          setSelectedProfForPayout(null);
          addToast('Quitação de comissão registrada com sucesso!', 'success');
          fetchFinancialData();
        }}
        onClose={() => setSelectedProfForPayout(null)}
      />

      {/* Modal 4: Detalhes de Comandas do Profissional */}
      <DetalhesComissaoModal
        isOpen={!!selectedProfForDetails}
        professional={selectedProfForDetails}
        startDate={dateStart}
        endDate={dateEnd}
        tenantId={tenant?.tenantId}
        onClose={() => setSelectedProfForDetails(null)}
      />
    </div>
  );
};
