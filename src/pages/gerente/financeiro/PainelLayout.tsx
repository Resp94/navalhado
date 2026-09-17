import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import type { TenantContextType } from '../../../components/GerenteLayout';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/Toast';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { CaixaRepository } from '../../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { CashSession } from '../../../modules/caixa/types';
import { formatCurrency } from '../../../lib/currency';
import type { FinancialMetrics, PainelContext, TabReload } from './types';

type PeriodType = 'this_month' | 'last_30_days' | 'last_90_days';

/**
 * Layout intermediário do painel do Hub Financeiro, sem segmento de URL, que envolve só as rotas
 * `caixa` e `comissoes`. Guarda o período, busca as métricas e a Sessão de Caixa ativa e entrega
 * esses dados às duas abas via `Outlet`, estendendo o contexto do tenant recebido do layout do
 * Hub em vez de substituí-lo.
 *
 * Como este layout continua montado ao alternar entre as duas rotas-filhas, trocar de Caixa para
 * Comissões preserva o período e não refaz a busca de métricas. Sair para outra aba do Hub (fora
 * de Caixa e Comissões) desmonta este layout, e o período volta ao padrão "Este mês" ao retornar.
 */
export const FinanceiroPainel: React.FC = () => {
  const tenant = useOutletContext<TenantContextType>();
  const { addToast } = useToast();

  // Estado compartilhado pelas abas: período, métricas, Sessão de Caixa ativa e atualização
  const [period, setPeriod] = useState<PeriodType>('this_month');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [caixaRepo] = useState(() => new CaixaRepository(new SupabaseCaixaAdapter()));
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const tabReloadsRef = useRef(new Set<TabReload>());
  const activeSessionRef = useRef<CashSession | null>(null);
  // Fica `true` depois que `fetchPainel` completa pela primeira vez. Só a partir daí um registro
  // novo em `registerTabReload` dispara sua própria recarga: Caixa e Comissões são rotas-filhas
  // (ticket 02/035), e sair de uma para a outra e voltar remonta o componente do zero, descartando
  // o estado local. Sem isso, a aba remontada ficaria com os dados zerados/vazios até o próximo
  // evento de tempo real ou troca de período (achado de revisão pós-merge). Antes da primeira
  // carga, `fetchPainel` já chama todo reload registrado, então disparar de novo aqui duplicaria a
  // busca inicial.
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const registerTabReload = useCallback((reload: TabReload) => {
    const tabReloads = tabReloadsRef.current;
    tabReloads.add(reload);
    if (hasLoadedOnceRef.current) {
      void reload(activeSessionRef.current);
    }
    return () => {
      tabReloads.delete(reload);
    };
  }, []);

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

  // 2. Busca de Métricas e Sessão de Caixa Ativa, seguida da recarga dos dados das abas
  const fetchPainel = useCallback(async () => {
    if (!tenant?.tenantId) return;

    try {
      const { start, end } = calculateDates();

      // RPC de Métricas Consolidadas
      const { data, error } = await supabase.rpc('get_tenant_financial_metrics', {
        p_start_date: start,
        p_end_date: end,
        p_tenant_id: tenant.tenantId,
      });

      if (error) throw error;
      setMetrics(data as FinancialMetrics);

      const session = await caixaRepo.getActiveSession(tenant.tenantId);
      setActiveSession(session);

      // Uma recarga de cada vez, e a primeira falha interrompe as seguintes, como antes
      for (const reload of Array.from(tabReloadsRef.current)) {
        await reload(session);
      }
      hasLoadedOnceRef.current = true;
    } catch (error: any) {
      console.error('Erro ao carregar dados financeiros:', error);
      addToast('Não foi possível carregar os dados do painel financeiro.', 'error');
    }
  }, [tenant?.tenantId, calculateDates, caixaRepo, addToast]);

  const fetchPainelRef = useRef(fetchPainel);

  useEffect(() => {
    fetchPainelRef.current = fetchPainel;
  }, [fetchPainel]);

  useEffect(() => {
    void fetchPainel();
  }, [fetchPainel]);

  // Realtime: cada evento recarrega o painel com as abas e sinaliza o que só recarrega por realtime
  useEffect(() => {
    if (!tenant?.tenantId || typeof supabase.channel !== 'function') return;

    const handleRealtimeChange = () => {
      setRealtimeVersion((version) => version + 1);
      void fetchPainelRef.current();
    };

    const channel = supabase
      .channel(`realtime-financeiro-${tenant.tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comandas', filter: `tenant_id=eq.${tenant.tenantId}` },
        handleRealtimeChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comanda_pagamentos', filter: `tenant_id=eq.${tenant.tenantId}` },
        handleRealtimeChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_sessions', filter: `tenant_id=eq.${tenant.tenantId}` },
        handleRealtimeChange,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_movements', filter: `tenant_id=eq.${tenant.tenantId}` },
        handleRealtimeChange,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.tenantId]);

  const hasAnimatedEntrance = useRef(false);

  // Animações GSAP com compatibilidade de acessibilidade (executadas na entrada da página)
  useGSAP(() => {
    const prefersReduced =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
        : false;
    if (prefersReduced) return;

    if (!hasAnimatedEntrance.current && metrics) {
      hasAnimatedEntrance.current = true;
      gsap.fromTo(
        '.kpi-card, .card-panel, .turn-banner',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power2.out' }
      );
    }
  }, [metrics]);

  const { start: periodStart, end: periodEnd } = calculateDates();

  const outletContext: PainelContext = {
    ...tenant,
    periodStart,
    periodEnd,
    metrics,
    activeSession,
    setActiveSession,
    refresh: fetchPainel,
    registerTabReload,
    realtimeVersion,
  };

  return (
    <>
      <div className="financeiro-desktop-view mt-2">
        {/* Filtro de Período */}
        <div className="flex items-center gap-1 bg-bg-secondary border border-border p-1 rounded-md shadow-sm">
          {(
            [
              { key: 'this_month', label: 'Este mês' },
              { key: 'last_30_days', label: 'Últimos 30 dias' },
              { key: 'last_90_days', label: 'Últimos 90 dias' },
            ] as const
          ).map(({ key, label }) => {
            const isActive = period === key;
            return (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                type="button"
                aria-pressed={isActive}
                className={`px-[0.85rem] py-[0.4rem] text-xs font-semibold rounded-sm border-none cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] outline-none focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-1 ${
                  isActive
                    ? 'bg-warning-bg text-text-primary shadow-sm'
                    : 'bg-transparent text-text-secondary hover:text-brand-primary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Bento Grid: 5 Cards de KPIs Consolidados */}
        <section className="kpi-cards-grid" aria-label="Indicadores consolidados">
          {/* Card 1: Faturamento Bruto */}
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-label">Faturamento bruto</span>
            </div>
            <div>
              <h3 className="kpi-value">
                {formatCurrency(metrics?.total_revenue || 0)}
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
                {formatCurrency(metrics?.services_revenue || 0)}
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
                {formatCurrency(metrics?.products_revenue || 0)}
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
                {formatCurrency(metrics?.total_commission || 0)}
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
                {formatCurrency(metrics?.net_revenue || 0)}
              </h3>
            </div>
          </div>
        </section>
      </div>

      {/* Conteúdo da aba: irmão do cabeçalho do painel, fora de `.financeiro-desktop-view`,
          porque a visão móvel de Caixa e o conteúdo (já rolável) de Comissões precisam ficar
          visíveis no celular. */}
      <Outlet context={outletContext} />
    </>
  );
};
