import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { 
  ArrowRightIcon, 
  InfoIcon, 
  WarningIcon, 
  SuccessIcon 
} from '../../components/Icons';
import { StatCard, Button, Skeleton } from '../../components/ui';
import { CabecalhoDoAdmin } from '../../components/admin/CabecalhoDoAdmin';

// Tipagem dos dados retornados da RPC. A RPC também manda `month_label`, que o banco monta em inglês ("September 26"): a tela monta o
// rótulo em português a partir de `month` ("2026-09").
interface RevenueTrendItem {
  month: string;
  revenue: number;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface DashboardMetrics {
  mrr: number;
  released_tenants: number;
  blocked_tenants: number;
  revenue_this_month: number;
  revenue_trend: RevenueTrendItem[];
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
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

  // Formatar rótulos de meses (ex: "2026-07" -> "Jul/26", no eixo)
  const formatMonth = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    return `${MESES[parseInt(month) - 1].slice(0, 3)}/${year.substring(2)}`;
  };

  // Nome do mês por extenso (ex: "2026-07" -> "Julho de 2026", no tooltip)
  const formatMonthName = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    return `${MESES[parseInt(month) - 1]} de ${year}`;
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
                  {formatMonthName(trend[hoveredPoint].month)}
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
        <CabecalhoDoAdmin nomeDoAdmin={adminName} aoSair={handleLogout} />

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
              subtitle="Valor da próxima cobrança das assinaturas pagantes"
              icon={<span className="text-brand-primary"><InfoIcon size={20} /></span>}
            />

            <StatCard
              title="Faturamento do Mês"
              value={formatCurrency(metrics.revenue_this_month)}
              subtitle="Cobranças pagas neste mês"
              icon={<span className="text-success"><SuccessIcon size={20} /></span>}
            />

            <StatCard
              title="Barbearias Liberadas"
              value={metrics.released_tenants}
              subtitle="Com acesso liberado agora"
              icon={<span className="text-success"><SuccessIcon size={20} /></span>}
            />

            <StatCard
              title="Barbearias Bloqueadas"
              value={metrics.blocked_tenants}
              subtitle="Com acesso bloqueado agora"
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
