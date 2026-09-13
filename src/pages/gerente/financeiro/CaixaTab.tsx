import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Coins01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { useToast } from '../../../components/Toast';
import { LockIcon } from '../../../components/Icons';
import { AberturaAssistidaCaixaModal } from '../../../components/caixa/AberturaAssistidaCaixaModal';
import { FechamentoCaixaModal } from '../../../components/caixa/FechamentoCaixaModal';
import { ExtratoSessaoCaixaModal } from '../../../components/caixa/ExtratoSessaoCaixaModal';
import { supabase } from '../../../lib/supabase';
import { formatCurrency } from '../../../lib/currency';
import { dateInZone } from '../../../lib/timezone';
import { CaixaRepository } from '../../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../../modules/caixa/adapters/SupabaseCaixaAdapter';
import { PAYMENT_METHOD_LABELS } from '../../../modules/caixa/types';
import type {
  CashSession,
  DailyFinancialSummary,
  TurnPaymentsSummary,
} from '../../../modules/caixa/types';
import { MobileCaixaView } from '../mobile/MobileCaixaView';
import { formatDate } from './formatacao';
import type { PainelContext } from './types';

const EMPTY_TURN_SUMMARY: TurnPaymentsSummary = { total: 0, dinheiro: 0, pix: 0, cartao: 0, outros: 0, count: 0 };

