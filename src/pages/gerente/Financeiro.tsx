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
      gsap.fromTo('.metric-card', 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out' }
      );
      gsap.fromTo('.financial-details-grid > section',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.15, stagger: 0.1, ease: 'power2.out' }
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            <div className="skeleton" style={{ height: '120px' }} />
            <div className="skeleton" style={{ height: '120px' }} />
            <div className="skeleton" style={{ height: '120px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            <div className="skeleton" style={{ height: '280px' }} />
            <div className="skeleton" style={{ height: '280px' }} />
          </div>
        </div>
      ) : (
        <div className="financial-content">
          {/* CARDS DE MÉTRICAS */}
          <section className="metrics-grid">
            {/* Card 1: Faturamento Bruto */}
            <div className="metric-card">
              <div className="metric-card__header">
                <span className="metric-card__title">Faturamento Bruto</span>
                <span className="metric-card__icon text-brand">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" x2="12" y1="2" y2="22" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
              </div>
              <div className="metric-card__value">{formatCurrency(metrics.total_revenue)}</div>
              <p className="metric-card__desc">Soma de todos os pagamentos recebidos</p>
            </div>

            {/* Card 2: Comissões Acumuladas */}
            <div className="metric-card">
              <div className="metric-card__header">
                <span className="metric-card__title">Comissões da Equipe</span>
                <span className="metric-card__icon text-warning">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
              </div>
              <div className="metric-card__value">{formatCurrency(metrics.total_commission)}</div>
              <p className="metric-card__desc">Valor total repassado aos barbeiros</p>
            </div>

            {/* Card 3: Lucro Líquido */}
            <div className="metric-card metric-card--highlight">
              <div className="metric-card__header">
                <span className="metric-card__title">Faturamento Líquido</span>
                <span className="metric-card__icon text-success">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </span>
              </div>
              <div className="metric-card__value">{formatCurrency(metrics.net_revenue)}</div>
              <p className="metric-card__desc">Caixa livre após repasse de comissões</p>
            </div>
          </section>

          <div className="financial-details-grid">
            {/* Lado esquerdo: Métodos de Pagamento */}
            <section className="card methods-card">
              <h3>Faturamento por Método</h3>
              
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
            </section>

            {/* Lado direito: Comissões dos Profissionais */}
            <section className="card professionals-commission-card">
              <h3>Comissões e Atendimentos</h3>
              
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
                        <th style={{ textAlign: 'right' }}>Comissão Acumulada</th>
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
            </section>
          </div>
        </div>
      )}

      <style>{`
        .financial-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .financial-header-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1.5rem;
          padding: 1.25rem 1.75rem;
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-lg);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--shadow-sm);
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
          background-color: rgba(255, 255, 255, 0.5);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 0.25rem;
          box-shadow: var(--shadow-sm);
          backdrop-filter: blur(4px);
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

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
          width: 100%;
        }

        .metric-card {
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--shadow-sm);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .metric-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
          border-color: rgba(217, 108, 0, 0.3);
        }

        .metric-card--highlight {
          border-color: rgba(217, 108, 0, 0.25);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.55) 0%, rgba(254, 243, 199, 0.3) 100%);
        }

        .metric-card__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .metric-card__title {
          font-size: var(--font-size-xs);
          text-transform: uppercase;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .metric-card__icon {
          display: flex;
          align-items: center;
        }

        .metric-card__value {
          font-size: var(--font-size-2xl);
          font-weight: 800;
          color: var(--color-text-primary);
          letter-spacing: -0.02em;
          margin-bottom: 0.25rem;
        }

        .metric-card__desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0;
          font-weight: 600;
        }

        .text-brand { color: var(--color-brand-primary); }
        .text-success { color: var(--color-success); }
        .text-warning { color: var(--color-warning); }

        .financial-details-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 1.5rem;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .financial-details-grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background-color: rgba(255, 255, 255, 0.45);
          backdrop-filter: blur(12px) saturate(120%);
          -webkit-backdrop-filter: blur(12px) saturate(120%);
          border: 1px solid rgba(234, 222, 214, 0.5);
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), var(--shadow-sm);
        }

        .card h3 {
          font-size: var(--font-size-lg);
          font-weight: 800;
          margin-bottom: 1.25rem;
          border-bottom: 1px solid rgba(234, 222, 214, 0.8);
          padding-bottom: 0.5rem;
          color: var(--color-text-primary);
        }

        .empty-sub-state {
          padding: 4rem 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
          font-style: italic;
          font-size: var(--font-size-sm);
          border: 1.5px dashed rgba(234, 222, 214, 0.8);
          border-radius: var(--radius-lg);
          background-color: rgba(255, 255, 255, 0.25);
        }

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
          border-radius: var(--radius-sm);
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

        /* Skeleton Styles */
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
