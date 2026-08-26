import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

// Interfaces
interface ProfessionalProfile {
  id: string;
  name: string;
  tenant_id: string;
  commission_percentage: number;
}

interface HistoryItem {
  id: string;
  date: string;
  customerName: string;
  serviceName: string;
  servicePrice: number;
  commissionPercentage: number;
  commissionEarned: number;
}

// Icones SVG Inline
const CalendarIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const CoinsIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <circle cx="18" cy="18" r="4" />
    <path d="M12 18a6 6 0 0 0-6-6" />
  </svg>
);

const TrendingUpIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

export const MinhasComissoes: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // Estados
  const [loading, setLoading] = useState<boolean>(true);
  const [professional, setProfessional] = useState<ProfessionalProfile | null>(null);
  const [period, setPeriod] = useState<'today' | '7days' | 'month'>('month');
  
  const [totalCommission, setTotalCommission] = useState<number>(0);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // 1. Verificar autenticacao e buscar perfil do profissional
  useEffect(() => {
    let isMounted = true;

    const checkUserAndFetchProfile = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          addToast('Sessão expirada. Faça login novamente.', 'warning');
          navigate('/');
          return;
        }

        // Buscar profissional associado ao user_id
        const { data: profData, error: profError } = await supabase
          .from('professionals')
          .select('id, name, tenant_id, commission_percentage')
          .eq('user_id', session.user.id)
          .single();

        if (profError || !profData) {
          if (isMounted) {
            addToast('Profissional não associado a este usuário.', 'error');
            setLoading(false);
            navigate('/');
          }
        } else if (isMounted) {
          setProfessional(profData);
        }
      } catch (err: any) {
        console.error('Erro na autenticação:', err);
        addToast('Erro ao validar permissões de acesso.', 'error');
        navigate('/');
      }
    };

    checkUserAndFetchProfile();

    return () => {
      isMounted = false;
    };
  }, [navigate, addToast]);

  // 2. Buscar/Gerar dados de comissão com base no período selecionado
  useEffect(() => {
    if (!professional) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Calcular limites de data
        const now = new Date();
        let startDate = new Date();
        
        if (period === 'today') {
          startDate.setHours(0, 0, 0, 0);
        } else if (period === '7days') {
          startDate.setDate(now.getDate() - 7);
          startDate.setHours(0, 0, 0, 0);
        } else if (period === 'month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
        }

        // Query Supabase: Consulta itens de comandas fechadas atribuídos ao profissional
        const { data, error } = await supabase
          .from('comanda_itens')
          .select(`
            id,
            quantity,
            unit_price,
            total_price,
            item_type,
            created_at,
            professional_id,
            comanda:comandas!inner(
              id,
              status,
              closed_at,
              created_at,
              customer:customers(name)
            ),
            service:services(name, price, commission_percentage),
            product:products(name, price, commission_percentage)
          `)
          .eq('professional_id', professional.id)
          .in('comanda.status', ['fechada', 'closed'])
          .gte('comanda.closed_at', startDate.toISOString())
          .lte('comanda.closed_at', now.toISOString())
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (isMounted) {
          const items = (data as any[]) || [];
          
          let commissionSum = 0;
          let revenueSum = 0;
          const historyItems: HistoryItem[] = [];

          items.forEach((item) => {
            const isProduct = item.item_type === 'product' || item.item_type === 'produto' || Boolean(item.product && !item.service);
            const totalPrice = Number(
              item.total_price ||
              (Number(item.unit_price || 0) * Number(item.quantity || 1)) ||
              0
            );

            let commPercentage = 0;
            if (isProduct) {
              commPercentage = Number(item.product?.commission_percentage ?? 0);
            } else {
              commPercentage = Number(
                item.service?.commission_percentage ?? professional.commission_percentage ?? 0
              );
            }

            const commVal = Number(((totalPrice * commPercentage) / 100).toFixed(2));
            commissionSum += commVal;
            revenueSum += totalPrice;

            const name = isProduct
              ? (item.product?.name || 'Produto')
              : (item.service?.name || 'Serviço');

            historyItems.push({
              id: item.id,
              date: item.comanda?.closed_at || item.created_at,
              customerName: item.comanda?.customer?.name || 'Cliente Balcão',
              serviceName: name,
              servicePrice: totalPrice,
              commissionPercentage: Math.round(commPercentage),
              commissionEarned: commVal,
            });
          });

          setTotalCommission(Number(commissionSum.toFixed(2)));
          setTotalRevenue(Number(revenueSum.toFixed(2)));
          setHistory(historyItems);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Erro ao consultar faturamento do barbeiro:', err);
        addToast('Erro ao carregar dados de comissão do banco.', 'error');
        if (isMounted) {
          setTotalCommission(0);
          setTotalRevenue(0);
          setHistory([]);
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [professional, period, addToast]);

  // 3. Animações GSAP
  useGSAP(() => {
    if (!loading && containerRef.current) {
      // Stats cards: spring entry with scale
      gsap.fromTo('.gsap-stat-card',
        { opacity: 0, y: 24, scale: 0.96 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.8,
          stagger: 0.12,
          ease: 'cubic-bezier(0.32, 0.72, 0, 1)'
        }
      );

      // History section: fade-up with blur
      gsap.fromTo('.gsap-history-section',
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.7, delay: 0.25, ease: 'cubic-bezier(0.32, 0.72, 0, 1)' }
      );

      // Table rows: staggered slide-in
      gsap.fromTo('.gsap-history-row',
        { opacity: 0, x: -8 },
        {
          opacity: 1, x: 0,
          duration: 0.5,
          stagger: 0.04,
          ease: 'cubic-bezier(0.32, 0.72, 0, 1)',
          delay: 0.35
        }
      );
    }
  }, [loading, period]);

  // Função para formatar moeda brasileira
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Função para formatar data e hora legível
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* Noise/grain overlay - estética premium de textura de papel/analogica */}
      <div className="noise-overlay" />

      <div className="page-wrapper" ref={containerRef}>

        {/* PERIOD FILTER — Compact pill-shaped filter */}
        <section className="period-filter">
          <CalendarIcon size={16} />
          <span className="period-filter-label">Período</span>
          <div className="period-filter-divider" />
          <div className="period-options">
            {(['today', '7days', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`period-opt${period === p ? ' active' : ''}`}
              >
                {p === 'today' ? 'Hoje' : p === '7days' ? '7 Dias' : 'Mês'}
              </button>
            ))}
          </div>
        </section>

        {/* CONTEÚDO PRINCIPAL OU SKELETON */}
        {loading ? (
          <div className="skeleton-wrapper">
            <div className="stats-bento">
              <div className="stats-shell">
                <div className="skeleton" style={{ height: '160px', borderRadius: 'var(--radius-xl)' }} />
              </div>
              <div className="stats-shell">
                <div className="skeleton" style={{ height: '160px', borderRadius: 'var(--radius-xl)' }} />
              </div>
            </div>
            <div className="history-shell">
              <div className="history-inner">
                <div className="skeleton" style={{ height: '50px', borderRadius: 'var(--radius-lg)', marginBottom: '1rem' }} />
                <div className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }} />
                <div className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-md)', marginBottom: '0.5rem' }} />
                <div className="skeleton" style={{ height: '60px', borderRadius: 'var(--radius-md)' }} />
              </div>
            </div>
          </div>
        ) : (
          <main className="main-content">
            {/* CARDS DE FATURAMENTO — Double-Bezel */}
            <div className="stats-bento">
              {/* CARD COMISSÃO */}
              <div className="stats-card gsap-stat-card">
                <div className="stats-shell">
                  <div className="stats-inner">
                    <div className="stats-top">
                      <span className="stats-eyebrow">Comissão</span>
                      <div className="stats-icon-wrap commission-glow">
                        <CoinsIcon size={22} />
                      </div>
                    </div>
                    <div className="stats-value comm-value">
                      {formatCurrency(totalCommission)}
                    </div>
                    <p className="stats-footnote">
                      Sua comissão: <strong>{professional?.commission_percentage}%</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD RECEITA */}
              <div className="stats-card gsap-stat-card">
                <div className="stats-shell">
                  <div className="stats-inner">
                    <div className="stats-top">
                      <span className="stats-eyebrow">Receita Gerada</span>
                      <div className="stats-icon-wrap revenue-glow">
                        <TrendingUpIcon size={22} />
                      </div>
                    </div>
                    <div className="stats-value revenue-val">
                      {formatCurrency(totalRevenue)}
                    </div>
                    <p className="stats-footnote">
                      Valor total dos serviços no período.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* HISTÓRICO — Double-Bezel */}
            <section className="history-bezel gsap-history-section">
              <div className="history-shell">
                <div className="history-inner">
                  <div className="history-header">
                    <span className="history-eyebrow">Histórico</span>
                    <h2 className="history-title">Atendimentos Concluídos</h2>
                  </div>
                  
                  {history.length === 0 ? (
                    <div className="empty-state">
                      <p>Nenhum agendamento com pagamento registrado neste período.</p>
                    </div>
                  ) : (
                    <div className="table-responsive-container">
                      {/* Desktop Table */}
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Cliente</th>
                            <th>Serviço</th>
                            <th className="th-num">Valor</th>
                            <th className="th-num">%</th>
                            <th className="th-num">Comissão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((item) => (
                            <tr key={item.id} className="gsap-history-row">
                              <td className="td-date">{formatDate(item.date)}</td>
                              <td className="td-client">{item.customerName}</td>
                              <td className="td-service">
                                <span className="service-chip">{item.serviceName}</span>
                              </td>
                              <td className="td-num">{formatCurrency(item.servicePrice)}</td>
                              <td className="td-num">
                                <span className="pct-chip">{item.commissionPercentage}%</span>
                              </td>
                              <td className="td-num td-commission">
                                {formatCurrency(item.commissionEarned)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Mobile Cards */}
                      <div className="mobile-list">
                        {history.map((item) => (
                          <div key={item.id} className="mobile-entry gsap-history-row">
                            <div className="mobile-entry-top">
                              <span className="mobile-entry-date">{formatDate(item.date)}</span>
                              <span className="mobile-entry-service">{item.serviceName}</span>
                            </div>
                            <div className="mobile-entry-body">
                              <div className="mobile-entry-row">
                                <span>Cliente</span>
                                <span className="mobile-entry-val">{item.customerName}</span>
                              </div>
                              <div className="mobile-entry-row">
                                <span>Valor</span>
                                <span>{formatCurrency(item.servicePrice)}</span>
                              </div>
                              <div className="mobile-entry-divider" />
                              <div className="mobile-entry-row mobile-entry-highlight">
                                <span>Sua Comissão <span className="pct-inline">({item.commissionPercentage}%)</span></span>
                                <span className="mobile-entry-comm">{formatCurrency(item.commissionEarned)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </main>
        )}
      </div>

      {/* ESTILOS CSS — HIGH-END VISUAL DESIGN */}
      <style>{`
        /* =========================================
           PAGE SHELL
           ========================================= */
        .page-wrapper {
          min-height: 100vh;
          min-height: 100dvh;
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          padding: 1.5rem;
          max-width: 1120px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          font-family: var(--font-family-base);
        }

        /* =========================================
           PERIOD FILTER — Compact pill
           ========================================= */
        .period-filter {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          width: max-content;
          max-width: 100%;
          padding: 0.5rem 1rem 0.5rem 1.25rem;
          border-radius: var(--radius-full);
          background: var(--color-bg-secondary);
          border: 0.5px solid rgba(234, 222, 214, 0.6);
          box-shadow: var(--shadow-sm);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 500;
          margin: 0 auto;
        }

        .period-filter-label {
          font-weight: 600;
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          letter-spacing: 0.02em;
        }

        .period-filter-divider {
          width: 1px;
          height: 16px;
          background: rgba(234, 222, 214, 0.4);
        }

        .period-options {
          display: flex;
          gap: 0.25rem;
        }

        .period-opt {
          background: transparent;
          border: none;
          padding: 0.3rem 0.75rem;
          border-radius: var(--radius-full);
          color: var(--color-text-secondary);
          font-size: var(--font-size-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .period-opt:hover {
          color: var(--color-text-primary);
          background: rgba(45, 35, 30, 0.04);
        }

        .period-opt.active {
          color: var(--color-brand-lightest);
          background: var(--color-brand-primary);
          box-shadow: 0 2px 8px rgba(217, 108, 0, 0.2);
        }

        .period-opt.active:active {
          transform: scale(0.96);
        }

        /* =========================================
           MAIN CONTENT
           ========================================= */
        .main-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* =========================================
           STATS BENTO — Double-Bezel cards
           ========================================= */
        .stats-bento {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }

        /* Card outer wrapper — hover physics anchor */
        .stats-card {
          transition:
            transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .stats-card:hover {
          transform: translateY(-3px);
        }

        .stats-card:active {
          transform: translateY(0) scale(0.98);
          transition-duration: 0.12s;
        }

        /* Outer Shell (Doppelrand) */
        .stats-shell {
          background: rgba(45, 35, 30, 0.04);
          padding: 1px;
          border-radius: calc(var(--radius-xl) + 2px);
          box-shadow: inset 0 1px 2px rgba(45, 35, 30, 0.04);
          transition:
            box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1),
            background 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .stats-card:hover .stats-shell {
          background: rgba(217, 108, 0, 0.06);
          box-shadow:
            inset 0 1px 2px rgba(45, 35, 30, 0.04),
            0 4px 20px rgba(217, 108, 0, 0.08);
        }

        .stats-card:hover .stats-inner {
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            0 4px 24px rgba(45, 35, 30, 0.06);
        }

        .stats-inner {
          background: var(--color-bg-secondary);
          border-radius: var(--radius-xl);
          padding: 1.5rem 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          position: relative;
          overflow: hidden;
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            0 4px 16px rgba(45, 35, 30, 0.04);
          transition:
            box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        /* Subtle radial glow behind icon */
        .stats-inner::before {
          content: '';
          position: absolute;
          top: -40%;
          right: -20%;
          width: 140px;
          height: 140px;
          border-radius: 50%;
          pointer-events: none;
          opacity: 0.5;
        }

        .stats-card:first-child .stats-inner::before {
          background: radial-gradient(circle, rgba(217, 108, 0, 0.08), transparent 70%);
        }

        .stats-card:last-child .stats-inner::before {
          background: radial-gradient(circle, rgba(63, 131, 248, 0.06), transparent 70%);
        }

        .stats-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .stats-eyebrow {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--color-text-secondary);
          opacity: 0.7;
          padding: 0.2rem 0.6rem;
          border-radius: var(--radius-full);
          background: rgba(45, 35, 30, 0.04);
        }

        .stats-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: var(--radius-lg);
          flex-shrink: 0;
        }

        .commission-glow {
          background: rgba(217, 108, 0, 0.08);
          color: var(--color-brand-primary);
        }

        .revenue-glow {
          background: rgba(63, 131, 248, 0.08);
          color: var(--color-info);
        }

        .stats-value {
          font-size: 2.5rem;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -0.03em;
          font-family: var(--font-family-base);
        }

        .comm-value {
          color: var(--color-brand-primary);
        }

        .revenue-val {
          color: var(--color-text-primary);
        }

        .stats-footnote {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          line-height: 1.4;
          opacity: 0.8;
        }

        .stats-footnote strong {
          color: var(--color-brand-primary);
          font-weight: 700;
        }

        /* =========================================
           HISTORY BEZEL — Double-Bezel
           ========================================= */
        .history-bezel {
          /* Outer shell wrapper */
        }

        .history-bezel {
          transition:
            transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .history-bezel:hover {
          transform: translateY(-2px);
        }

        .history-shell {
          background: rgba(45, 35, 30, 0.04);
          padding: 1px;
          border-radius: calc(var(--radius-xl) + 2px);
          box-shadow: inset 0 1px 2px rgba(45, 35, 30, 0.04);
          transition:
            box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1),
            background 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .history-bezel:hover .history-shell {
          background: rgba(217, 108, 0, 0.04);
          box-shadow:
            inset 0 1px 2px rgba(45, 35, 30, 0.04),
            0 4px 20px rgba(217, 108, 0, 0.06);
        }

        .history-inner {
          background: var(--color-bg-secondary);
          border-radius: var(--radius-xl);
          padding: 1.5rem;
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            0 4px 16px rgba(45, 35, 30, 0.04);
          transition:
            box-shadow 0.5s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .history-bezel:hover .history-inner {
          box-shadow:
            inset 0 1px 1px rgba(255, 255, 255, 0.6),
            0 4px 24px rgba(45, 35, 30, 0.06);
        }

        .history-header {
          margin-bottom: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .history-eyebrow {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--color-text-secondary);
          opacity: 0.6;
        }

        .history-title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
        }

        /* =========================================
           TABLE
           ========================================= */
        .table-responsive-container {
          overflow-x: auto;
          width: 100%;
          -webkit-overflow-scrolling: touch;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .history-table th {
          padding: 0.75rem 1rem;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-secondary);
          opacity: 0.6;
          border-bottom: 1px solid rgba(234, 222, 214, 0.4);
        }

        .history-table td {
          padding: 0.875rem 1rem;
          font-size: var(--font-size-sm);
          border-bottom: 1px solid rgba(234, 222, 214, 0.2);
          vertical-align: middle;
          color: var(--color-text-primary);
        }

        .history-table tbody tr {
          transition: background-color 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .history-table tbody tr:hover {
          background-color: rgba(217, 108, 0, 0.03);
        }

        .history-table tbody tr:last-child td {
          border-bottom: none;
        }

        .th-num {
          text-align: right;
        }

        .td-date {
          color: var(--color-text-secondary);
          white-space: nowrap;
          font-size: var(--font-size-xs);
        }

        .td-client {
          font-weight: 600;
        }

        .service-chip {
          display: inline-block;
          padding: 0.2rem 0.6rem;
          border-radius: var(--radius-md);
          background: rgba(45, 35, 30, 0.04);
          font-size: var(--font-size-xs);
          font-weight: 500;
          color: var(--color-text-primary);
        }

        .pct-chip {
          display: inline-flex;
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-full);
          background: rgba(14, 159, 110, 0.08);
          color: var(--color-success);
          font-size: var(--font-size-xs);
          font-weight: 700;
        }

        .td-num {
          text-align: right;
          white-space: nowrap;
        }

        .td-commission {
          font-weight: 700;
          color: var(--color-brand-primary);
        }

        /* =========================================
           MOBILE LIST
           ========================================= */
        .mobile-list {
          display: none;
          flex-direction: column;
          gap: 0.75rem;
        }

        .mobile-entry {
          background: var(--color-bg-secondary);
          border: 0.5px solid rgba(234, 222, 214, 0.4);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .mobile-entry:hover {
          border-color: rgba(217, 108, 0, 0.15);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(45, 35, 30, 0.06);
        }

        .mobile-entry-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 0.5px solid rgba(234, 222, 214, 0.3);
          background: rgba(45, 35, 30, 0.02);
        }

        .mobile-entry-date {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .mobile-entry-service {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-brand-primary);
          padding: 0.15rem 0.5rem;
          border-radius: var(--radius-md);
          background: rgba(217, 108, 0, 0.06);
        }

        .mobile-entry-body {
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mobile-entry-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .mobile-entry-row span:last-child {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .mobile-entry-divider {
          height: 0.5px;
          background: rgba(234, 222, 214, 0.3);
          margin: 0.125rem 0;
        }

        .mobile-entry-highlight {
          padding-top: 0.375rem;
        }

        .mobile-entry-highlight span:first-child {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .mobile-entry-highlight .mobile-entry-comm {
          color: var(--color-brand-primary);
          font-weight: 800;
          font-size: var(--font-size-base);
        }

        .pct-inline {
          color: var(--color-text-secondary);
          font-weight: 500;
          font-size: var(--font-size-xs);
        }

        /* =========================================
           EMPTY STATE
           ========================================= */
        .empty-state {
          text-align: center;
          padding: 3rem 1.5rem;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }

        /* =========================================
           SKELETON LOADING
           ========================================= */
        .skeleton-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .skeleton {
          background: linear-gradient(
            90deg,
            rgba(234, 222, 214, 0.3) 25%,
            rgba(234, 222, 214, 0.08) 50%,
            rgba(234, 222, 214, 0.3) 75%
          );
          background-size: 200% 100%;
          animation: skeleton-loading 1.8s ease-in-out infinite;
          border-radius: var(--radius-md);
        }

        .skeleton-card {
          border-radius: var(--radius-xl);
        }

        .skeleton-table-header {
          border-radius: var(--radius-lg);
        }

        .skeleton-row {
          margin-bottom: 0.5rem;
        }

        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* =========================================
           RESPONSIVE — Mobile < 768px
           ========================================= */
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 1rem;
            gap: 1rem;
          }

          .stats-bento {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .stats-value {
            font-size: 2rem;
          }

          .stats-inner {
            padding: 1.25rem;
          }

          .period-filter {
            width: 100%;
            justify-content: center;
            flex-wrap: wrap;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
          }

          .period-opt {
            padding: 0.25rem 0.6rem;
            font-size: 11px;
          }

          .history-table {
            display: none;
          }

          .mobile-list {
            display: flex;
          }

          .history-inner {
            padding: 1rem;
          }
        }
      `}</style>
    </>
  );
};
