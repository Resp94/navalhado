import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserGroupIcon,
  Invoice01Icon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  PlusSignIcon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';
import { LockIcon } from '../../components/Icons';
import './Financeiro.css';

import { CaixaRepository, calculateExpectedDrawerCash } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import { PAYMENT_METHOD_LABELS } from '../../modules/caixa/types';
import type {
  CashSession,
  DailyFinancialSummary,
  TurnPaymentsSummary,
} from '../../modules/caixa/types';
import { formatCurrency } from '../../lib/currency';
import { dateInZone } from '../../lib/timezone';
import { AberturaAssistidaCaixaModal } from '../../components/caixa/AberturaAssistidaCaixaModal';
import { FechamentoCaixaModal } from '../../components/caixa/FechamentoCaixaModal';
import { QuitacaoComissaoModal } from '../../components/financeiro/QuitacaoComissaoModal';
import { DetalhesComissaoModal } from '../../components/financeiro/DetalhesComissaoModal';
import { MobileCaixaView } from './mobile/MobileCaixaView';

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
    gross_sum?: number;
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

function formatLocalDay(date: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

export const Financeiro: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  // Estados principais
  const [_loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [activeTab, setActiveTab] = useState<TabType>('caixa');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);

  // Estados de Caixa
  const [caixaRepo] = useState(() => new CaixaRepository(new SupabaseCaixaAdapter()));
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [activeSessionCashReceipts, setActiveSessionCashReceipts] = useState<number>(0);
  const [turnSummary, setTurnSummary] = useState<TurnPaymentsSummary>({ total: 0, dinheiro: 0, pix: 0, cartao: 0, outros: 0, count: 0 });
  const [suprimentosTotal, setSuprimentosTotal] = useState<number>(0);
  const [sangriasTotal, setSangriasTotal] = useState<number>(0);
  const [historySessions, setHistorySessions] = useState<CashSession[]>([]);
  const [dailySummary, setDailySummary] = useState<DailyFinancialSummary[]>([]);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [dailySummaryError, setDailySummaryError] = useState<string | null>(null);
  const [dailyStartDate, setDailyStartDate] = useState('');
  const [dailyEndDate, setDailyEndDate] = useState('');
  const [selectedDailySessionId, setSelectedDailySessionId] = useState<string | undefined>();
  const [dailyRangeFollowsSession, setDailyRangeFollowsSession] = useState(true);
  const activeSessionId = activeSession?.id;
  const activeSessionOpenedAt = activeSession?.opened_at;
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
        // Apurar recebimentos em dinheiro exclusivamente do turno ativo via repositório
        const totalCash = await caixaRepo.getCashReceiptsSince(tenant.tenantId, session.opened_at, session.id);
        setActiveSessionCashReceipts(totalCash);

        const turnPayments = await caixaRepo.getTurnPaymentsSummary(tenant.tenantId, session.opened_at, session.id);
        setTurnSummary(turnPayments);

        const movSummary = await caixaRepo.getMovementsSummary(session.id);
        setSuprimentosTotal(movSummary.suprimentos);
        setSangriasTotal(movSummary.sangrias);
      } else {
        setActiveSessionCashReceipts(0);
        setTurnSummary({ total: 0, dinheiro: 0, pix: 0, cartao: 0, outros: 0, count: 0 });
        setSuprimentosTotal(0);
        setSangriasTotal(0);
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
    if (!dailyRangeFollowsSession || !tenant?.timezone) return;

    const today = dateInZone(new Date(), tenant.timezone);
    const sessionStart = activeSessionOpenedAt
      ? dateInZone(new Date(activeSessionOpenedAt), tenant.timezone)
      : today;

    setDailyStartDate(sessionStart);
    setDailyEndDate(today);
    setSelectedDailySessionId(activeSessionId);
  }, [activeSessionId, activeSessionOpenedAt, dailyRangeFollowsSession, tenant?.timezone]);

  const fetchDailySummary = useCallback(async () => {
    if (!tenant?.tenantId || !dailyStartDate || !dailyEndDate || !tenant.timezone) return;

    try {
      setDailySummaryLoading(true);
      setDailySummaryError(null);
      const result = await caixaRepo.getDailyFinancialSummary({
        tenantId: tenant.tenantId,
        startDate: dailyStartDate,
        endDate: dailyEndDate,
        timeZone: tenant.timezone,
        cashSessionId: selectedDailySessionId,
      });
      setDailySummary(result);
    } catch (error) {
      console.error('Erro ao carregar resumo financeiro diário:', error);
      setDailySummary([]);
      setDailySummaryError('Não foi possível carregar o resumo por dia. Tente novamente.');
    } finally {
      setDailySummaryLoading(false);
    }
  }, [caixaRepo, dailyEndDate, dailyStartDate, selectedDailySessionId, tenant?.tenantId, tenant?.timezone]);

  useEffect(() => {
    void fetchDailySummary();
  }, [fetchDailySummary]);

  const refreshFinancialData = useCallback(() => {
    void fetchFinancialData();
    void fetchDailySummary();
  }, [fetchDailySummary, fetchFinancialData]);

  const handleSangria = async (amount: number, reason: string) => {
    if (!activeSession || !tenant.tenantId) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      await caixaRepo.registerMovement({
        tenant_id: tenant.tenantId,
        cash_session_id: activeSession.id,
        type: 'sangria',
        amount,
        reason,
        performed_by: authData?.user?.id || null,
      });
      addToast(`Sangria de ${formatCurrency(amount)} registrada com sucesso.`, 'success');
      await fetchFinancialData();
    } catch (err: any) {
      console.error('Erro ao registrar sangria:', err);
      addToast(err?.message || 'Erro ao registrar sangria.', 'error');
      throw err;
    }
  };

  const handleSuprimento = async (amount: number, reason: string) => {
    if (!activeSession || !tenant.tenantId) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      await caixaRepo.registerMovement({
        tenant_id: tenant.tenantId,
        cash_session_id: activeSession.id,
        type: 'suprimento',
        amount,
        reason,
        performed_by: authData?.user?.id || null,
      });
      addToast(`Suprimento de ${formatCurrency(amount)} registrado com sucesso.`, 'success');
      await fetchFinancialData();
    } catch (err: any) {
      console.error('Erro ao registrar suprimento:', err);
      addToast(err?.message || 'Erro ao registrar suprimento.', 'error');
      throw err;
    }
  };

  const refreshFinancialDataRef = useRef(refreshFinancialData);

  useEffect(() => {
    refreshFinancialDataRef.current = refreshFinancialData;
  }, [refreshFinancialData]);

  useEffect(() => {
    void fetchFinancialData();
  }, [fetchFinancialData]);

  useEffect(() => {
    if (!tenant?.tenantId || typeof supabase.channel !== 'function') return;

    const channel = supabase
      .channel(`realtime-financeiro-${tenant.tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas', filter: `tenant_id=eq.${tenant.tenantId}` },
        () => refreshFinancialDataRef.current(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comanda_pagamentos', filter: `tenant_id=eq.${tenant.tenantId}` },
        () => refreshFinancialDataRef.current(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_sessions', filter: `tenant_id=eq.${tenant.tenantId}` },
        () => refreshFinancialDataRef.current(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_movements', filter: `tenant_id=eq.${tenant.tenantId}` },
        () => refreshFinancialDataRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.tenantId]);

  const hasAnimatedEntrance = useRef(false);

  // Animações GSAP com compatibilidade de acessibilidade (executadas na entrada da página)
  useGSAP(() => {
    const prefersReduced =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
        : false;
    if (prefersReduced) return;

    if (!hasAnimatedEntrance.current && metrics) {
      hasAnimatedEntrance.current = true;
      gsap.fromTo(
        '.kpi-card, .card-panel, .turn-banner',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power2.out' }
      );
    }
  }, [metrics]);

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

  const dailyTotals = useMemo(() => {
    return dailySummary.reduce(
      (totals, summary) => ({
        realized: totals.realized + summary.realized_revenue,
        received: totals.received + summary.received_total,
      }),
      { realized: 0, received: 0 },
    );
  }, [dailySummary]);

  const handleDailySessionChange = (sessionId: string) => {
    setDailyRangeFollowsSession(false);
    setSelectedDailySessionId(sessionId || undefined);

    if (!sessionId) {
      const today = dateInZone(new Date(), tenant.timezone);
      setDailyStartDate(today);
      setDailyEndDate(today);
      return;
    }

    const session = historySessions.find((item) => item.id === sessionId);
    if (!session) return;

    setDailyStartDate(dateInZone(new Date(session.opened_at), tenant.timezone));
    setDailyEndDate(
      dateInZone(new Date(session.closed_at || new Date().toISOString()), tenant.timezone),
    );
  };

  return (
    <div className="financeiro-page">
      {/* ─── VISÃO MOBILE (<= 768px) ─── */}
      <div className="financeiro-mobile-view">
        <MobileCaixaView
          activeSession={activeSession}
          activeSessionCashReceipts={activeSessionCashReceipts}
          turnSummary={turnSummary}
          suprimentosTotal={suprimentosTotal}
          sangriasTotal={sangriasTotal}
          metrics={metrics}
          historySessions={historySessions}
          dailySummary={dailySummary}
          dailySummaryLoading={dailySummaryLoading}
          dailySummaryError={dailySummaryError}
          dailyStartDate={dailyStartDate}
          dailyEndDate={dailyEndDate}
          selectedDailySessionId={selectedDailySessionId}
          onDailyStartDateChange={(date) => {
            setDailyRangeFollowsSession(false);
            setDailyStartDate(date);
          }}
          onDailyEndDateChange={(date) => {
            setDailyRangeFollowsSession(false);
            setDailyEndDate(date);
          }}
          onDailySessionChange={handleDailySessionChange}
          onOpenAbertura={() => setIsAberturaModalOpen(true)}
          onOpenFechamento={() => setIsFechamentoModalOpen(true)}
          onSangria={handleSangria}
          onSuprimento={handleSuprimento}
          formatDate={formatDate}
        />
      </div>

      {/* ─── VISÃO DESKTOP (> 768px) ─── */}
      <div className="financeiro-desktop-view">
        {/* 1. Header do Hub Financeiro */}
        <header className="financeiro-header">
          <div>
            <h1 className="financeiro-header-title">
              Hub financeiro
            </h1>
            <p className="financeiro-header-subtitle">
              Acompanhe o faturamento em tempo real, controle o caixa diário e realize os repasses da sua equipe.
            </p>
          </div>

        {/* Filtro de Período */}
        <div className="financeiro-period-tabs">
          <button
            onClick={() => setPeriod('this_month')}
            type="button"
            className={`period-tab-btn ${period === 'this_month' ? 'period-tab-btn--active' : ''}`}
          >
            Este mês
          </button>
          <button
            onClick={() => setPeriod('last_30_days')}
            type="button"
            className={`period-tab-btn ${period === 'last_30_days' ? 'period-tab-btn--active' : ''}`}
          >
            Últimos 30 dias
          </button>
          <button
            onClick={() => setPeriod('last_90_days')}
            type="button"
            className={`period-tab-btn ${period === 'last_90_days' ? 'period-tab-btn--active' : ''}`}
          >
            Últimos 90 dias
          </button>
        </div>
      </header>

      {/* 2. Top Bento Grid: 5 Cards de KPIs Consolidados */}
      <section className="kpi-cards-grid" aria-label="Indicadores consolidados">
        {/* Card 1: Faturamento Bruto */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Faturamento bruto</span>
          </div>
          <div>
            <h3 className="kpi-value">
              {formatCurrency(metrics?.total_revenue || 0)}
            </h3>
            <p className="kpi-meta">Comandas fechadas no período</p>
          </div>
        </div>

        {/* Card 2: Serviços Prestados */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Serviços prestados</span>
          </div>
          <div>
            <h3 className="kpi-value">
              {formatCurrency(metrics?.services_revenue || 0)}
            </h3>
            <p className="kpi-meta">Cortes, barbas e procedimentos</p>
          </div>
        </div>

        {/* Card 3: Venda de Produtos */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Venda de produtos</span>
          </div>
          <div>
            <h3 className="kpi-value">
              {formatCurrency(metrics?.products_revenue || 0)}
            </h3>
            <p className="kpi-meta">
              {metrics?.products_count || 0} itens vendidos • Custo: {formatCurrency(metrics?.products_cost || 0)}
            </p>
          </div>
        </div>

        {/* Card 4: Comissões da Equipe */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Comissões da equipe</span>
          </div>
          <div>
            <h3 className="kpi-value">
              {formatCurrency(metrics?.total_commission || 0)}
            </h3>
            <p className="kpi-meta kpi-meta--pending">
              Pendente: {formatCurrency(metrics?.pending_commission || 0)}
            </p>
          </div>
        </div>

        {/* Card 5: Lucro Líquido */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Lucro líquido livre</span>
          </div>
          <div>
            <h3 className="kpi-value kpi-value--profit">
              {formatCurrency(metrics?.net_revenue || 0)}
            </h3>
            <p className="kpi-meta">Receita deduzindo comissões e custos de produtos</p>
          </div>
        </div>
      </section>

      {/* 3. Seletor de Abas de Navegação */}
      <nav className="financeiro-nav-tabs" aria-label="Abas financeiras">
        <button
          onClick={() => setActiveTab('caixa')}
          type="button"
          className={`nav-tab-btn ${activeTab === 'caixa' ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={Coins01Icon} size={18} />
          Caixa diário e turnos
        </button>

        <button
          onClick={() => setActiveTab('comissoes')}
          type="button"
          className={`nav-tab-btn ${activeTab === 'comissoes' ? 'nav-tab-btn--active' : ''}`}
        >
          <HugeiconsIcon icon={UserGroupIcon} size={18} />
          Repasses de comissões
        </button>
      </nav>

      {/* 4. Conteúdo da Aba 1: Caixa Diário & Turnos */}
      {activeTab === 'caixa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Banner de Sessão Ativa */}
          <div className="turn-banner">
            <div className="turn-banner-info">
              <div
                className={`turn-banner-icon ${
                  activeSession ? 'turn-banner-icon--active' : 'turn-banner-icon--closed'
                }`}
              >
                {activeSession ? (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} />
                ) : (
                  <LockIcon size={24} />
                )}
              </div>
              <div>
                <div className="turn-banner-title-row">
                  <h3 className="turn-banner-title">
                    {activeSession ? 'Caixa aberto no turno atual' : 'Caixa fechado no momento'}
                  </h3>
                  <span
                    className={`turn-status-badge ${
                      activeSession ? 'turn-status-badge--active' : 'turn-status-badge--closed'
                    }`}
                  >
                    {activeSession ? 'Turno ativo' : 'Aguardando abertura'}
                  </span>
                </div>
                <p className="turn-banner-desc">
                  {activeSession
                    ? `Aberto em ${formatDate(activeSession.opened_at)} • Fundo de troco: ${formatCurrency(activeSession.initial_amount)} • Entradas: ${formatCurrency(activeSessionCashReceipts)}${suprimentosTotal > 0 ? ` • Suprimentos: +${formatCurrency(suprimentosTotal)}` : ''}${sangriasTotal > 0 ? ` • Sangrias: -${formatCurrency(sangriasTotal)}` : ''} • Total na Gaveta: ${formatCurrency(calculateExpectedDrawerCash(Number(activeSession.initial_amount), activeSessionCashReceipts, suprimentosTotal, sangriasTotal))}`
                    : 'Inicie o turno registrando o fundo de troco da gaveta para liberar a movimentação das comandas.'}
                </p>
              </div>
            </div>

            {/* Botões de Ação de Caixa */}
            <div>
              {activeSession ? (
                <button
                  onClick={() => setIsFechamentoModalOpen(true)}
                  type="button"
                  className="btn-turn-action btn-turn-action--close"
                >
                  <LockIcon size={16} />
                  Fechar caixa do turno
                </button>
              ) : (
                <button
                  onClick={() => setIsAberturaModalOpen(true)}
                  type="button"
                  className="btn-turn-action btn-turn-action--open"
                >
                  <HugeiconsIcon icon={PlusSignIcon} size={16} />
                  Abrir caixa do turno
                </button>
              )}
            </div>
          </div>

          {/* Resumo financeiro diário: faturamento realizado separado das entradas */}
          <section className="daily-financial-panel" aria-labelledby="daily-financial-title">
            <div className="daily-financial-header">
              <div>
                <h3 id="daily-financial-title" className="card-panel-title">
                  <HugeiconsIcon icon={Coins01Icon} size={18} />
                  Resumo por dia
                </h3>
                <p className="card-panel-subtitle">
                  Faturamento realizado e valores recebidos, separados por data local da barbearia.
                </p>
              </div>
              <div className="daily-financial-filters" aria-label="Filtros do resumo diário">
                <label>
                  <span>De</span>
                  <input
                    aria-label="Data inicial do resumo diário"
                    type="date"
                    value={dailyStartDate}
                    onChange={(event) => {
                      setDailyRangeFollowsSession(false);
                      setDailyStartDate(event.target.value);
                    }}
                  />
                </label>
                <label>
                  <span>Até</span>
                  <input
                    aria-label="Data final do resumo diário"
                    type="date"
                    value={dailyEndDate}
                    onChange={(event) => {
                      setDailyRangeFollowsSession(false);
                      setDailyEndDate(event.target.value);
                    }}
                  />
                </label>
                <label>
                  <span>Sessão</span>
                  <select
                    aria-label="Sessão do resumo diário"
                    value={selectedDailySessionId || ''}
                    onChange={(event) => handleDailySessionChange(event.target.value)}
                  >
                    <option value="">Todas as sessões</option>
                    {historySessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.status === 'open' ? 'Atual' : 'Encerrada'} — {formatDate(session.opened_at)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="daily-financial-kpis">
              <div className="daily-financial-kpi daily-financial-kpi--revenue">
                <span>Faturamento realizado</span>
                <strong>{formatCurrency(dailyTotals.realized)}</strong>
                <small>{dailySummary.reduce((count, item) => count + item.closed_comandas_count, 0)} comandas fechadas</small>
              </div>
              <div className="daily-financial-kpi daily-financial-kpi--received">
                <span>Entradas no caixa</span>
                <strong>{formatCurrency(dailyTotals.received)}</strong>
                <small>{dailySummary.reduce((count, item) => count + item.payment_count, 0)} pagamentos registrados</small>
              </div>
            </div>

            {dailySummaryLoading ? (
              <div className="table-empty-notice" role="status">Carregando resumo por dia...</div>
            ) : dailySummaryError ? (
              <div className="table-empty-notice daily-financial-error" role="alert">{dailySummaryError}</div>
            ) : (
              <div className="table-responsive-container">
                <table className="financeiro-data-table daily-financial-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Faturado</th>
                      <th>Recebido</th>
                      <th>Dinheiro</th>
                      <th>PIX</th>
                      <th>Cartão</th>
                      <th>Outros</th>
                      <th>Comandas</th>
                      <th>Pagamentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.map((summary) => (
                      <tr key={summary.date}>
                        <td style={{ fontWeight: 700 }}>{formatLocalDay(summary.date, tenant.timezone)}</td>
                        <td className="daily-financial-value">{formatCurrency(summary.realized_revenue)}</td>
                        <td className="daily-financial-value">{formatCurrency(summary.received_total)}</td>
                        <td>{formatCurrency(summary.by_method.dinheiro)}</td>
                        <td>{formatCurrency(summary.by_method.pix)}</td>
                        <td>{formatCurrency(summary.by_method.cartao)}</td>
                        <td>{formatCurrency(summary.by_method.outros)}</td>
                        <td>{summary.closed_comandas_count}</td>
                        <td>{summary.payment_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Grid Intermediário: Métodos de Pagamento e Histórico de Sessões */}
          <div className="financeiro-split-grid">
            {/* Métodos de Pagamento */}
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h3 className="card-panel-title">
                    <HugeiconsIcon icon={Invoice01Icon} size={18} />
                    Recebimentos por forma de pagamento
                  </h3>
                  <p className="card-panel-subtitle">Distribuição das entradas por meio de pagamento no período selecionado</p>
                </div>
              </div>

              <div className="payment-methods-list">
                {methodsList.map((m) => {
                  const pct = totalRevenueByMethods > 0 ? (m.val / totalRevenueByMethods) * 100 : 0;
                  return (
                    <div key={m.key} className="payment-method-item">
                      <div className="payment-method-header">
                        <span className="payment-method-name">{m.name}</span>
                        <span className="payment-method-amount">
                          {formatCurrency(m.val)} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="payment-progress-track">
                        <div
                          className="payment-progress-bar"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Histórico de Sessões de Caixa */}
            <div className="card-panel">
              <div className="card-panel-header">
                <div>
                  <h3 className="card-panel-title">
                    <HugeiconsIcon icon={Clock01Icon} size={18} />
                    Histórico de caixas anteriores
                  </h3>
                  <p className="card-panel-subtitle">Histórico completo de turnos e conferências de gaveta</p>
                </div>
              </div>

              {historySessions.length === 0 ? (
                <div className="table-empty-notice">
                  Nenhum fechamento de caixa registrado para o período.
                </div>
              ) : (
                <div className="table-responsive-container">
                  <table className="financeiro-data-table">
                    <thead>
                      <tr>
                        <th>Abertura</th>
                        <th>Fechamento</th>
                        <th>Operador</th>
                        <th>Arrecadado no turno</th>
                        <th>Troco inicial</th>
                        <th>Valor fechado</th>
                        <th>Observações</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historySessions.map((sess) => {
                        const isCurrentActive = activeSession?.id === sess.id;
                        const revenue = isCurrentActive
                          ? (turnSummary?.total || sess.total_revenue || 0)
                          : (sess.total_revenue || 0);

                        return (
                          <tr key={sess.id}>
                            <td style={{ fontWeight: 700 }}>{formatDate(sess.opened_at)}</td>
                            <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(sess.closed_at)}</td>
                            <td style={{ fontWeight: 600 }}>
                              {sess.opened_by_name || sess.closed_by_name || 'Operador'}
                            </td>
                            <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: 'var(--color-brand-primary)' }}>
                              {formatCurrency(revenue)}
                            </td>
                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sess.initial_amount)}</td>
                            <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                              {sess.closing_amount !== null ? formatCurrency(sess.closing_amount) : '-'}
                            </td>
                            <td style={{ color: 'var(--color-text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sess.notes || ''}>
                              {sess.notes || '-'}
                            </td>
                            <td>
                              <span
                                className={`turn-status-badge ${
                                  sess.status === 'open'
                                    ? 'turn-status-badge--active'
                                    : 'turn-status-badge--closed'
                                }`}
                              >
                                {sess.status === 'open' ? 'Aberto' : 'Encerrado'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Tabela de Comissões por Barbeiro */}
          <div className="card-panel">
            <div className="card-panel-header">
              <div>
                <h3 className="card-panel-title">
                  <HugeiconsIcon icon={UserGroupIcon} size={18} />
                  Saldos de comissão por profissional
                </h3>
                <p className="card-panel-subtitle">
                  Acompanhe o faturamento de cada barbeiro e quite os repasses pendentes com clareza.
                </p>
              </div>
            </div>

            {!metrics?.commissions_by_professional || metrics.commissions_by_professional.length === 0 ? (
              <div className="table-empty-notice">
                Nenhum atendimento ou comissão gerada no período selecionado.
              </div>
            ) : (
              <div className="table-responsive-container">
                <table className="financeiro-data-table">
                  <thead>
                    <tr>
                      <th>Profissional</th>
                      <th style={{ textAlign: 'center' }}>Atendimentos</th>
                      <th>Total faturado</th>
                      <th>Comissão gerada</th>
                      <th>Já quitado</th>
                      <th>Saldo pendente</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.commissions_by_professional.map((p) => (
                      <tr key={p.professional_id || p.professional_name}>
                        <td>
                          <div className="cell-prof-name">
                            <span className="prof-avatar-badge">
                              {p.professional_name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>{p.professional_name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
                          {p.appointments_count}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {formatCurrency(p.gross_sum ?? p.commission_sum)}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {formatCurrency(p.commission_sum)}
                        </td>
                        <td className="cell-paid-amount">
                          {formatCurrency(p.paid_sum || 0)}
                        </td>
                        <td className="cell-pending-amount">
                          {formatCurrency(p.pending_sum || 0)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="cell-actions-group">
                            <button
                              onClick={() => setSelectedProfForDetails({ id: p.professional_id, name: p.professional_name })}
                              type="button"
                              className="btn-table-action btn-table-action--ghost"
                            >
                              Ver comandas
                            </button>
                            <button
                              onClick={() => setSelectedProfForPayout(p)}
                              type="button"
                              className="btn-table-action btn-table-action--primary"
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
          <div className="card-panel">
            <div className="card-panel-header">
              <div>
                <h3 className="card-panel-title">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} style={{ color: 'var(--color-success)' }} />
                  Histórico de quitações realizadas no período
                </h3>
                <p className="card-panel-subtitle">Registro detalhado de todos os pagamentos de comissão efetuados</p>
              </div>
            </div>

            {payoutsHistory.length === 0 ? (
              <div className="table-empty-notice">
                Nenhum repasse de comissão foi realizado neste período.
              </div>
            ) : (
              <div className="table-responsive-container">
                <table className="financeiro-data-table">
                  <thead>
                    <tr>
                      <th>Data do repasse</th>
                      <th>Profissional</th>
                      <th>Forma de pagamento</th>
                      <th>Valor pago</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutsHistory.map((pay) => (
                      <tr key={pay.id}>
                        <td style={{ fontWeight: 600 }}>{formatDate(pay.paid_at)}</td>
                        <td style={{ fontWeight: 700 }}>{pay.professional_name}</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>
                          {PAYMENT_METHOD_LABELS[pay.payment_method] || pay.payment_method}
                        </td>
                        <td className="cell-paid-amount">
                          {formatCurrency(pay.amount)}
                        </td>
                        <td style={{ color: 'var(--color-text-secondary)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pay.notes || ''}>
                          {pay.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

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
        turnSummary={turnSummary}
        suprimentos={suprimentosTotal}
        sangrias={sangriasTotal}
        caixaRepo={caixaRepo}
        onCaixaFechado={(_closedSession) => {
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
