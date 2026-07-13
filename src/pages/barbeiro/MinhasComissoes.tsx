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

interface PaymentRecord {
  id: string;
  amount: number;
  commission_value: number;
  paid_at: string;
  appointment: {
    id: string;
    status: string;
    start_time: string;
    customer: {
      name: string;
    } | null;
    service: {
      name: string;
      price: number;
      commission_percentage: number;
    } | null;
  };
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
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
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
          console.warn('Profissional não associado ao usuário. Utilizando modo simulação / demonstração.');
          if (isMounted) {
            setIsDemoMode(true);
            setProfessional({
              id: 'demo-prof-id',
              name: session.user.email?.split('@')[0] || 'Barbeiro Convidado',
              tenant_id: 'demo-tenant-id',
              commission_percentage: 50
            });
          }
        } else if (isMounted) {
          setProfessional(profData);
          setIsDemoMode(false);
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

        if (isDemoMode) {
          // Gerar Mock Data ricos e realistas
          setTimeout(() => {
            if (!isMounted) return;
            const mockData = generateMockData(period);
            setTotalCommission(mockData.totalCommission);
            setTotalRevenue(mockData.totalRevenue);
            setHistory(mockData.history);
            setLoading(false);
          }, 600);
          return;
        }

        // Query Supabase Real
        // Buscamos na tabela payments os registros associados a completed appointments do profissional
        const { data, error } = await supabase
          .from('payments')
          .select(`
            id,
            amount,
            commission_value,
            paid_at,
            appointment:appointments!inner(
              id,
              status,
              professional_id,
              start_time,
              customer:customers(name),
              service:services(name, price, commission_percentage)
            )
          `)
          .eq('appointment.professional_id', professional.id)
          .eq('appointment.status', 'completed')
          .gte('paid_at', startDate.toISOString())
          .lte('paid_at', now.toISOString())
          .order('paid_at', { ascending: false });

        if (error) throw error;

        if (isMounted) {
          const payments = (data as unknown as PaymentRecord[]) || [];
          
          let commissionSum = 0;
          let revenueSum = 0;
          const historyItems: HistoryItem[] = [];

          payments.forEach((payment) => {
            commissionSum += Number(payment.commission_value);
            revenueSum += Number(payment.amount);

            // Calcular porcentagem real da comissão cobrada
            const amount = Number(payment.amount);
            const commVal = Number(payment.commission_value);
            const calculatedPercentage = amount > 0 ? (commVal / amount) * 100 : 0;

            historyItems.push({
              id: payment.id,
              date: payment.paid_at,
              customerName: payment.appointment.customer?.name || 'Cliente Simulado',
              serviceName: payment.appointment.service?.name || 'Serviço',
              servicePrice: amount,
              commissionPercentage: Math.round(calculatedPercentage),
              commissionEarned: commVal,
            });
          });

          setTotalCommission(commissionSum);
          setTotalRevenue(revenueSum);
          setHistory(historyItems);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Erro ao consultar faturamento do barbeiro:', err);
        addToast('Erro ao carregar dados de comissão do banco.', 'error');
        // Fallback temporário para simular se der erro no banco remoto
        if (isMounted) {
          setIsDemoMode(true);
          const mockData = generateMockData(period);
          setTotalCommission(mockData.totalCommission);
          setTotalRevenue(mockData.totalRevenue);
          setHistory(mockData.history);
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [professional, period, isDemoMode, addToast]);

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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      navigate('/');
    }
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
          color: #FFF1E6;
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

// Gerador de dados fictícios para modo demonstração
function generateMockData(period: 'today' | '7days' | 'month') {
  const now = new Date();
  
  if (period === 'today') {
    return {
      totalCommission: 120.00,
      totalRevenue: 240.00,
      history: [
        {
          id: 'mock-1',
          date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0).toISOString(),
          customerName: 'Arthur Pendragon',
          serviceName: 'Corte Degradê Navalhado',
          servicePrice: 70.00,
          commissionPercentage: 50,
          commissionEarned: 35.00
        },
        {
          id: 'mock-2',
          date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30).toISOString(),
          customerName: 'Carlos Alberto',
          serviceName: 'Barboterapia Premium',
          servicePrice: 60.00,
          commissionPercentage: 50,
          commissionEarned: 30.00
        },
        {
          id: 'mock-3',
          date: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
          customerName: 'Pedro Silva',
          serviceName: 'Combo Corte + Barba',
          servicePrice: 110.00,
          commissionPercentage: 50,
          commissionEarned: 55.00
        }
      ]
    };
  } else if (period === '7days') {
    // Gerar atendimentos simulados para os últimos 7 dias
    const mockHistory: HistoryItem[] = [];
    const services = [
      { name: 'Corte Degradê Navalhado', price: 70 },
      { name: 'Barboterapia Premium', price: 60 },
      { name: 'Combo Corte + Barba', price: 110 },
      { name: 'Aparação de Barba Simples', price: 40 },
      { name: 'Acabamento / Pezinho', price: 30 }
    ];
    const clients = ['Arthur Pendragon', 'Carlos Alberto', 'Pedro Silva', 'Marcos Oliveira', 'Thiago Lima', 'Douglas Santos', 'Gustavo Ribeiro', 'Renato Souza'];
    
    let totalComm = 0;
    let totalRev = 0;

    for (let i = 0; i < 15; i++) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() - Math.floor(i / 2)); // 2 cortes por dia aprox
      targetDate.setHours(9 + (i % 4) * 2, (i % 2) * 30, 0);

      const service = services[i % services.length];
      const client = clients[i % clients.length];
      const pct = 50; // comissao 50%
      const earned = service.price * (pct / 100);

      totalComm += earned;
      totalRev += service.price;

      mockHistory.push({
        id: `mock-7d-${i}`,
        date: targetDate.toISOString(),
        customerName: client,
        serviceName: service.name,
        servicePrice: service.price,
        commissionPercentage: pct,
        commissionEarned: earned
      });
    }

    return {
      totalCommission: totalComm,
      totalRevenue: totalRev,
      history: mockHistory
    };
  } else {
    // period === 'month' (Mês Atual)
    const mockHistory: HistoryItem[] = [];
    const services = [
      { name: 'Corte Degradê Navalhado', price: 70 },
      { name: 'Barboterapia Premium', price: 60 },
      { name: 'Combo Corte + Barba', price: 110 },
      { name: 'Aparação de Barba Simples', price: 40 },
      { name: 'Acabamento / Pezinho', price: 30 }
    ];
    const clients = ['Arthur Pendragon', 'Carlos Alberto', 'Pedro Silva', 'Marcos Oliveira', 'Thiago Lima', 'Douglas Santos', 'Gustavo Ribeiro', 'Renato Souza', 'Gabriel Mendes', 'Rafael Costa', 'Julio Cesar', 'Leonardo Gome'];
    
    let totalComm = 0;
    let totalRev = 0;

    // Gerar 42 registros simulando o mês atual
    const limit = Math.min(42, now.getDate() * 2); // máximo 2 por dia do mês corrente
    
    for (let i = 0; i < (limit || 10); i++) {
      const targetDate = new Date();
      targetDate.setDate(now.getDate() - Math.floor(i / 2));
      targetDate.setHours(9 + (i % 4) * 2, (i % 2) * 30, 0);

      const service = services[i % services.length];
      const client = clients[i % clients.length];
      const pct = 50;
      const earned = service.price * (pct / 100);

      totalComm += earned;
      totalRev += service.price;

      mockHistory.push({
        id: `mock-m-${i}`,
        date: targetDate.toISOString(),
        customerName: client,
        serviceName: service.name,
        servicePrice: service.price,
        commissionPercentage: pct,
        commissionEarned: earned
      });
    }

    return {
      totalCommission: totalComm,
      totalRevenue: totalRev,
      history: mockHistory
    };
  }
}
