import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ContaProfissionalRepository } from '../../modules/contaProfissional/ContaProfissionalRepository';
import { SupabaseContaProfissionalAdapter } from '../../modules/contaProfissional/adapters/SupabaseContaProfissionalAdapter';
import type { ProfessionalAccountEntry } from '../../modules/contaProfissional/types';
import { ExtratoContaProfissionalModal } from '../../components/financeiro/ExtratoContaProfissionalModal';

const contaProfissionalRepository = new ContaProfissionalRepository(new SupabaseContaProfissionalAdapter());

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

const isProductItem = (
  itemType: string | null | undefined,
  hasProduct: boolean,
  hasService: boolean
): boolean => {
  if (itemType === 'produto' || itemType === 'product') return true;
  if (itemType === 'servico' || itemType === 'service') return false;
  return hasProduct && !hasService;
};

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
  // Vales em aberto (ticket 05 da spec 034): o profissional vê os próprios, não os dos colegas.
  const [openAdvances, setOpenAdvances] = useState<ProfessionalAccountEntry[]>([]);
  // Extrato cronológico da própria conta (ticket 08 da spec 034).
  const [showExtrato, setShowExtrato] = useState(false);

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

  // 1b. Carregar vales em aberto do profissional logado (ticket 05 da spec 034).
  // A RLS já restringe a leitura à própria conta; esta chamada não depende disso
  // para funcionar corretamente, mas a garantia é dupla.
  useEffect(() => {
    if (!professional) return;
    let isMounted = true;

    contaProfissionalRepository
      .listEntries(professional.id, professional.tenant_id)
      .then((entries) => {
        if (isMounted) {
          setOpenAdvances(entries.filter((e) => e.entry_type === 'vale' && e.status !== 'reversed'));
        }
      })
      .catch(() => {
        if (isMounted) setOpenAdvances([]);
      });

    return () => {
      isMounted = false;
    };
  }, [professional]);

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
            const isProduct = isProductItem(item.item_type, Boolean(item.product), Boolean(item.service));
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

      <div className="min-h-screen min-h-dvh bg-bg-primary text-text-primary p-6 max-w-[1120px] mx-auto flex flex-col gap-5 font-base max-md:p-4 max-md:gap-4" ref={containerRef}>

        {/* PERIOD FILTER — Compact pill-shaped filter */}
        <section className="flex items-center gap-2.5 w-max max-w-full py-2 pr-4 pl-5 rounded-full bg-bg-secondary border-[0.5px] border-[rgba(234,222,214,0.6)] shadow-sm text-text-secondary text-xs font-medium mx-auto max-md:w-full max-md:justify-center max-md:flex-wrap max-md:gap-2 max-md:px-3">
          <CalendarIcon size={16} />
          <span className="font-semibold text-text-secondary text-xs tracking-[0.02em]">Período</span>
          <div className="w-px h-4 bg-[rgba(234,222,214,0.4)]" />
          <div className="flex gap-1">
            {(['today', '7days', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`bg-transparent border-none py-[0.3rem] px-3 rounded-full text-xs font-semibold cursor-pointer transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] max-md:py-1 max-md:px-2.5 max-md:text-[11px] ${
                  period === p
                    ? 'text-brand-lightest bg-brand-primary shadow-[0_2px_8px_rgba(217,108,0,0.2)] active:scale-[0.96]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[rgba(45,35,30,0.04)]'
                }`}
              >
                {p === 'today' ? 'Hoje' : p === '7days' ? '7 Dias' : 'Mês'}
              </button>
            ))}
          </div>
        </section>

        {/* CONTEÚDO PRINCIPAL OU SKELETON */}
        {loading ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1 max-md:gap-4">
              <div className="bg-[rgba(45,35,30,0.04)] p-px rounded-[calc(var(--radius-xl)+2px)] shadow-[inset_0_1px_2px_rgba(45,35,30,0.04)]">
                <div className="h-[160px] rounded-xl bg-[linear-gradient(90deg,rgba(234,222,214,0.3)_25%,rgba(234,222,214,0.08)_50%,rgba(234,222,214,0.3)_75%)] bg-[length:200%_100%] animate-shimmer" />
              </div>
              <div className="bg-[rgba(45,35,30,0.04)] p-px rounded-[calc(var(--radius-xl)+2px)] shadow-[inset_0_1px_2px_rgba(45,35,30,0.04)]">
                <div className="h-[160px] rounded-xl bg-[linear-gradient(90deg,rgba(234,222,214,0.3)_25%,rgba(234,222,214,0.08)_50%,rgba(234,222,214,0.3)_75%)] bg-[length:200%_100%] animate-shimmer" />
              </div>
            </div>
            <div className="bg-[rgba(45,35,30,0.04)] p-px rounded-[calc(var(--radius-xl)+2px)] shadow-[inset_0_1px_2px_rgba(45,35,30,0.04)]">
              <div className="bg-bg-secondary rounded-xl p-6 max-md:p-4">
                <div className="h-[50px] rounded-lg mb-4 bg-[linear-gradient(90deg,rgba(234,222,214,0.3)_25%,rgba(234,222,214,0.08)_50%,rgba(234,222,214,0.3)_75%)] bg-[length:200%_100%] animate-shimmer" />
                <div className="h-[60px] rounded-md mb-2 bg-[linear-gradient(90deg,rgba(234,222,214,0.3)_25%,rgba(234,222,214,0.08)_50%,rgba(234,222,214,0.3)_75%)] bg-[length:200%_100%] animate-shimmer" />
                <div className="h-[60px] rounded-md mb-2 bg-[linear-gradient(90deg,rgba(234,222,214,0.3)_25%,rgba(234,222,214,0.08)_50%,rgba(234,222,214,0.3)_75%)] bg-[length:200%_100%] animate-shimmer" />
                <div className="h-[60px] rounded-md bg-[linear-gradient(90deg,rgba(234,222,214,0.3)_25%,rgba(234,222,214,0.08)_50%,rgba(234,222,214,0.3)_75%)] bg-[length:200%_100%] animate-shimmer" />
              </div>
            </div>
          </div>
        ) : (
          <main className="flex flex-col gap-6">
            {/* CARDS DE FATURAMENTO — Double-Bezel */}
            <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1 max-md:gap-4">
              {/* CARD COMISSÃO */}
              <div className="gsap-stat-card group transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-[3px] active:translate-y-0 active:scale-[0.98] active:duration-[120ms]">
                <div className="bg-[rgba(45,35,30,0.04)] p-px rounded-[calc(var(--radius-xl)+2px)] shadow-[inset_0_1px_2px_rgba(45,35,30,0.04)] transition-[box-shadow,background] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-[rgba(217,108,0,0.06)] group-hover:shadow-[inset_0_1px_2px_rgba(45,35,30,0.04),0_4px_20px_rgba(217,108,0,0.08)]">
                  <div className="bg-bg-secondary rounded-xl py-6 px-7 flex flex-col gap-3 relative overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_16px_rgba(45,35,30,0.04)] transition-shadow duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_24px_rgba(45,35,30,0.06)] max-md:p-5 before:content-[''] before:absolute before:-top-[40%] before:-right-[20%] before:w-[140px] before:h-[140px] before:rounded-full before:pointer-events-none before:opacity-50 before:bg-[radial-gradient(circle,rgba(217,108,0,0.08),transparent_70%)]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary opacity-70 py-[0.2rem] px-2.5 rounded-full bg-[rgba(45,35,30,0.04)]">Comissão</span>
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-[rgba(217,108,0,0.08)] text-brand-primary">
                        <CoinsIcon size={22} />
                      </div>
                    </div>
                    <div className="text-[2.5rem] font-extrabold leading-none tracking-[-0.03em] font-base text-brand-primary max-md:text-[2rem]">
                      {formatCurrency(totalCommission)}
                    </div>
                    <p className="text-xs text-text-secondary leading-[1.4] opacity-80 [&_strong]:text-brand-primary [&_strong]:font-bold">
                      Sua comissão: <strong>{professional?.commission_percentage}%</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD RECEITA */}
              <div className="gsap-stat-card group transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-[3px] active:translate-y-0 active:scale-[0.98] active:duration-[120ms]">
                <div className="bg-[rgba(45,35,30,0.04)] p-px rounded-[calc(var(--radius-xl)+2px)] shadow-[inset_0_1px_2px_rgba(45,35,30,0.04)] transition-[box-shadow,background] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-[rgba(217,108,0,0.06)] group-hover:shadow-[inset_0_1px_2px_rgba(45,35,30,0.04),0_4px_20px_rgba(217,108,0,0.08)]">
                  <div className="bg-bg-secondary rounded-xl py-6 px-7 flex flex-col gap-3 relative overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_16px_rgba(45,35,30,0.04)] transition-shadow duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_24px_rgba(45,35,30,0.06)] max-md:p-5 before:content-[''] before:absolute before:-top-[40%] before:-right-[20%] before:w-[140px] before:h-[140px] before:rounded-full before:pointer-events-none before:opacity-50 before:bg-[radial-gradient(circle,rgba(63,131,248,0.06),transparent_70%)]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary opacity-70 py-[0.2rem] px-2.5 rounded-full bg-[rgba(45,35,30,0.04)]">Receita Gerada</span>
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 bg-[rgba(63,131,248,0.08)] text-info">
                        <TrendingUpIcon size={22} />
                      </div>
                    </div>
                    <div className="text-[2.5rem] font-extrabold leading-none tracking-[-0.03em] font-base text-text-primary max-md:text-[2rem]">
                      {formatCurrency(totalRevenue)}
                    </div>
                    <p className="text-xs text-text-secondary leading-[1.4] opacity-80">
                      Valor total dos serviços no período.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* HISTÓRICO — Double-Bezel */}
            <section className="gsap-history-section group transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5">
              <div className="bg-[rgba(45,35,30,0.04)] p-px rounded-[calc(var(--radius-xl)+2px)] shadow-[inset_0_1px_2px_rgba(45,35,30,0.04)] transition-[box-shadow,background] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-[rgba(217,108,0,0.04)] group-hover:shadow-[inset_0_1px_2px_rgba(45,35,30,0.04),0_4px_20px_rgba(217,108,0,0.06)]">
                <div className="bg-bg-secondary rounded-xl p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_16px_rgba(45,35,30,0.04)] transition-shadow duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_24px_rgba(45,35,30,0.06)] max-md:p-4">
                  <div className="mb-5 flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary opacity-60">Histórico</span>
                    <h2 className="text-lg font-bold text-text-primary">Atendimentos Concluídos</h2>
                  </div>

                  {history.length === 0 ? (
                    <div className="text-center py-12 px-6 text-text-secondary text-sm">
                      <p>Nenhum agendamento com pagamento registrado neste período.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full [-webkit-overflow-scrolling:touch]">
                      {/* Desktop Table */}
                      <table className="w-full border-collapse text-left max-md:hidden">
                        <thead>
                          <tr>
                            <th className="py-3 px-4 font-semibold text-[11px] uppercase tracking-[0.08em] text-text-secondary opacity-60 border-b border-[rgba(234,222,214,0.4)]">Data</th>
                            <th className="py-3 px-4 font-semibold text-[11px] uppercase tracking-[0.08em] text-text-secondary opacity-60 border-b border-[rgba(234,222,214,0.4)]">Cliente</th>
                            <th className="py-3 px-4 font-semibold text-[11px] uppercase tracking-[0.08em] text-text-secondary opacity-60 border-b border-[rgba(234,222,214,0.4)]">Serviço</th>
                            <th className="py-3 px-4 font-semibold text-[11px] uppercase tracking-[0.08em] text-text-secondary opacity-60 border-b border-[rgba(234,222,214,0.4)] text-right">Valor</th>
                            <th className="py-3 px-4 font-semibold text-[11px] uppercase tracking-[0.08em] text-text-secondary opacity-60 border-b border-[rgba(234,222,214,0.4)] text-right">%</th>
                            <th className="py-3 px-4 font-semibold text-[11px] uppercase tracking-[0.08em] text-text-secondary opacity-60 border-b border-[rgba(234,222,214,0.4)] text-right">Comissão</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((item) => (
                            <tr
                              key={item.id}
                              className="gsap-history-row transition-colors duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[rgba(217,108,0,0.03)] last:[&_td]:border-b-0 [&_td]:py-3.5 [&_td]:px-4 [&_td]:text-sm [&_td]:border-b [&_td]:border-[rgba(234,222,214,0.2)] [&_td]:align-middle [&_td]:text-text-primary"
                            >
                              <td className="text-text-secondary! whitespace-nowrap text-xs!">{formatDate(item.date)}</td>
                              <td className="font-semibold">{item.customerName}</td>
                              <td>
                                <span className="inline-block py-[0.2rem] px-2.5 rounded-md bg-[rgba(45,35,30,0.04)] text-xs font-medium text-text-primary">{item.serviceName}</span>
                              </td>
                              <td className="text-right whitespace-nowrap">{formatCurrency(item.servicePrice)}</td>
                              <td className="text-right whitespace-nowrap">
                                <span className="inline-flex py-[0.15rem] px-2 rounded-full bg-[rgba(14,159,110,0.08)] text-success text-xs font-bold">{item.commissionPercentage}%</span>
                              </td>
                              <td className="text-right whitespace-nowrap font-bold text-brand-primary!">
                                {formatCurrency(item.commissionEarned)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Mobile Cards */}
                      <div className="hidden flex-col gap-3 max-md:flex">
                        {history.map((item) => (
                          <div
                            key={item.id}
                            className="gsap-history-row bg-bg-secondary border-[0.5px] border-[rgba(234,222,214,0.4)] rounded-lg overflow-hidden shadow-sm transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-[rgba(217,108,0,0.15)] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(45,35,30,0.06)]"
                          >
                            <div className="flex justify-between items-center py-3 px-4 border-b-[0.5px] border-[rgba(234,222,214,0.3)] bg-[rgba(45,35,30,0.02)]">
                              <span className="text-xs text-text-secondary font-medium">{formatDate(item.date)}</span>
                              <span className="text-xs font-semibold text-brand-primary py-[0.15rem] px-2 rounded-md bg-[rgba(217,108,0,0.06)]">{item.serviceName}</span>
                            </div>
                            <div className="py-3 px-4 flex flex-col gap-2">
                              <div className="flex justify-between items-center text-sm text-text-secondary [&>span:last-child]:font-semibold [&>span:last-child]:text-text-primary">
                                <span>Cliente</span>
                                <span>{item.customerName}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm text-text-secondary [&>span:last-child]:font-semibold [&>span:last-child]:text-text-primary">
                                <span>Valor</span>
                                <span>{formatCurrency(item.servicePrice)}</span>
                              </div>
                              <div className="h-px bg-[rgba(234,222,214,0.3)] my-0.5" />
                              <div className="flex justify-between items-center text-sm text-text-secondary pt-1.5 [&>span:first-child]:font-semibold [&>span:first-child]:text-text-primary">
                                <span>Sua Comissão <span className="text-text-secondary font-medium text-xs">({item.commissionPercentage}%)</span></span>
                                <span className="text-brand-primary! font-extrabold text-base">{formatCurrency(item.commissionEarned)}</span>
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

            {openAdvances.length > 0 && (
              <section className="bg-bg-secondary rounded-xl py-5 px-6 mt-5 shadow-[0_4px_16px_rgba(45,35,30,0.04)]" aria-labelledby="advances-section-title">
                <div className="mb-3">
                  <span id="advances-section-title" className="text-[0.8rem] uppercase tracking-[0.04em] font-bold text-text-secondary">Vales em aberto</span>
                  <p className="text-[0.8rem] text-text-secondary mt-0.5">Adiantamentos registrados pela gestão, ainda não quitados.</p>
                </div>
                <ul className="list-none m-0 p-0 flex flex-col gap-2">
                  {openAdvances.map((entry) => (
                    <li key={entry.id} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-dashed border-border">
                      <span className="font-extrabold [font-variant-numeric:tabular-nums] text-brand-primary">{formatCurrency(entry.amount)}</span>
                      <span className="text-[0.8rem] text-text-secondary text-right">{entry.reason}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <button
              type="button"
              onClick={() => setShowExtrato(true)}
              className="mt-5 w-full bg-bg-secondary border border-dashed border-border rounded-xl py-[0.85rem] px-5 text-[0.85rem] font-bold text-brand-primary cursor-pointer transition-all duration-200 ease-in hover:bg-bg-primary hover:border-brand-primary"
            >
              Ver extrato completo da conta (vales, gorjetas e quitações)
            </button>
          </main>
        )}
      </div>

      <ExtratoContaProfissionalModal
        isOpen={showExtrato}
        professional={professional ? { id: professional.id, name: professional.name } : null}
        tenantId={professional?.tenant_id}
        onClose={() => setShowExtrato(false)}
      />

    </>
  );
};
