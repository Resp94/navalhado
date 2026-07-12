import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { 
  ScissorsIcon, 
  ArrowRightIcon, 
  InfoIcon, 
  WarningIcon, 
  SuccessIcon 
} from '../../components/Icons';

// Tipagem dos dados retornados da RPC
interface RevenueTrendItem {
  month: string;
  month_label: string;
  revenue: number;
}

interface DashboardMetrics {
  mrr: number;
  active_tenants: number;
  suspended_tenants: number;
  revenue_this_month: number;
  revenue_trend: RevenueTrendItem[];
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [adminName, setAdminName] = useState('Administrador');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // 1. Obter nome do Administrador logado
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('name')
            .eq('id', user.id)
            .single();
          if (profile?.name) {
            setAdminName(profile.name);
          }
        }

        // 2. Chamar RPC para obter métricas
        const { data, error } = await supabase.rpc('get_admin_dashboard_metrics');
        if (error) throw error;
        
        setMetrics(data as DashboardMetrics);
      } catch (error: any) {
        console.error('Error fetching admin dashboard metrics:', error);
        addToast('Não foi possível carregar as métricas do painel.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [addToast]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      addToast('Logout realizado.', 'success');
      navigate('/');
    } catch (error: any) {
      addToast('Erro ao sair da conta.', 'error');
    }
  };

  // Formatação de valores monetários
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val);
  };

  // Formatar rótulos de meses (ex: "2026-07" -> "Jul/26")
  const formatMonth = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year.substring(2)}`;
  };

  // Renderizar o gráfico SVG interativo
  const renderSVGChart = () => {
    if (!metrics || !metrics.revenue_trend || metrics.revenue_trend.length === 0) return null;

    const trend = metrics.revenue_trend;
    const width = 800;
    const height = 240;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Calcular valores máximo e mínimo para Y
    const maxVal = Math.max(...trend.map(d => d.revenue), 100) * 1.1; // 10% de folga no topo

    // Mapear pontos
    const points = trend.map((d, i) => {
      const x = paddingLeft + (i * (chartWidth / (trend.length - 1)));
      const y = height - paddingBottom - ((d.revenue / maxVal) * chartHeight);
      return { x, y, val: d.revenue, label: formatMonth(d.month) };
    });

    // Gerar string do Path da linha
    const linePath = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    // Gerar string do Path da Área sob a curva para preenchimento
    const areaPath = points.length > 0 
      ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z` 
      : '';

    return (
      <div className="chart-wrapper">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Gradiente do preenchimento da área do gráfico */}
            <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0.00" />
            </linearGradient>

            {/* Gradiente da linha do gráfico */}
            <linearGradient id="chart-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-brand-primary)" />
              <stop offset="100%" stopColor="#F2B277" />
            </linearGradient>
          </defs>

          {/* Grid horizontal lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = paddingTop + ratio * chartHeight;
            const gridVal = maxVal * (1 - ratio);
            return (
              <g key={index}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="var(--color-border)" 
                  strokeWidth="1" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={paddingLeft - 10} 
                  y={y + 4} 
                  fill="var(--color-text-secondary)" 
                  fontSize="10" 
                  textAnchor="end"
                >
                  {Math.round(gridVal)}
                </text>
              </g>
            );
          })}

          {/* Área preenchida */}
          {areaPath && <path d={areaPath} fill="url(#chart-area-grad)" />}

          {/* Linha principal */}
          {linePath && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="url(#chart-line-grad)" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}

          {/* Pontos de dados iterativos */}
          {points.map((p, i) => (
            <g 
              key={i} 
              onMouseEnter={() => setHoveredPoint(i)}
              onMouseLeave={() => setHoveredPoint(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Círculo invisível maior para detecção de hover */}
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
              
              {/* Ponto real */}
              <circle 
                cx={p.x} 
                cy={p.y} 
                r={hoveredPoint === i ? '6' : '4'} 
                fill={hoveredPoint === i ? 'var(--color-brand-hover)' : 'var(--color-brand-primary)'} 
                stroke="var(--color-bg-secondary)" 
                strokeWidth="2.5"
                style={{ transition: 'all 0.15s ease' }}
              />

              {/* Rótulo do Eixo X */}
              {i % 2 === 0 && (
                <text 
                  x={p.x} 
                  y={height - 15} 
                  fill="var(--color-text-secondary)" 
                  fontSize="10" 
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              )}
            </g>
          ))}

          {/* Tooltip Dinâmico */}
          {hoveredPoint !== null && points[hoveredPoint] && (
            <g transform={`translate(${points[hoveredPoint].x}, ${points[hoveredPoint].y - 25})`}>
              <rect 
                x="-55" 
                y="-30" 
                width="110" 
                height="34" 
                rx="6" 
                fill="var(--color-text-primary)" 
                filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.1))" 
              />
              <text 
                x="0" 
                y="-20" 
                fill="var(--color-bg-secondary)" 
                fontSize="10" 
                fontWeight="700" 
                textAnchor="middle"
              >
                {trend[hoveredPoint].month_label}
              </text>
              <text 
                x="0" 
                y="-8" 
                fill="var(--color-brand-soft)" 
                fontSize="10" 
                fontWeight="500" 
                textAnchor="middle"
              >
                {formatCurrency(points[hoveredPoint].val)}
              </text>
            </g>
          )}
        </svg>
      </div>
    );
  };

  if (loading || !metrics) {
    // Retorna o esqueleto de carregamento
    return (
      <div className="skeleton-container" style={{ padding: '2rem' }}>
        <header className="skeleton-header" style={{ height: '50px', borderBottom: '1px solid var(--color-border)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '2rem' }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '120px' }} />)}
        </div>
        <div className="skeleton" style={{ height: '300px', marginTop: '2rem' }} />
      </div>
    );
  }

  return (
    <>
      <div className="noise-overlay" />

      <div className="admin-layout">
        {/* TOP BAR */}
        <header className="admin-header">
          <div className="admin-header__brand" onClick={() => navigate('/admin/dashboard')} style={{ cursor: 'pointer' }}>
            <div className="admin-header__logo">
              <ScissorsIcon size={22} />
            </div>
            <div>
              <span className="admin-header__eyebrow">SaaS Admin</span>
              <h1 className="admin-header__title">Navalhado</h1>
            </div>
          </div>

          {/* Navegação Central Coesa */}
          <nav className="admin-header__nav">
            <button 
              onClick={() => navigate('/admin/dashboard')} 
              className={`admin-header__nav-link ${location.pathname === '/admin/dashboard' ? 'admin-header__nav-link--active' : ''}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => navigate('/admin/tenants')} 
              className={`admin-header__nav-link ${location.pathname === '/admin/tenants' ? 'admin-header__nav-link--active' : ''}`}
            >
              Barbearias
            </button>
          </nav>

          <div className="admin-header__user">
            <div className="admin-header__user-info">
              <span className="admin-header__user-name">{adminName}</span>
              <span className="admin-header__user-role">Proprietário</span>
            </div>
            <button onClick={handleLogout} className="btn btn--outline-danger btn--sm">
              Sair
            </button>
          </div>
        </header>

        {/* CONTAINER PRINCIPAL */}
        <main className="admin-container">
          {/* Saudação e introdução */}
          <section className="welcome-banner">
            <h2>Olá, {adminName.split(' ')[0]}.</h2>
            <p>Visão consolidada do faturamento e da ativação da sua plataforma.</p>
          </section>

          {/* GRID DE MÉTRICAS CARD */}
          <section className="metrics-grid">
            {/* Card 1: MRR */}
            <div className="metric-card">
              <div className="metric-card__header">
                <span className="metric-card__title">Receita Recorrente (MRR)</span>
                <span className="metric-card__icon text-brand"><InfoIcon size={20} /></span>
              </div>
              <div className="metric-card__value">{formatCurrency(metrics.mrr)}</div>
              <p className="metric-card__desc">Valor total das assinaturas ativas</p>
            </div>

            {/* Card 2: Faturamento do Mês */}
            <div className="metric-card">
              <div className="metric-card__header">
                <span className="metric-card__title">Faturamento do Mês</span>
                <span className="metric-card__icon text-success"><SuccessIcon size={20} /></span>
              </div>
              <div className="metric-card__value">{formatCurrency(metrics.revenue_this_month)}</div>
              <p className="metric-card__desc">Cobranças pagas neste mês</p>
            </div>

            {/* Card 3: Tenants Ativos */}
            <div className="metric-card">
              <div className="metric-card__header">
                <span className="metric-card__title">Barbearias Ativas</span>
                <span className="metric-card__icon text-success"><SuccessIcon size={20} /></span>
              </div>
              <div className="metric-card__value">{metrics.active_tenants}</div>
              <p className="metric-card__desc">Contratos ativos com acesso liberado</p>
            </div>

            {/* Card 4: Tenants Suspensos */}
            <div className="metric-card">
              <div className="metric-card__header">
                <span className="metric-card__title">Inadimplentes / Suspensas</span>
                <span className="metric-card__icon text-error"><WarningIcon size={20} /></span>
              </div>
              <div className="metric-card__value">{metrics.suspended_tenants}</div>
              <p className="metric-card__desc">Barbearias com acesso suspenso</p>
            </div>
          </section>

          {/* SEÇÃO GRÁFICO HISTÓRICO */}
          <section className="dashboard-chart-section">
            <div className="chart-header">
              <div>
                <h3>Evolução da receita</h3>
                <p>Faturamento mensal dos últimos 12 meses</p>
              </div>
              
              <button onClick={() => navigate('/admin/tenants')} className="btn btn--primary btn--sm">
                Ir para barbearias
                <span className="btn__icon" style={{ width: '1.25rem', height: '1.25rem' }}>
                  <ArrowRightIcon size={12} />
                </span>
              </button>
            </div>
            
            {renderSVGChart()}
          </section>
        </main>
      </div>

      <style>{`
        .admin-layout {
          min-height: 100vh;
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          display: flex;
          flex-direction: column;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
          box-shadow: var(--shadow-sm);
        }

        .admin-header__brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .admin-header__nav {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .admin-header__nav-link {
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
          font-weight: 500;
          cursor: pointer;
          padding: 0.5rem 0.25rem;
          position: relative;
          transition: color 0.2s ease;
        }

        .admin-header__nav-link:hover {
          color: var(--color-brand-primary);
        }

        .admin-header__nav-link--active {
          color: var(--color-brand-primary);
          font-weight: 600;
        }

        .admin-header__nav-link--active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: var(--color-brand-primary);
          border-radius: var(--radius-full);
          animation: fadeIn 0.2s ease;
        }

        .admin-header__logo {
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
          padding: 0.5rem;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .admin-header__logo svg {
          transform: rotate(-45deg);
        }

        .admin-header__eyebrow {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: var(--color-brand-primary);
          font-weight: 600;
          display: block;
        }

        .admin-header__title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
        }

        .admin-header__user {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .admin-header__user-info {
          display: flex;
          flex-direction: column;
          text-align: right;
        }

        .admin-header__user-name {
          font-size: var(--font-size-sm);
          font-weight: 600;
        }

        .admin-header__user-role {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .admin-container {
          flex: 1;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .welcome-banner h2 {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 0.25rem;
        }

        .welcome-banner p {
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1.5rem;
          width: 100%;
        }

        .metric-card {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .metric-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
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
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary);
        }

        .metric-card__icon {
          display: flex;
          align-items: center;
        }

        .metric-card__value {
          font-size: var(--font-size-2xl);
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
          margin-bottom: 0.25rem;
        }

        .metric-card__desc {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0;
        }

        .text-brand { color: var(--color-brand-primary); }
        .text-success { color: var(--color-success); }
        .text-error { color: var(--color-error); }

        .dashboard-chart-section {
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.75rem;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chart-header h3 {
          font-size: var(--font-size-lg);
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .chart-header p {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0;
        }

        .chart-wrapper {
          width: 100%;
          height: 240px;
        }

        .btn--outline-danger {
          border: 1px solid var(--color-error);
          background: transparent;
          color: var(--color-error);
          transition: all 0.2s ease;
        }

        .btn--outline-danger:hover {
          background-color: var(--color-error-bg);
        }

        .btn--sm {
          padding: 0.5rem 1rem;
          font-size: var(--font-size-xs);
        }

        /* Skeleton Styles */
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

        @keyframes skeleton-loading {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        @media (max-width: 768px) {
          .admin-header {
            padding: 1rem;
          }
          .admin-header__user-info {
            display: none;
          }
          .admin-container {
            padding: 1rem;
          }
          .chart-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .chart-header button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
};