function formatLocalDay(date: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

/**
 * Aba "Caixa diário e turnos" do Hub Financeiro, montada pela rota `/financeiro/caixa`: visão
 * móvel de caixa e conteúdo de desktop. Lê o tenant e o estado compartilhado do painel (período,
 * métricas, Sessão de Caixa ativa) do contexto entregue pelo layout do painel.
 */
export const CaixaTab: React.FC = () => {
  const {
    metrics,
    activeSession,
    setActiveSession,
    refresh,
    registerTabReload,
    realtimeVersion,
    ...tenant
  } = useOutletContext<PainelContext>();
  const { addToast } = useToast();

  const [caixaRepo] = useState(() => new CaixaRepository(new SupabaseCaixaAdapter()));
  const [activeSessionCashReceipts, setActiveSessionCashReceipts] = useState<number>(0);
  const [turnSummary, setTurnSummary] = useState<TurnPaymentsSummary>(EMPTY_TURN_SUMMARY);
  const [suprimentosTotal, setSuprimentosTotal] = useState<number>(0);
  const [sangriasTotal, setSangriasTotal] = useState<number>(0);
  const [expectedDrawerAmount, setExpectedDrawerAmount] = useState<number>(0);
  const [repassesComissaoTotal, setRepassesComissaoTotal] = useState<number>(0);
  const [valesTotal, setValesTotal] = useState<number>(0);
  const [historySessions, setHistorySessions] = useState<CashSession[]>([]);
  const [dailySummary, setDailySummary] = useState<DailyFinancialSummary[]>([]);
  const [dailySummaryLoading, setDailySummaryLoading] = useState(false);
  const [dailySummaryError, setDailySummaryError] = useState<string | null>(null);
  const [dailyStartDate, setDailyStartDate] = useState('');
  const [dailyEndDate, setDailyEndDate] = useState('');
  const [selectedDailySessionId, setSelectedDailySessionId] = useState<string | undefined>();
  const [dailyRangeFollowsSession, setDailyRangeFollowsSession] = useState(true);
  const activeSessionId = activeSession?.id;
  const activeSessionOpenedAt = activeSession?.opened_at;
  const [isAberturaModalOpen, setIsAberturaModalOpen] = useState(false);
  const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState(false);
  const [extratoSession, setExtratoSession] = useState<CashSession | null>(null);

  // Resumo do turno, movimentos e histórico de sessões, apurados a partir da Sessão de Caixa ativa.
  // Quem chama é o painel, que trata o erro com uma única mensagem para a carga inteira.
  const fetchCaixaData = useCallback(async (session: CashSession | null) => {
    if (!tenant?.tenantId) return;

    if (session) {
      // Apurar recebimentos em dinheiro exclusivamente do turno ativo via repositório
      const totalCash = await caixaRepo.getCashReceiptsSince(tenant.tenantId, session.opened_at, session.id);
      setActiveSessionCashReceipts(totalCash);

      const turnPayments = await caixaRepo.getTurnPaymentsSummary(tenant.tenantId, session.opened_at, session.id);
      setTurnSummary(turnPayments);

      const movSummary = await caixaRepo.getMovementsSummary(session.id);
      setSuprimentosTotal(movSummary.suprimentos);
      setSangriasTotal(movSummary.sangrias);

      // Prévia da gaveta lida do contrato único de apuração do banco (ticket 02/036): nada é
      // recomposto no navegador, então a diferença exibida aqui já é a que o fechamento persiste.
      // Isolado num try/catch próprio porque a RPC só aceita sessão ABERTA: se a sessão fechar
      // entre o `getActiveSession` do painel e esta chamada, o erro não deve derrubar a carga do
      // resto da aba (recebimentos, resumo do turno e histórico já apurados acima).
      try {
        const expected = await caixaRepo.getExpectedDrawerAmount(session.id, tenant.tenantId);
        setExpectedDrawerAmount(expected.expected_amount);
        setRepassesComissaoTotal(
          expected.movements_by_type
            .filter((m) => m.type === 'repasse_comissao')
            .reduce((sum, m) => sum + m.amount, 0)
        );
        setValesTotal(
          expected.movements_by_type
            .filter((m) => m.type === 'vale_profissional')
            .reduce((sum, m) => sum + m.amount, 0)
        );
      } catch (error) {
        console.error('Erro ao apurar o valor esperado da gaveta:', error);
        setExpectedDrawerAmount(0);
        setRepassesComissaoTotal(0);
        setValesTotal(0);
      }
    } else {
      setActiveSessionCashReceipts(0);
      setTurnSummary(EMPTY_TURN_SUMMARY);
      setSuprimentosTotal(0);
      setSangriasTotal(0);
      setExpectedDrawerAmount(0);
      setRepassesComissaoTotal(0);
      setValesTotal(0);
    }

    const history = await caixaRepo.listHistory(tenant.tenantId, 15);
    setHistorySessions(history || []);
  }, [tenant?.tenantId, caixaRepo]);

  useEffect(() => registerTabReload(fetchCaixaData), [registerTabReload, fetchCaixaData]);

  useEffect(() => {
    if (!dailyRangeFollowsSession || !tenant?.timezone) return;

    const today = dateInZone(new Date(), tenant.timezone);
    const sessionStart = activeSessionOpenedAt
      ? dateInZone(new Date(activeSessionOpenedAt), tenant.timezone)
      : today;

    setDailyStartDate(sessionStart);
    setDailyEndDate(today);
    setSelectedDailySessionId(activeSessionId);
  }, [activeSessionId, activeSessionOpenedAt, dailyRangeFollowsSession, tenant?.timezone]);

  const fetchDailySummary = useCallback(async () => {
    if (!tenant?.tenantId || !dailyStartDate || !dailyEndDate || !tenant.timezone) return;

    try {
      setDailySummaryLoading(true);
      setDailySummaryError(null);
      const result = await caixaRepo.getDailyFinancialSummary({
        tenantId: tenant.tenantId,
        startDate: dailyStartDate,
        endDate: dailyEndDate,
        timeZone: tenant.timezone,
        cashSessionId: selectedDailySessionId,
      });
      setDailySummary(result);
    } catch (error) {
      console.error('Erro ao carregar resumo financeiro diário:', error);
      setDailySummary([]);
      setDailySummaryError('Não foi possível carregar o resumo por dia. Tente novamente.');
    } finally {
      setDailySummaryLoading(false);
    }
  }, [caixaRepo, dailyEndDate, dailyStartDate, selectedDailySessionId, tenant?.tenantId, tenant?.timezone]);

  // Recarrega quando o filtro muda e a cada evento realtime
  useEffect(() => {
    void fetchDailySummary();
  }, [fetchDailySummary, realtimeVersion]);

  const handleSangria = async (amount: number, reason: string) => {
    if (!activeSession || !tenant.tenantId) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      await caixaRepo.registerMovement({
        tenant_id: tenant.tenantId,
        cash_session_id: activeSession.id,
        type: 'sangria',
        amount,
        reason,
        performed_by: authData?.user?.id || null,
      });
      addToast(`Sangria de ${formatCurrency(amount)} registrada com sucesso.`, 'success');
      await refresh();
    } catch (err: any) {
      console.error('Erro ao registrar sangria:', err);
      addToast(err?.message || 'Erro ao registrar sangria.', 'error');
      throw err;
    }
  };

  const handleSuprimento = async (amount: number, reason: string) => {
    if (!activeSession || !tenant.tenantId) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      await caixaRepo.registerMovement({
        tenant_id: tenant.tenantId,
        cash_session_id: activeSession.id,
        type: 'suprimento',
        amount,
        reason,
        performed_by: authData?.user?.id || null,
      });
      addToast(`Suprimento de ${formatCurrency(amount)} registrado com sucesso.`, 'success');
      await refresh();
    } catch (err: any) {
      console.error('Erro ao registrar suprimento:', err);
      addToast(err?.message || 'Erro ao registrar suprimento.', 'error');
      throw err;
    }
  };

  const methodsList = useMemo(() => {
    if (!metrics || !metrics.revenue_by_method) return [];

    const rawMap = metrics.revenue_by_method;
    const entries = Object.entries(rawMap);

    if (entries.length === 0) {
      return [
        { key: 'pix', name: PAYMENT_METHOD_LABELS.pix || 'PIX', val: 0 },
        { key: 'credit_card', name: PAYMENT_METHOD_LABELS.credit_card || 'Cartão de crédito', val: 0 },
        { key: 'cash', name: PAYMENT_METHOD_LABELS.cash || 'Dinheiro em espécie', val: 0 },
      ];
    }

    return entries
      .map(([rawKey, val]) => {
        const normalizedKey = rawKey.toLowerCase().trim();
        return {
          key: normalizedKey,
          name: PAYMENT_METHOD_LABELS[normalizedKey] || rawKey,
          val: Number(val) || 0,
        };
      })
      .sort((a, b) => b.val - a.val);
  }, [metrics]);

  const totalRevenueByMethods = useMemo(() => {
    return methodsList.reduce((acc, curr) => acc + curr.val, 0);
  }, [methodsList]);

  const dailyTotals = useMemo(() => {
    return dailySummary.reduce(
      (totals, summary) => ({
        realized: totals.realized + summary.realized_revenue,
        received: totals.received + summary.received_total,
      }),
      { realized: 0, received: 0 },
    );
  }, [dailySummary]);

  const handleDailySessionChange = (sessionId: string) => {
    setDailyRangeFollowsSession(false);
    setSelectedDailySessionId(sessionId || undefined);

    if (!sessionId) {
      const today = dateInZone(new Date(), tenant.timezone);
      setDailyStartDate(today);
      setDailyEndDate(today);
      return;
    }

    const session = historySessions.find((item) => item.id === sessionId);
    if (!session) return;

    setDailyStartDate(dateInZone(new Date(session.opened_at), tenant.timezone));
    setDailyEndDate(
      dateInZone(new Date(session.closed_at || new Date().toISOString()), tenant.timezone),
    );
  };

  return (
    <>
      {/* ─── VISÃO MOBILE (<= 768px) ─── */}
      <div className="financeiro-mobile-view">
        <MobileCaixaView
          activeSession={activeSession}
          activeSessionCashReceipts={activeSessionCashReceipts}
          turnSummary={turnSummary}
          suprimentosTotal={suprimentosTotal}
          sangriasTotal={sangriasTotal}
          repassesComissaoTotal={repassesComissaoTotal}
          valesTotal={valesTotal}
          expectedDrawerAmount={expectedDrawerAmount}
          metrics={metrics}
          historySessions={historySessions}
          dailySummary={dailySummary}
          dailySummaryLoading={dailySummaryLoading}
          dailySummaryError={dailySummaryError}
          dailyStartDate={dailyStartDate}
          dailyEndDate={dailyEndDate}
          selectedDailySessionId={selectedDailySessionId}
          onDailyStartDateChange={(date) => {
            setDailyRangeFollowsSession(false);
            setDailyStartDate(date);
          }}
          onDailyEndDateChange={(date) => {
            setDailyRangeFollowsSession(false);
            setDailyEndDate(date);
          }}
          onDailySessionChange={handleDailySessionChange}
          onOpenAbertura={() => setIsAberturaModalOpen(true)}
          onOpenFechamento={() => setIsFechamentoModalOpen(true)}
          onSangria={handleSangria}
          onSuprimento={handleSuprimento}
          formatDate={formatDate}
        />
      </div>

      {/* ─── VISÃO DESKTOP (> 768px) ─── */}
      <div className="financeiro-desktop-view financeiro-tab-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Banner de Sessão Ativa */}
            <div className="turn-banner">
              <div className="turn-banner-info">
                <div>
                  <div className="turn-banner-title-row">
                    <h3 className="turn-banner-title">
                      {activeSession ? 'Caixa aberto no turno atual' : 'Caixa fechado no momento'}
                    </h3>
                    <span
                      className={`turn-status-badge ${
                        activeSession ? 'turn-status-badge--active' : 'turn-status-badge--closed'
                      }`}
                    >
                      {activeSession ? 'Turno ativo' : 'Aguardando abertura'}
                    </span>
                  </div>
                  <p className="turn-banner-desc">
                    {activeSession
                      ? `Aberto em ${formatDate(activeSession.opened_at)} • Fundo de troco: ${formatCurrency(activeSession.initial_amount)} • Entradas: ${formatCurrency(activeSessionCashReceipts)}${suprimentosTotal > 0 ? ` • Suprimentos: +${formatCurrency(suprimentosTotal)}` : ''}${sangriasTotal > 0 ? ` • Sangrias: -${formatCurrency(sangriasTotal)}` : ''}${repassesComissaoTotal > 0 ? ` • Repasses de comissão: -${formatCurrency(repassesComissaoTotal)}` : ''}${valesTotal > 0 ? ` • Vales: -${formatCurrency(valesTotal)}` : ''} • Total na Gaveta: ${formatCurrency(expectedDrawerAmount)}`
                      : 'Inicie o turno registrando o fundo de troco da gaveta para liberar a movimentação das comandas.'}
                  </p>
                </div>
              </div>

              {/* Botões de Ação de Caixa */}
              <div>
                {activeSession ? (
                  <button
                    onClick={() => setIsFechamentoModalOpen(true)}
                    type="button"
                    className="btn-turn-action btn-turn-action--close"
                  >
                    <LockIcon size={16} />
                    Fechar caixa do turno
                  </button>
                ) : (
                  <button
                    onClick={() => setIsAberturaModalOpen(true)}
                    type="button"
                    className="btn-turn-action btn-turn-action--open"
                  >
                    <HugeiconsIcon icon={PlusSignIcon} size={16} />
                    Abrir caixa do turno
                  </button>
                )}
              </div>
            </div>

            {/* Resumo financeiro diário: faturamento realizado separado das entradas */}
            <section className="daily-financial-panel" aria-labelledby="daily-financial-title">
              <div className="daily-financial-header">
                <div>
                  <h3 id="daily-financial-title" className="card-panel-title">
                    <HugeiconsIcon icon={Coins01Icon} size={18} />
                    Resumo por dia
                  </h3>
                  <p className="card-panel-subtitle">
                    Faturamento realizado e valores recebidos, separados por data local da barbearia.
                  </p>
                </div>
                <div className="daily-financial-filters" aria-label="Filtros do resumo diário">
                  <label>
                    <span>De</span>
                    <input
                      aria-label="Data inicial do resumo diário"
                      type="date"
                      value={dailyStartDate}
                      onChange={(event) => {
                        setDailyRangeFollowsSession(false);
                        setDailyStartDate(event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    <span>Até</span>
                    <input
                      aria-label="Data final do resumo diário"
                      type="date"
                      value={dailyEndDate}
                      onChange={(event) => {
                        setDailyRangeFollowsSession(false);
                        setDailyEndDate(event.target.value);
                      }}
                    />
                  </label>
                  <label>
                    <span>Sessão</span>
                    <select
                      aria-label="Sessão do resumo diário"
                      value={selectedDailySessionId || ''}
                      onChange={(event) => handleDailySessionChange(event.target.value)}
                    >
                      <option value="">Todas as sessões</option>
                      {historySessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.status === 'open' ? 'Atual' : 'Encerrada'} — {formatDate(session.opened_at)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="daily-financial-kpis">
                <div className="daily-financial-kpi daily-financial-kpi--revenue">
                  <span>Faturamento realizado</span>
                  <strong>{formatCurrency(dailyTotals.realized)}</strong>
                  <small>{dailySummary.reduce((count, item) => count + item.closed_comandas_count, 0)} comandas fechadas</small>
                </div>
                <div className="daily-financial-kpi daily-financial-kpi--received">
                  <span>Entradas no caixa</span>
                  <strong>{formatCurrency(dailyTotals.received)}</strong>
                  <small>{dailySummary.reduce((count, item) => count + item.payment_count, 0)} pagamentos registrados</small>
                </div>
              </div>

              {dailySummaryLoading ? (
                <div className="table-empty-notice" role="status">Carregando resumo por dia...</div>
              ) : dailySummaryError ? (
                <div className="table-empty-notice daily-financial-error" role="alert">{dailySummaryError}</div>
              ) : (
                <div className="table-responsive-container">
                  <table className="financeiro-data-table daily-financial-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Faturado</th>
                        <th>Recebido</th>
                        <th>Dinheiro</th>
                        <th>PIX</th>
                        <th>Cartão</th>
                        <th>Outros</th>
                        <th>Comandas</th>
                        <th>Pagamentos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.map((summary) => (
                        <tr key={summary.date}>
                          <td style={{ fontWeight: 700 }}>{formatLocalDay(summary.date, tenant.timezone)}</td>
                          <td className="daily-financial-value">{formatCurrency(summary.realized_revenue)}</td>
                          <td className="daily-financial-value">{formatCurrency(summary.received_total)}</td>
                          <td>{formatCurrency(summary.by_method.dinheiro)}</td>
                          <td>{formatCurrency(summary.by_method.pix)}</td>
                          <td>{formatCurrency(summary.by_method.cartao)}</td>
                          <td>{formatCurrency(summary.by_method.outros)}</td>
                          <td>{summary.closed_comandas_count}</td>
                          <td>{summary.payment_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Grid Intermediário: Métodos de Pagamento e Histórico de Sessões */}
            <div className="financeiro-split-grid">
              {/* Métodos de Pagamento */}
              <div className="card-panel">
                <div className="card-panel-header">
                  <div>
                    <h3 className="card-panel-title">
                      Recebimentos por forma de pagamento
                    </h3>
                    <p className="card-panel-subtitle">Distribuição das entradas por meio de pagamento no período selecionado</p>
                  </div>
                </div>

                <div className="payment-methods-list">
                  {methodsList.map((m) => {
                    const pct = totalRevenueByMethods > 0 ? (m.val / totalRevenueByMethods) * 100 : 0;
                    return (
                      <div key={m.key} className="payment-method-item">
                        <div className="payment-method-header">
                          <span className="payment-method-name">{m.name}</span>
                          <span className="payment-method-amount">
                            {formatCurrency(m.val)} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="payment-progress-track">
                          <div
                            className="payment-progress-bar"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Histórico de Sessões de Caixa */}
              <div className="card-panel">
                <div className="card-panel-header">
                  <div>
                    <h3 className="card-panel-title">
                      Histórico de caixas anteriores
                    </h3>
                    <p className="card-panel-subtitle">Histórico completo de turnos e conferências de gaveta</p>
                  </div>
                </div>

                {historySessions.length === 0 ? (
                  <div className="table-empty-notice">
                    Nenhum fechamento de caixa registrado para o período.
                  </div>
                ) : (
                  <div className="table-responsive-container">
                    <table className="financeiro-data-table">
                      <thead>
                        <tr>
                          <th>Abertura</th>
                          <th>Fechamento</th>
                          <th>Operador</th>
                          <th>Arrecadado no turno</th>
                          <th>Troco inicial</th>
                          <th>Valor fechado</th>
                          <th>Observações</th>
                          <th>Status</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historySessions.map((sess) => {
                          const isCurrentActive = activeSession?.id === sess.id;
                          const revenue = isCurrentActive
                            ? (turnSummary?.total || sess.total_revenue || 0)
                            : (sess.total_revenue || 0);

                          return (
                            <tr key={sess.id}>
                              <td style={{ fontWeight: 700 }}>{formatDate(sess.opened_at)}</td>
                              <td style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatDate(sess.closed_at)}</td>
                              <td style={{ fontWeight: 600 }}>
                                {sess.opened_by_name || sess.closed_by_name || 'Operador'}
                              </td>
                              <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: 'var(--color-brand-primary)' }}>
                                {formatCurrency(revenue)}
                              </td>
                              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sess.initial_amount)}</td>
                              <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                                {sess.closing_amount !== null ? formatCurrency(sess.closing_amount) : '-'}
                              </td>
                              <td style={{ color: 'var(--color-text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sess.notes || ''}>
                                {sess.notes || '-'}
                              </td>
                              <td>
                                <span
                                  className={`turn-status-badge ${
                                    sess.status === 'open'
                                      ? 'turn-status-badge--active'
                                      : 'turn-status-badge--closed'
                                  }`}
                                >
                                  {sess.status === 'open' ? 'Aberto' : 'Encerrado'}
                                </span>
                              </td>
                              <td>
                                {sess.status !== 'open' && (
                                  <button
                                    type="button"
                                    className="btn-table-action btn-table-action--ghost"
                                    onClick={() => setExtratoSession(sess)}
                                  >
                                    Extrato
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Modal 1: Abertura de Caixa */}
      <AberturaAssistidaCaixaModal
        isOpen={isAberturaModalOpen}
        tenantId={tenant?.tenantId || ''}
        caixaRepo={caixaRepo}
        onCaixaAberto={(newSession) => {
          setActiveSession(newSession);
          setIsAberturaModalOpen(false);
          addToast('Caixa aberto com sucesso!', 'success');
          void refresh();
        }}
        onClose={() => setIsAberturaModalOpen(false)}
      />

      {/* Modal 2: Fechamento de Caixa com Conferência */}
      <FechamentoCaixaModal
        isOpen={isFechamentoModalOpen}
        session={activeSession}
        cashReceipts={activeSessionCashReceipts}
        turnSummary={turnSummary}
        suprimentos={suprimentosTotal}
        sangrias={sangriasTotal}
        repassesComissaoTotal={repassesComissaoTotal}
        valesTotal={valesTotal}
        expectedDrawerAmount={expectedDrawerAmount}
        caixaRepo={caixaRepo}
        onCaixaFechado={(_closedSession) => {
          setActiveSession(null);
          setIsFechamentoModalOpen(false);
          addToast('Caixa do turno encerrado com sucesso!', 'success');
          void refresh();
        }}
        onClose={() => setIsFechamentoModalOpen(false)}
      />

      {/* Extrato imprimível da Sessão de Caixa */}
      <ExtratoSessaoCaixaModal
        isOpen={!!extratoSession}
        session={extratoSession}
        tenantId={tenant?.tenantId || ''}
        tenantName={tenant?.tenantName}
        caixaRepo={caixaRepo}
        onClose={() => setExtratoSession(null)}
      />
    </>
  );
};
