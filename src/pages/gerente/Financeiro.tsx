import React, { useEffect, useState, useMemo } from 'react';
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
  Alert02Icon,
} from '@hugeicons/core-free-icons';

interface FinancialMetrics {
  total_revenue: number;
  total_commission: number;
  net_revenue: number;
  revenue_by_method: Record<string, number>;
  commissions_by_professional: Array<{
    professional_id?: string;
    professional_name: string;
    commission_sum: number;
    appointments_count: number;
  }>;
}

type PeriodType = 'this_month' | 'last_30_days' | 'last_90_days';

const METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  cash: 'Dinheiro em espécie',
  dinheiro: 'Dinheiro em espécie',
  cartao: 'Cartão',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  other: 'Outros',
  outros: 'Outros',
};

export const Financeiro: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);

  const calculateDates = () => {
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
  };

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const { start, end } = calculateDates();

      const { data, error } = await supabase.rpc('get_tenant_financial_metrics', {
        p_start_date: start,
        p_end_date: end,
        p_tenant_id: tenant?.tenantId || null,
      });

      if (error) throw error;
      setMetrics(data as FinancialMetrics);
    } catch (error: any) {
      console.error('Error fetching financial metrics:', error);
      addToast('Não foi possível carregar o relatório financeiro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [tenant?.tenantId, period]);

  useGSAP(() => {
    const prefersReduced =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
        : false;
    if (prefersReduced) return;

    if (!loading && metrics) {
      gsap.fromTo(
        '.bento-card',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }, [loading, metrics]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const methodsList = useMemo(() => {
    if (!metrics || !metrics.revenue_by_method) return [];

    const rawMap = metrics.revenue_by_method;
    const entries = Object.entries(rawMap);

    if (entries.length === 0) {
      return [
        { key: 'pix', name: 'PIX', val: 0 },
        { key: 'credit_card', name: 'Cartão de crédito', val: 0 },
        { key: 'cash', name: 'Dinheiro em espécie', val: 0 },
      ];
    }

    return entries
      .map(([rawKey, val]) => {
        const normalizedKey = rawKey.toLowerCase().trim();
        const label = METHOD_LABELS[normalizedKey] || rawKey;
        return {
          key: normalizedKey,
          name: label,
          val: Number(val) || 0,
        };
      })
      .sort((a, b) => b.val - a.val);
  }, [metrics]);

  const maxMethodVal = useMemo(() => {
    return Math.max(...methodsList.map((m) => m.val), 1);
  }, [methodsList]);

  const netMarginPercentage = useMemo(() => {
    if (!metrics || metrics.total_revenue <= 0) return 0;
    return Math.round((metrics.net_revenue / metrics.total_revenue) * 100);
  }, [metrics]);

  return (
    <div className="financial-page">
      <header className="financial-header-section">
        <div className="financial-header-titles">
          <h2>Relatório financeiro</h2>
          <p>Acompanhe o faturamento bruto, repasses de comissão e lucratividade líquida da barbearia.</p>
        </div>

        <div className="period-selector" role="group" aria-label="Filtro de período do relatório financeiro">
          <button
            type="button"
            onClick={() => setPeriod('this_month')}
            className={`period-btn ${period === 'this_month' ? 'period-btn--active' : ''}`}
            aria-pressed={period === 'this_month'}
          >
            Este mês
          </button>
          <button
            type="button"
            onClick={() => setPeriod('last_30_days')}
            className={`period-btn ${period === 'last_30_days' ? 'period-btn--active' : ''}`}
            aria-pressed={period === 'last_30_days'}
          >
            Últimos 30 dias
          </button>
          <button
            type="button"
            onClick={() => setPeriod('last_90_days')}
            className={`period-btn ${period === 'last_90_days' ? 'period-btn--active' : ''}`}
            aria-pressed={period === 'last_90_days'}
          >
            Últimos 90 dias
          </button>
        </div>
      </header>

      {loading || !metrics ? (
        <div className="skeleton-container-sub" aria-busy="true" aria-label="Carregando dados financeiros">
          <div className="skeleton-grid-top">
            <div className="skeleton skeleton--card" />
            <div className="skeleton skeleton--card" />
            <div className="skeleton skeleton--card" />
          </div>
          <div className="skeleton-grid-bottom">
            <div className="skeleton skeleton--panel" />
            <div className="skeleton skeleton--panel" />
          </div>
        </div>
      ) : (
        <div className="financial-content">
          {/* Bento Metrics Grid */}
          <section className="bento-metrics" aria-label="Indicadores consolidados">
            {/* Card: Faturamento Bruto */}
            <div className="bento-card bento-card--primary">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <div className="bento-card__header">
                    <div className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Faturamento bruto
                    </div>
                    <span className="bento-card__icon-box text-brand">
                      <HugeiconsIcon icon={Money01Icon} size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="bento-card__value">{formatCurrency(metrics.total_revenue)}</div>
                  <p className="bento-card__desc">Soma de todos os pagamentos recebidos no período</p>
                </div>
              </div>
            </div>

            {/* Card: Comissões */}
            <div className="bento-card bento-card--sm">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <div className="bento-card__header">
                    <div className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Comissões
                    </div>
                    <span className="bento-card__icon-box text-warning">
                      <HugeiconsIcon icon={UserGroupIcon} size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="bento-card__value">{formatCurrency(metrics.total_commission)}</div>
                  <p className="bento-card__desc">Valor repassado aos barbeiros</p>
                </div>
              </div>
            </div>

            {/* Card: Faturamento Líquido */}
            <div className="bento-card bento-card--sm bento-card--accent">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <div className="bento-card__header">
                    <div className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Faturamento líquido
                    </div>
                    <span className="bento-card__icon-box text-success">
                      <HugeiconsIcon icon={Invoice01Icon} size={18} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="bento-card__value">{formatCurrency(metrics.net_revenue)}</div>
                  <p className="bento-card__desc">
                    Caixa livre após comissões ({netMarginPercentage}% de margem)
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Bento Details Grid */}
          <div className="bento-details">
            {/* Card: Métodos de Pagamento */}
            <div className="bento-card">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <h3 className="bento-card__section-title">
                    <span className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Receitas
                    </span>
                    Faturamento por método
                  </h3>

                  {metrics.total_revenue === 0 ? (
                    <div className="empty-sub-state">
                      <p>Sem faturamento registrado neste período.</p>
                    </div>
                  ) : (
                    <div className="methods-list">
                      {methodsList.map((method) => {
                        const percentage =
                          metrics.total_revenue > 0
                            ? (method.val / metrics.total_revenue) * 100
                            : 0;
                        return (
                          <div key={method.key} className="method-item">
                            <div className="method-item-header">
                              <span className="method-name">{method.name}</span>
                              <div className="method-vals">
                                <span className="method-amount">{formatCurrency(method.val)}</span>
                                <span className="method-perc">{percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="progress-bar-bg">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  transform: `scaleX(${Math.min(1, Math.max(0, method.val / maxMethodVal))})`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card: Comissões dos Profissionais */}
            <div className="bento-card bento-card--wide">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <h3 className="bento-card__section-title">
                    <span className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Repasses
                    </span>
                    Comissões e atendimentos
                  </h3>

                  {metrics.commissions_by_professional.length === 0 ? (
                    <div className="empty-sub-state">
                      <p>Nenhum profissional realizou atendimentos no período.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="financial-table">
                        <caption className="sr-only">
                          Demonstrativo consolidado de comissões e atendimentos por profissional
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Profissional</th>
                            <th scope="col" style={{ textAlign: 'center' }}>Atendimentos</th>
                            <th scope="col" style={{ textAlign: 'right' }}>Comissão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.commissions_by_professional.map((item, idx) => (
                            <tr key={item.professional_id || idx}>
                              <td>
                                <div className="prof-cell">
                                  <div className="prof-avatar-sm" aria-hidden="true">
                                    {(item.professional_name || 'P').charAt(0).toUpperCase()}
                                  </div>
                                  <span className="prof-name">{item.professional_name}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                {item.appointments_count}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-brand-primary)' }}>
                                {formatCurrency(item.commission_sum)}
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
          </div>
        </div>
      )}

      <style>{`
        .financial-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          width: 100%;
        }

        .financial-content {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          width: 100%;
        }

        /* Header */
        .financial-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          padding: 1.25rem 1.75rem;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        @media (max-width: 768px) {
          .financial-header-section {
            flex-direction: column;
            align-items: stretch;
            padding: 1.25rem;
          }
        }

        .financial-header-titles h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          margin: 0 0 0.25rem 0;
        }

        .financial-header-titles p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          margin: 0;
        }

        .period-selector {
          display: inline-flex;
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 0.25rem;
          align-self: flex-start;
        }

        .period-btn {
          background: transparent;
          border: none;
          padding: 0.5rem 1.125rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          border-radius: var(--radius-full);
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .period-btn:hover {
          color: var(--color-brand-primary);
        }

        .period-btn--active {
          background-color: var(--color-brand-primary);
          color: #ffffff !important;
          box-shadow: var(--shadow-sm);
        }

        /* Bento Metrics */
        .bento-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          align-items: stretch;
        }

        @media (max-width: 900px) {
          .bento-metrics {
            grid-template-columns: 1fr;
          }
        }

        /* Bento Details */
        .bento-details {
          display: grid;
          grid-template-columns: 1fr 1.75fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .bento-details {
            grid-template-columns: 1fr;
          }
        }

        /* Cards */
        .bento-card {
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .bento-card:hover {
          transform: translateY(-2px);
        }

        .bento-card__shell {
          height: 100%;
        }

        .bento-card__core {
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-sm);
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .bento-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .bento-card__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 700;
          color: var(--color-text-secondary);
        }

        .bento-card__eyebrow-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--color-brand-primary);
        }

        .bento-card__icon-box {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          flex-shrink: 0;
        }

        .bento-card__value {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .bento-card__desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0;
          font-weight: 500;
        }

        .bento-card__section-title {
          font-size: var(--font-size-md);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0 0 1rem 0;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .bento-card__section-title .bento-card__eyebrow {
          font-size: 0.625rem;
        }

        /* Methods List */
        .methods-list {
          display: flex;
          flex-direction: column;
          gap: 1.125rem;
        }

        .method-item {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .method-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-sm);
        }

        .method-name {
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .method-vals {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .method-amount {
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .method-perc {
          font-size: 0.75rem;
          color: var(--color-brand-primary);
          background-color: var(--color-brand-soft);
          padding: 0.125rem 0.4rem;
          border-radius: var(--radius-sm);
          font-weight: 700;
        }

        .progress-bar-bg {
          height: 7px;
          background-color: var(--color-border);
          border-radius: var(--radius-full);
          overflow: hidden;
          width: 100%;
        }

        .progress-bar-fill {
          height: 100%;
          width: 100%;
          background: linear-gradient(90deg, var(--color-brand-primary) 0%, #d97706 100%);
          border-radius: var(--radius-full);
          transform-origin: left;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Table */
        .table-responsive {
          width: 100%;
          overflow-x: auto;
        }

        .financial-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: var(--font-size-sm);
        }

        .financial-table th {
          font-weight: 800;
          text-transform: uppercase;
          font-size: 0.6875rem;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          padding: 0.75rem 1rem;
          border-bottom: 2px solid var(--color-border);
        }

        .financial-table td {
          padding: 0.875rem 1rem;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text-primary);
          vertical-align: middle;
        }

        .financial-table tr:last-child td {
          border-bottom: none;
        }

        .prof-cell {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .prof-avatar-sm {
          width: 30px;
          height: 30px;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.8125rem;
          border: 1px solid var(--color-border);
        }

        .prof-name {
          font-weight: 700;
        }

        /* Empty State */
        .empty-sub-state {
          padding: 2.5rem 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          border: 1.5px dashed var(--color-border);
          border-radius: var(--radius-md);
          background-color: var(--color-bg-primary);
        }

        /* Skeletons */
        .skeleton-container-sub {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
        }

        .skeleton-grid-top {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
        }

        @media (max-width: 900px) {
          .skeleton-grid-top {
            grid-template-columns: 1fr;
          }
        }

        .skeleton-grid-bottom {
          display: grid;
          grid-template-columns: 1fr 1.75fr;
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .skeleton-grid-bottom {
            grid-template-columns: 1fr;
          }
        }

        .skeleton--card {
          height: 120px;
        }

        .skeleton--panel {
          height: 260px;
        }
      `}</style>
    </div>
  );
};
