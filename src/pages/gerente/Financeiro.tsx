import React, { useEffect, useState, useMemo, useCallback } from 'react';
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

  // Animações GSAP com compatibilidade de acessibilidade
  useGSAP(() => {
    const prefersReduced =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
        : false;
    if (prefersReduced) return;

    if (!loading && metrics) {
      gsap.fromTo(
        '.kpi-card, .card-panel, .turn-banner',
        { y: 12, opacity: 0 },
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
    <div className="financeiro-page">
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
              {loading ? 'Carregando...' : formatCurrency(metrics?.total_revenue || 0)}
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
              {loading ? 'Carregando...' : formatCurrency(metrics?.services_revenue || 0)}
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
              {loading ? 'Carregando...' : formatCurrency(metrics?.products_revenue || 0)}
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
              {loading ? 'Carregando...' : formatCurrency(metrics?.total_commission || 0)}
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
              {loading ? 'Carregando...' : formatCurrency(metrics?.net_revenue || 0)}
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
                    ? `Aberto em ${formatDate(activeSession.opened_at)} • Fundo de troco inicial: ${formatCurrency(activeSession.initial_amount)} • Entradas em dinheiro apuradas: ${formatCurrency(activeSessionCashReceipts)}`
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
                        <th>Troco inicial</th>
                        <th>Valor fechado</th>
                        <th>Observações</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historySessions.map((sess) => (
                        <tr key={sess.id}>
                          <td style={{ fontWeight: 700 }}>{formatDate(sess.opened_at)}</td>
                          <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(sess.closed_at)}</td>
                          <td style={{ fontWeight: 600 }}>
                            {sess.opened_by_name || sess.closed_by_name || 'Operador'}
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
                      <th>Comissão total</th>
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
