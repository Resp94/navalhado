import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { 
  ArrowRightIcon, 
  InfoIcon, 
  WarningIcon, 
  SuccessIcon 
} from '../../components/Icons';
import { StatCard, Button, Skeleton } from '../../components/ui';

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
      <div className="w-full h-[240px] overflow-visible">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" overflow="visible">
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
              className="cursor-pointer"
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
                className="transition-all duration-150 ease-in"
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

          {/* Tooltip Dinâmico — posicionamento inteligente */}
          {hoveredPoint !== null && points[hoveredPoint] && (() => {
            const pt = points[hoveredPoint];
            const isNearTop = pt.y < 60;
            const tooltipY = isNearTop ? pt.y + 25 : pt.y - 25;
            const rectY = isNearTop ? 0 : -30;
            const textY1 = isNearTop ? 10 : -20;
            const textY2 = isNearTop ? 22 : -8;
            return (
              <g transform={`translate(${pt.x}, ${tooltipY})`}>
                <rect 
                  x="-55" 
                  y={rectY}
                  width="110" 
                  height="34" 
                  rx="6" 
                  fill="var(--color-text-primary)" 
                  filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.1))" 
                />
                <text 
                  x="0" 
                  y={textY1}
                  fill="var(--color-bg-secondary)" 
                  fontSize="10" 
                  fontWeight="700" 
                  textAnchor="middle"
                >
                  {trend[hoveredPoint].month_label}
                </text>
                <text 
                  x="0" 
                  y={textY2}
                  fill="var(--color-brand-soft)" 
                  fontSize="10" 
                  fontWeight="500" 
                  textAnchor="middle"
                >
                  {formatCurrency(pt.val)}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
    );
  };

  if (loading || !metrics) {
    // Retorna o esqueleto de carregamento com o componente Skeleton do Design System
    return (
      <div className="p-8 max-w-[1200px] mx-auto flex flex-col gap-8">
        <Skeleton height="50px" className="w-full rounded-md" />
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} height="130px" className="rounded-lg" />
          ))}
        </div>
        <Skeleton height="300px" className="rounded-lg" />
      </div>
    );
  }

  return (
    <>
      <div className="noise-overlay" />

      <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
        {/* TOP BAR */}
        <header className="flex justify-between items-center px-8 py-4 bg-[radial-gradient(ellipse_40%_60%_at_15%_50%,rgba(217,108,0,0.05)_0%,transparent_60%),radial-gradient(ellipse_40%_60%_at_85%_50%,rgba(217,108,0,0.03)_0%,transparent_55%),linear-gradient(145deg,rgba(255,255,255,0.78)_0%,rgba(255,241,230,0.5)_45%,rgba(255,255,255,0.72)_100%)] backdrop-blur-[28px] backdrop-saturate-[200%] border-b border-[rgba(255,255,255,0.25)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(255,255,255,0.15),0_8px_40px_-8px_rgba(45,35,30,0.1),0_1px_4px_rgba(45,35,30,0.04)] sticky top-0 z-[100] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] max-md:px-4 max-md:py-4">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-90"
            onClick={() => navigate('/admin/dashboard')}
          >
            <div className="flex items-center justify-center">
              <img src="/simbolo.svg" alt="Navalhado" className="w-[34px] h-[34px] block" />
            </div>
            <div>
              <h1 className="text-base font-bold m-0 leading-[1.1] text-text-primary">Navalhado</h1>
            </div>
          </div>

          {/* Navegação Central Coesa */}
          <nav className="flex items-center gap-[0.35rem] bg-[radial-gradient(ellipse_50%_100%_at_30%_50%,rgba(217,108,0,0.04)_0%,transparent_70%),rgba(255,255,255,0.45)] p-1 rounded-lg border border-[rgba(255,255,255,0.35)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[12px] backdrop-saturate-[160%]">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className={`flex items-center gap-2 bg-transparent border border-transparent text-sm font-medium cursor-pointer px-4 py-[0.45rem] rounded-md no-underline transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ${
                location.pathname === '/admin/dashboard'
                  ? 'text-brand-primary bg-bg-secondary border-[rgba(234,222,214,0.8)] font-semibold shadow-[0_1px_2px_rgba(45,35,30,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]'
                  : 'text-text-secondary hover:text-brand-primary hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(234,222,214,0.6)]'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/admin/tenants')}
              className={`flex items-center gap-2 bg-transparent border border-transparent text-sm font-medium cursor-pointer px-4 py-[0.45rem] rounded-md no-underline transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] ${
                location.pathname === '/admin/tenants'
                  ? 'text-brand-primary bg-bg-secondary border-[rgba(234,222,214,0.8)] font-semibold shadow-[0_1px_2px_rgba(45,35,30,0.06),inset_0_1px_0_rgba(255,255,255,0.6)]'
                  : 'text-text-secondary hover:text-brand-primary hover:bg-[rgba(255,255,255,0.5)] hover:border-[rgba(234,222,214,0.6)]'
              }`}
            >
              Barbearias
            </button>
          </nav>

          <div className="flex items-center gap-6">
            <div className="flex flex-col text-right max-md:hidden">
              <span className="text-sm font-semibold">{adminName}</span>
              <span className="text-xs text-text-secondary">Proprietário</span>
            </div>
            <Button variant="danger-outline" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </header>

        {/* CONTAINER PRINCIPAL */}
        <main className="flex-1 max-w-[1200px] w-full mx-auto p-8 flex flex-col gap-8 max-md:p-4">
          {/* Saudação e introdução */}
          <section>
            <h2 className="text-2xl font-bold tracking-[-0.02em] mb-1">Olá, {adminName.split(' ')[0]}.</h2>
            <p className="text-text-secondary text-sm">Visão consolidada do faturamento e da ativação da sua plataforma.</p>
          </section>

          {/* GRID DE MÉTRICAS CARD COM DESIGN SYSTEM */}
          <section className="grid gap-6 w-full [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            <StatCard
              title="Receita Recorrente (MRR)"
              value={formatCurrency(metrics.mrr)}
              subtitle="Valor total das assinaturas ativas"
              icon={<span className="text-brand-primary"><InfoIcon size={20} /></span>}
            />

            <StatCard
              title="Faturamento do Mês"
              value={formatCurrency(metrics.revenue_this_month)}
              subtitle="Cobranças pagas neste mês"
              icon={<span className="text-success"><SuccessIcon size={20} /></span>}
            />

            <StatCard
              title="Barbearias Ativas"
              value={metrics.active_tenants}
              subtitle="Contratos ativos com acesso liberado"
              icon={<span className="text-success"><SuccessIcon size={20} /></span>}
            />

            <StatCard
              title="Inadimplentes / Suspensas"
              value={metrics.suspended_tenants}
              subtitle="Barbearias com acesso suspenso"
              icon={<span className="text-error"><WarningIcon size={20} /></span>}
            />
          </section>

          {/* SEÇÃO GRÁFICO HISTÓRICO */}
          <section className="bg-bg-secondary border border-border rounded-lg p-7 shadow-sm flex flex-col gap-6 overflow-visible">
            <div className="flex justify-between items-center max-md:flex-col max-md:items-start max-md:gap-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Evolução da receita</h3>
                <p className="text-xs text-text-secondary m-0">Faturamento mensal dos últimos 12 meses</p>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/admin/tenants')}
                rightIcon={<ArrowRightIcon size={12} />}
                className="max-md:w-full"
              >
                Ir para barbearias
              </Button>
            </div>

            {renderSVGChart()}
          </section>
        </main>
      </div>
    </>
  );
};
