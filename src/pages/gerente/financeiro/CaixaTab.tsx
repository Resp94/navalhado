import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { useToast } from '../../../components/Toast';
import { Button, DateRangePicker } from '../../../components/ui';
import { LockIcon } from '../../../components/Icons';
import { AberturaAssistidaCaixaModal } from '../../../components/caixa/AberturaAssistidaCaixaModal';
import { FechamentoCaixaModal } from '../../../components/caixa/FechamentoCaixaModal';
import { ExtratoSessaoCaixaModal } from '../../../components/caixa/ExtratoSessaoCaixaModal';
import { ReabrirCaixaDialog } from '../../../components/caixa/ReabrirCaixaDialog';
import { PercentageBar } from '../../../components/ui/data-display/PercentageBar';
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

// Tabelas do Hub Financeiro (ticket 08/039): classes compartilhadas entre CaixaTab e
// ComissoesTab, únicas consumidoras de `.financeiro-data-table` e afins em Financeiro.css.
const TABLE_WRAP_CLASSES = 'border border-border rounded-md overflow-x-auto bg-bg-secondary';
const TABLE_CLASSES = 'w-full border-collapse text-sm text-left';
const TH_CLASSES = 'bg-bg-primary px-4 py-3 text-[11px] uppercase tracking-wide font-bold text-text-primary border-b border-border whitespace-nowrap';
const TBODY_CLASSES = 'divide-y divide-border';
const TR_HOVER_CLASSES = 'hover:bg-[rgba(217,108,0,0.025)]';
const TD_CLASSES = 'px-4 py-[0.85rem] text-text-primary';
const TABLE_EMPTY_NOTICE_CLASSES = 'px-4 py-10 text-center text-xs text-text-secondary';
const BTN_TABLE_ACTION_GHOST_CLASSES =
  'inline-flex items-center gap-[0.35rem] px-3 py-[0.4rem] rounded-sm text-[11px] font-bold cursor-pointer border-0 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-brand-primary focus-visible:outline-offset-1 bg-transparent text-text-primary shadow-[0_0_0_0.5px_var(--color-text-primary)] hover:bg-[rgba(45,35,30,0.05)] hover:text-text-primary hover:shadow-[0_0_0_0.5px_var(--color-text-primary)] [@media(pointer:coarse)]:min-h-[38px] [@media(pointer:coarse)]:px-[0.85rem] [@media(pointer:coarse)]:py-2';

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
  const [expectedDrawerAmount, setExpectedDrawerAmount] = useState<number | undefined>(undefined);
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
  const [reabrirSession, setReabrirSession] = useState<CashSession | null>(null);

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
        // Deixa em `undefined`, nunca em zero: um R$ 0,00 falso pareceria um valor apurado e
        // esconderia a falha numa tela de conferência de dinheiro físico. `undefined` é o mesmo
        // sinal que o FechamentoCaixaModal já trata como "buscar de novo" (ticket 02/036).
        console.error('Erro ao apurar o valor esperado da gaveta:', error);
        setExpectedDrawerAmount(undefined);
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
      // Ticket 03 da spec 036: sangria por RPC, sem enviar autor (a RPC tira
      // o autor da sessao autenticada) e com trava de saldo no servidor.
      await caixaRepo.registerManualMovement({
        tenant_id: tenant.tenantId,
        cash_session_id: activeSession.id,
        type: 'sangria',
        amount,
        reason,
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
      // Ticket 03 da spec 036: mesma RPC de movimento manual do suprimento.
      await caixaRepo.registerManualMovement({
        tenant_id: tenant.tenantId,
        cash_session_id: activeSession.id,
        type: 'suprimento',
        amount,
        reason,
      });
      addToast(`Suprimento de ${formatCurrency(amount)} registrado com sucesso.`, 'success');
      await refresh();
    } catch (err: any) {
      console.error('Erro ao registrar suprimento:', err);
      addToast(err?.message || 'Erro ao registrar suprimento.', 'error');
      throw err;
    }
  };

  const handleSessaoReaberta = async (session: CashSession) => {
    setReabrirSession(null);
    addToast('Turno reaberto com sucesso.', 'success');
    setActiveSession(session);
    await refresh();
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
            {/* Banner de Sessão Ativa. Mantém a classe `turn-banner` sem estilo próprio (token
                inerte) porque `PainelLayout` anima `.turn-banner` na entrada via seletor gsap. */}
            <div className="turn-banner bg-bg-secondary border border-border rounded-lg p-6 flex flex-col gap-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-extrabold text-text-primary m-0">
                      {activeSession ? 'Caixa aberto no turno atual' : 'Caixa fechado no momento'}
                    </h3>
                    <span
                      className={`inline-block px-[0.6rem] py-[0.2rem] rounded-full text-[11px] font-bold ${
                        activeSession ? 'bg-success text-bg-secondary' : 'bg-error text-bg-secondary shadow-none'
                      }`}
                    >
                      {activeSession ? 'Turno ativo' : 'Aguardando abertura'}
                    </span>
                  </div>
                  <p className="text-xs text-text-primary mt-[0.35rem] leading-[1.4]">
                    {activeSession
                      ? `Aberto em ${formatDate(activeSession.opened_at)} • Fundo de troco: ${formatCurrency(activeSession.initial_amount)} • Entradas: ${formatCurrency(activeSessionCashReceipts)}${suprimentosTotal > 0 ? ` • Suprimentos: +${formatCurrency(suprimentosTotal)}` : ''}${sangriasTotal > 0 ? ` • Sangrias: -${formatCurrency(sangriasTotal)}` : ''}${repassesComissaoTotal > 0 ? ` • Repasses de comissão: -${formatCurrency(repassesComissaoTotal)}` : ''}${valesTotal > 0 ? ` • Vales: -${formatCurrency(valesTotal)}` : ''} • Total na Gaveta: ${expectedDrawerAmount === undefined ? 'indisponível no momento' : formatCurrency(expectedDrawerAmount)}`
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
                    className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-md text-sm font-bold cursor-pointer border-none transition-all duration-200 whitespace-nowrap bg-error text-white shadow-sm hover:bg-[#d83a3a] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(240,82,82,0.25)]"
                  >
                    <LockIcon size={16} />
                    Fechar caixa do turno
                  </button>
                ) : (
                  <Button
                    onClick={() => setIsAberturaModalOpen(true)}
                    type="button"
                    variant="primary"
                    leftIcon={<HugeiconsIcon icon={PlusSignIcon} size={16} />}
                  >
                    Abrir caixa do turno
                  </Button>
                )}
              </div>
            </div>

            {/* Resumo financeiro diário: faturamento realizado separado das entradas */}
            <section
              className="bg-bg-secondary border border-border rounded-lg p-6 flex flex-col gap-5 shadow-sm min-w-0 box-border max-md:p-4"
              aria-labelledby="daily-financial-title"
            >
              <div className="flex items-start justify-between gap-6 min-w-0 max-md:flex-col max-md:gap-4">
                <div>
                  <h3 id="daily-financial-title" className="card-panel-title">
                    Resumo por dia
                  </h3>
                  <p className="card-panel-subtitle">
                    Faturamento realizado e valores recebidos, separados por data local da barbearia.
                  </p>
                </div>
                <div
                  className="flex items-end gap-3 flex-wrap min-w-0 max-md:grid max-md:grid-cols-2 max-md:w-full max-md:gap-3 [&_label]:flex [&_label]:flex-col [&_label]:gap-[0.3rem] [&_label]:text-xs [&_label]:font-bold [&_label]:text-text-primary max-md:[&_label]:min-w-0 max-md:[&_label]:w-full max-md:[&_label:last-child]:col-span-full [&_input]:min-w-0 [&_input]:max-w-full [&_input]:min-h-[38px] [&_input]:px-[0.6rem] [&_input]:py-[0.45rem] [&_input]:border-none [&_input]:shadow-[0_0_0_0.888889px_var(--color-text-primary)] [&_input]:rounded-sm [&_input]:bg-transparent [&_input]:text-text-primary [&_input]:font-semibold [&_input]:box-border [&_select]:min-w-[190px] [&_select]:max-w-full [&_select]:min-h-[38px] [&_select]:px-[0.6rem] [&_select]:py-[0.45rem] [&_select]:border-none [&_select]:shadow-[0_0_0_0.888889px_var(--color-text-primary)] [&_select]:rounded-sm [&_select]:bg-transparent [&_select]:text-text-primary [&_select]:font-semibold [&_select]:box-border max-md:[&_input]:w-full max-md:[&_select]:w-full max-md:[&_select]:min-w-0"
                  aria-label="Filtros do resumo diário"
                >
                  <label>
                    <span>Período</span>
                    <DateRangePicker
                      ariaLabel="Período do resumo diário"
                      from={dailyStartDate}
                      to={dailyEndDate}
                      onChange={({ from, to }) => {
                        setDailyRangeFollowsSession(false);
                        setDailyStartDate(from);
                        setDailyEndDate(to);
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

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-[0.2rem] p-4 rounded-md shadow-[0_0_0_0.888889px_var(--color-text-primary)] bg-transparent [&_span]:text-text-primary [&_span]:text-xs [&_small]:text-text-primary [&_small]:text-xs [&_strong]:text-brand-primary [&_strong]:text-[1.4rem] [&_strong]:tabular-nums">
                  <span>Faturamento realizado</span>
                  <strong>{formatCurrency(dailyTotals.realized)}</strong>
                  <small>{dailySummary.reduce((count, item) => count + item.closed_comandas_count, 0)} comandas fechadas</small>
                </div>
                <div className="flex flex-col gap-[0.2rem] p-4 rounded-md shadow-[0_0_0_0.888889px_var(--color-text-primary)] bg-transparent [&_span]:text-text-primary [&_span]:text-xs [&_small]:text-text-primary [&_small]:text-xs [&_strong]:text-success [&_strong]:text-[1.4rem] [&_strong]:tabular-nums">
                  <span>Entradas no caixa</span>
                  <strong>{formatCurrency(dailyTotals.received)}</strong>
                  <small>{dailySummary.reduce((count, item) => count + item.payment_count, 0)} pagamentos registrados</small>
                </div>
              </div>

              {dailySummaryLoading ? (
                <div className={TABLE_EMPTY_NOTICE_CLASSES} role="status">Carregando resumo por dia...</div>
              ) : dailySummaryError ? (
                <div className={`${TABLE_EMPTY_NOTICE_CLASSES} text-error`} role="alert">{dailySummaryError}</div>
              ) : (
                <div className={TABLE_WRAP_CLASSES}>
                  <table className={`${TABLE_CLASSES} [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap`}>
                    <thead>
                      <tr>
                        <th className={TH_CLASSES}>Data</th>
                        <th className={TH_CLASSES}>Faturado</th>
                        <th className={TH_CLASSES}>Recebido</th>
                        <th className={TH_CLASSES}>Dinheiro</th>
                        <th className={TH_CLASSES}>PIX</th>
                        <th className={TH_CLASSES}>Cartão</th>
                        <th className={TH_CLASSES}>Outros</th>
                        <th className={TH_CLASSES}>Comandas</th>
                        <th className={TH_CLASSES}>Pagamentos</th>
                      </tr>
                    </thead>
                    <tbody className={TBODY_CLASSES}>
                      {dailySummary.map((summary) => (
                        <tr key={summary.date} className={TR_HOVER_CLASSES}>
                          <td className={TD_CLASSES} style={{ fontWeight: 700 }}>{formatLocalDay(summary.date, tenant.timezone)}</td>
                          <td className={`${TD_CLASSES} font-extrabold tabular-nums`}>{formatCurrency(summary.realized_revenue)}</td>
                          <td className={`${TD_CLASSES} font-extrabold tabular-nums`}>{formatCurrency(summary.received_total)}</td>
                          <td className={TD_CLASSES}>{formatCurrency(summary.by_method.dinheiro)}</td>
                          <td className={TD_CLASSES}>{formatCurrency(summary.by_method.pix)}</td>
                          <td className={TD_CLASSES}>{formatCurrency(summary.by_method.cartao)}</td>
                          <td className={TD_CLASSES}>{formatCurrency(summary.by_method.outros)}</td>
                          <td className={TD_CLASSES}>{summary.closed_comandas_count}</td>
                          <td className={TD_CLASSES}>{summary.payment_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Grid Intermediário: Métodos de Pagamento e Histórico de Sessões */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
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

                <div className="flex flex-col gap-4">
                  {methodsList.map((m) => {
                    const pct = totalRevenueByMethods > 0 ? (m.val / totalRevenueByMethods) * 100 : 0;
                    return (
                      <PercentageBar
                        key={m.key}
                        label={m.name}
                        value={`${formatCurrency(m.val)} (${pct.toFixed(0)}%)`}
                        share={pct / 100}
                      />
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
                  <div className={TABLE_EMPTY_NOTICE_CLASSES}>
                    Nenhum fechamento de caixa registrado para o período.
                  </div>
                ) : (
                  <div className={TABLE_WRAP_CLASSES}>
                    <table className={TABLE_CLASSES}>
                      <thead>
                        <tr>
                          <th className={TH_CLASSES}>Abertura</th>
                          <th className={TH_CLASSES}>Fechamento</th>
                          <th className={TH_CLASSES}>Operador</th>
                          <th className={TH_CLASSES}>Arrecadado no turno</th>
                          <th className={TH_CLASSES}>Troco inicial</th>
                          <th className={TH_CLASSES}>Valor fechado</th>
                          <th className={TH_CLASSES}>Observações</th>
                          <th className={TH_CLASSES}>Status</th>
                          <th className={TH_CLASSES}>Ações</th>
                        </tr>
                      </thead>
                      <tbody className={TBODY_CLASSES}>
                        {historySessions.map((sess) => {
                          const isCurrentActive = activeSession?.id === sess.id;
                          const revenue = isCurrentActive
                            ? (turnSummary?.total || sess.total_revenue || 0)
                            : (sess.total_revenue || 0);

                          return (
                            <tr key={sess.id} className={TR_HOVER_CLASSES}>
                              <td className={TD_CLASSES} style={{ fontWeight: 700 }}>{formatDate(sess.opened_at)}</td>
                              <td className={TD_CLASSES} style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{formatDate(sess.closed_at)}</td>
                              <td className={TD_CLASSES} style={{ fontWeight: 600 }}>
                                {sess.opened_by_name || sess.closed_by_name || 'Operador'}
                              </td>
                              <td className={TD_CLASSES} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: 'var(--color-brand-primary)' }}>
                                {formatCurrency(revenue)}
                              </td>
                              <td className={TD_CLASSES} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(sess.initial_amount)}</td>
                              <td className={TD_CLASSES} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                                {sess.closing_amount !== null ? formatCurrency(sess.closing_amount) : '-'}
                              </td>
                              <td className={TD_CLASSES} style={{ color: 'var(--color-text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sess.notes || ''}>
                                {sess.notes || '-'}
                              </td>
                              <td className={TD_CLASSES}>
                                <span
                                  className={`inline-block px-[0.6rem] py-[0.2rem] rounded-full text-[11px] font-bold ${
                                    sess.status === 'open'
                                      ? 'bg-success text-bg-secondary'
                                      : 'bg-error text-bg-secondary shadow-none'
                                  }`}
                                >
                                  {sess.status === 'open' ? 'Aberto' : 'Encerrado'}
                                </span>
                              </td>
                              <td className={TD_CLASSES} style={{ display: 'flex', gap: '0.5rem' }}>
                                {sess.status !== 'open' && (
                                  <button
                                    type="button"
                                    className={BTN_TABLE_ACTION_GHOST_CLASSES}
                                    onClick={() => setExtratoSession(sess)}
                                  >
                                    Extrato
                                  </button>
                                )}
                                {sess.status !== 'open' && !activeSession && (
                                  <button
                                    type="button"
                                    className={BTN_TABLE_ACTION_GHOST_CLASSES}
                                    onClick={() => setReabrirSession(sess)}
                                  >
                                    Reabrir
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

      {/* Reabertura de sessão de caixa encerrada, para permitir estorno de Baixa pela gaveta,
          vale ou Quitação de Comissão lançados no turno (bug encontrado na validação da spec 036). */}
      <ReabrirCaixaDialog
        isOpen={!!reabrirSession}
        repository={caixaRepo}
        tenantId={tenant?.tenantId || ''}
        session={reabrirSession}
        onReaberta={handleSessaoReaberta}
        onFechar={() => setReabrirSession(null)}
      />
    </>
  );
};
