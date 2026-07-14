import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../components/GerenteLayout';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

interface FinancialMetrics {
  total_revenue: number;
  total_commission: number;
  net_revenue: number;
  revenue_by_method: Record<string, number>;
  commissions_by_professional: Array<{
    professional_name: string;
    commission_sum: number;
    appointments_count: number;
  }>;
}

export const Financeiro: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'this_month' | 'last_30_days' | 'last_90_days'>('this_month');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);

  const calculateDates = () => {
    const now = new Date();
    let startDate = new Date();

    if (period === 'this_month') {
      // Primeiro dia do mês atual às 00:00:00
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (period === 'last_30_days') {
      // 30 dias atrás
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'last_90_days') {
      // 90 dias atrás
      startDate.setDate(now.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
    }

    // Fim do dia atual às 23:59:59
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

      // Chamando a RPC segura criada no Postgres
      const { data, error } = await supabase.rpc('get_tenant_financial_metrics', {
        p_start_date: start,
        p_end_date: end
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
  }, [tenant.tenantId, period]);

  useGSAP(() => {
    if (!loading && metrics) {
      const tl = gsap.timeline({
        defaults: { ease: 'cubic-bezier(0.32, 0.72, 0, 1)' },
      });
      tl.fromTo('.bento-card',
        { y: 30, opacity: 0, scale: 0.97 },
        { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.08 },
      );
      tl.fromTo('.bento-details .bento-card',
        { y: 25, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 },
        '-=0.3',
      );
    }
  }, [loading, metrics]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Obter métodos e valores ordenados para as barras de progresso
  const getMethodList = () => {
    if (!metrics || !metrics.revenue_by_method) return [];
    
    const methods = ['PIX', 'Cartão', 'Dinheiro'];
    const list = methods.map((m) => ({
      name: m,
      val: metrics.revenue_by_method[m] || 0
    }));

    return list.sort((a, b) => b.val - a.val);
  };

  const methodsList = getMethodList();
  const maxMethodVal = Math.max(...methodsList.map(m => m.val), 1);

  return (
    <div className="financial-page">
      <div className="financial-header-section">
        <div>
          <h2>Relatório Financeiro</h2>
          <p>Acompanhe o faturamento bruto, repasses de comissão e lucratividade líquida da barbearia.</p>
        </div>

        {/* Seletor de Período Coeso */}
        <div className="period-selector">
          <button 
            onClick={() => setPeriod('this_month')} 
            className={`period-btn ${period === 'this_month' ? 'period-btn--active' : ''}`}
          >
            Este Mês
          </button>
          <button 
            onClick={() => setPeriod('last_30_days')} 
            className={`period-btn ${period === 'last_30_days' ? 'period-btn--active' : ''}`}
          >
            Últimos 30 Dias
          </button>
          <button 
            onClick={() => setPeriod('last_90_days')} 
            className={`period-btn ${period === 'last_90_days' ? 'period-btn--active' : ''}`}
          >
            Últimos 90 Dias
          </button>
        </div>
      </div>

      {loading || !metrics ? (
        <div className="skeleton-container-sub">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <div className="skeleton" style={{ height: '120px' }} />
            <div className="skeleton" style={{ height: '120px' }} />
            <div className="skeleton" style={{ height: '120px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem', marginTop: '2.5rem' }}>
            <div className="skeleton" style={{ height: '280px' }} />
            <div className="skeleton" style={{ height: '280px' }} />
          </div>
        </div>
      ) : (
        <div className="financial-content">
          {/* ═══ BENTO METRICS GRID ═══ */}
          <div className="bento-metrics">
            {/* Card: Faturamento Bruto */}
            <div className="bento-card bento-card--primary">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <div className="bento-card__header">
                    <div className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Faturamento Bruto
                    </div>
                    <span className="bento-card__icon-box text-brand">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <line x1="12" x2="12" y1="2" y2="22" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </span>
                  </div>
                  <div className="bento-card__value">{formatCurrency(metrics.total_revenue)}</div>
                  <p className="bento-card__desc">Soma de todos os pagamentos recebidos no período</p>
                </div>
              </div>
            </div>

            {/* Card Superior Direito: Comissões */}
            <div className="bento-card bento-card--sm">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <div className="bento-card__header">
                    <div className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Comissões
                    </div>
                    <span className="bento-card__icon-box text-warning">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                  </div>
                  <div className="bento-card__value">{formatCurrency(metrics.total_commission)}</div>
                  <p className="bento-card__desc">Valor repassado aos barbeiros</p>
                </div>
              </div>
            </div>

            {/* Card Inferior Direito: Líquido (highlight) */}
            <div className="bento-card bento-card--sm bento-card--accent">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <div className="bento-card__header">
                    <div className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Faturamento Líquido
                    </div>
                    <span className="bento-card__icon-box text-success">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="bento-card__value">{formatCurrency(metrics.net_revenue)}</div>
                  <p className="bento-card__desc">Caixa livre após comissões</p>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ BENTO DETAILS GRID ═══ */}
          <div className="bento-details">
            {/* Card Esquerdo: Métodos de Pagamento (double-bezel) */}
            <div className="bento-card">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <h3 className="bento-card__section-title">
                    <span className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Receitas
                    </span>
                    Faturamento por Método
                  </h3>
                  
                  {metrics.total_revenue === 0 ? (
                    <div className="empty-sub-state">
                      <p>Sem faturamento registrado neste período.</p>
                    </div>
                  ) : (
                    <div className="methods-list">
                      {methodsList.map((method) => {
                        const percentage = metrics.total_revenue > 0 ? (method.val / metrics.total_revenue) * 100 : 0;
                        return (
                          <div key={method.name} className="method-item">
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
                                style={{ width: `${(method.val / maxMethodVal) * 100}%` }}
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

            {/* Card Direito: Comissões dos Profissionais (double-bezel, wide) */}
            <div className="bento-card bento-card--wide">
              <div className="bento-card__shell">
                <div className="bento-card__core">
                  <h3 className="bento-card__section-title">
                    <span className="bento-card__eyebrow">
                      <span className="bento-card__eyebrow-dot" />
                      Repasses
                    </span>
                    Comissões e Atendimentos
                  </h3>
                  
                  {metrics.commissions_by_professional.length === 0 ? (
                    <div className="empty-sub-state">
                      <p>Nenhum profissional realizou atendimentos no período.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="financial-table">
                        <thead>
                          <tr>
                            <th>Profissional</th>
                            <th style={{ textAlign: 'center' }}>Atendimentos</th>
                            <th style={{ textAlign: 'right' }}>Comissão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {metrics.commissions_by_professional.map((item, idx) => (
                            <tr key={idx}>
                              <td>
                                <div className="prof-cell">
                                  <div className="prof-avatar-sm">
                                    {item.professional_name.charAt(0).toUpperCase()}
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
          gap: 2.5rem;
        }

        .financial-content {
          display: flex;
          flex-direction: column;
          gap: 2.5rem;
        }

        /* ═══ HEADER — liquid glass ═══ */
        .financial-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          padding: 1.25rem 1.75rem;
          background: 
            radial-gradient(ellipse 40% 60% at 15% 50%, rgba(217, 108, 0, 0.05) 0%, transparent 60%),
            radial-gradient(ellipse 40% 60% at 85% 50%, rgba(217, 108, 0, 0.03) 0%, transparent 55%),
            linear-gradient(145deg, rgba(255,255,255,0.78) 0%, rgba(255,241,230,0.5) 45%, rgba(255,255,255,0.72) 100%);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: var(--radius-lg);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 8px 32px -8px rgba(45, 35, 30, 0.08);
        }

        @media (max-width: 768px) {
          .financial-header-section {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        .financial-header-section h2 {
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
        }

        .financial-header-section p {
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .period-selector {
          display: flex;
          background: 
            radial-gradient(ellipse 60% 80% at 30% 50%, rgba(217, 108, 0, 0.04) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 70% 50%, rgba(217, 108, 0, 0.02) 0%, transparent 55%),
            linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,241,230,0.4) 50%, rgba(255,255,255,0.75) 100%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          border-radius: var(--radius-full);
          padding: 0.25rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 4px 16px -6px rgba(45, 35, 30, 0.08);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
        }

        .period-btn {
          background: none;
          border: none;
          padding: 0.5rem 1.25rem;
          font-size: var(--font-size-xs);
          font-weight: 700;
          border-radius: var(--radius-full);
          cursor: pointer;
          color: var(--color-text-secondary);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .period-btn:hover {
          color: var(--color-brand-primary);
        }

        .period-btn--active {
          background-color: var(--color-brand-primary);
          color: white !important;
          box-shadow: var(--shadow-sm);
        }

        /* ═══ BENTO METRICS GRID ═══ */
        .bento-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          align-items: stretch;
        }

        @media (max-width: 900px) {
          .bento-metrics {
            grid-template-columns: 1fr;
          }
        }

        /* ═══ BENTO DETAILS GRID ═══ */
        .bento-details {
          display: grid;
          grid-template-columns: 1fr 1.8fr;
          gap: 2rem;
          align-items: start;
          grid-auto-flow: dense;
        }

        @media (max-width: 1024px) {
          .bento-details {
            grid-template-columns: 1fr;
          }
        }

        /* ═══ CARD SYSTEM — clean with hover lift ═══ */
        .bento-card {
          opacity: 0; /* revealed by GSAP */
          transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .bento-card:hover {
          transform: translateY(-4px);
        }

        .bento-card__shell {
          height: 100%;
        }

        .bento-card__core {
          background-color: var(--color-bg-secondary);
          border-radius: 1.25rem;
          padding: 1.75rem;
          border: 1px solid rgba(255, 255, 255, 0.7);
          box-shadow: 0 1px 3px rgba(45, 35, 30, 0.04), 0 8px 24px -8px rgba(45, 35, 30, 0.06);
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .bento-card:hover .bento-card__core {
          border-color: rgba(217, 108, 0, 0.15);
          box-shadow: 0 1px 3px rgba(45, 35, 30, 0.04), 0 12px 32px -10px rgba(45, 35, 30, 0.1);
        }

        /* Card highlight (líquido) — mesmo style dos demais */
        .bento-card--accent .bento-card__core {
          border-color: rgba(217, 108, 0, 0.15);
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
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
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
          border-radius: 10px;
          background-color: rgba(45, 35, 30, 0.04);
          border: 1px solid rgba(45, 35, 30, 0.06);
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
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-text-primary);
          margin: 0 0 1.25rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid rgba(234, 222, 214, 0.7);
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .bento-card__section-title .bento-card__eyebrow {
          font-size: 0.6rem;
        }

        /* ═══ TEXT COLORS ═══ */
        .text-brand { color: var(--color-brand-primary); }
        .text-success { color: var(--color-success); }
        .text-warning { color: var(--color-warning); }

        /* ═══ EMPTY STATE ═══ */
        .empty-sub-state {
          padding: 3rem 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
          font-style: italic;
          font-size: var(--font-size-sm);
          border: 1.5px dashed rgba(234, 222, 214, 0.8);
          border-radius: var(--radius-lg);
          background-color: rgba(255, 255, 255, 0.25);
        }

        /* ═══ METHODS LIST ═══ */
        .methods-list {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
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
          background-color: rgba(217, 108, 0, 0.1);
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-weight: 700;
        }

        .progress-bar-bg {
          height: 8px;
          background-color: rgba(234, 222, 214, 0.6);
          border-radius: var(--radius-full);
          overflow: hidden;
          width: 100%;
        }

        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-brand-primary) 0%, #ff8b3d 100%);
          border-radius: var(--radius-full);
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* ═══ TABLE ═══ */
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
          font-size: 0.7rem;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
          padding: 0.75rem 1rem;
          border-bottom: 2px solid rgba(234, 222, 214, 0.8);
        }

        .financial-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(234, 222, 214, 0.5);
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
          width: 32px;
          height: 32px;
          border-radius: var(--radius-full);
          background-color: var(--color-brand-soft);
          color: var(--color-brand-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 0.875rem;
          border: 1.5px solid rgba(255, 255, 255, 0.6);
          box-shadow: var(--shadow-sm);
        }

        .prof-name {
          font-weight: 700;
        }

        /* ═══ SKELETON ═══ */
        .skeleton-container-sub {
          display: flex;
          flex-direction: column;
          width: 100%;
        }

        .skeleton {
          background: linear-gradient(
            90deg,
            var(--color-bg-secondary) 25%,
            var(--color-border) 37%,
            var(--color-bg-secondary) 63%
          );
          background-size: 400% 100%;
          animation: skeleton-loading 1.4s ease infinite;
          border-radius: var(--radius-md);
        }
      `}</style>
    </div>
  );
};
