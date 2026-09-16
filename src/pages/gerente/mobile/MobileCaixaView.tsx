import React, { useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  PlusSignIcon,
  Clock01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons';
import { LockIcon } from '../../../components/Icons';
import { MobileBottomSheet } from '../../../components/mobile/MobileBottomSheet';
import { formatCurrency } from '../../../lib/currency';
import { useToast } from '../../../components/Toast';
import type {
  CashSession,
  DailyFinancialSummary,
  TurnPaymentsSummary,
} from '../../../modules/caixa/types';
import type { FinancialMetrics } from '../financeiro/types';

interface MobileCaixaViewProps {
  activeSession: CashSession | null;
  activeSessionCashReceipts: number;
  turnSummary?: TurnPaymentsSummary;
  suprimentosTotal?: number;
  sangriasTotal?: number;
  /** Repasses de comissão e vales pagos em dinheiro no turno, lidos do contrato do banco
   * (ticket 02/036): descontam a gaveta junto com as sangrias. */
  repassesComissaoTotal?: number;
  valesTotal?: number;
  /** Valor esperado da gaveta, lido do contrato de apuração do banco (ticket 02/036). */
  expectedDrawerAmount?: number;
  metrics: FinancialMetrics | null;
  historySessions: CashSession[];
  dailySummary?: DailyFinancialSummary[];
  dailySummaryLoading?: boolean;
  dailySummaryError?: string | null;
  dailyStartDate?: string;
  dailyEndDate?: string;
  selectedDailySessionId?: string;
  onDailyStartDateChange?: (date: string) => void;
  onDailyEndDateChange?: (date: string) => void;
  onDailySessionChange?: (sessionId: string) => void;
  onOpenAbertura: () => void;
  onOpenFechamento: () => void;
  onSangria?: (amount: number, reason: string) => Promise<void> | void;
  onSuprimento?: (amount: number, reason: string) => Promise<void> | void;
  formatDate: (dateStr: string) => string;
}

export const MobileCaixaView: React.FC<MobileCaixaViewProps> = ({
  activeSession,
  activeSessionCashReceipts,
  turnSummary,
  suprimentosTotal = 0,
  sangriasTotal = 0,
  repassesComissaoTotal = 0,
  valesTotal = 0,
  expectedDrawerAmount,
  metrics,
  historySessions,
  dailySummary = [],
  dailySummaryLoading = false,
  dailySummaryError = null,
  dailyStartDate = '',
  dailyEndDate = '',
  selectedDailySessionId,
  onDailyStartDateChange,
  onDailyEndDateChange,
  onDailySessionChange,
  onOpenAbertura,
  onOpenFechamento,
  onSangria,
  onSuprimento,
  formatDate,
}) => {
  const { addToast } = useToast();

  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'sangria' | 'suprimento'>('sangria');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const pixTotal = turnSummary?.pix ?? (metrics?.revenue_by_method?.['pix'] || 0);
  const cardTotal =
    turnSummary?.cartao ??
    ((metrics?.revenue_by_method?.['credit_card'] || metrics?.revenue_by_method?.['cartao_credito'] || 0) +
      (metrics?.revenue_by_method?.['debit_card'] || metrics?.revenue_by_method?.['cartao_debito'] || 0));

  const totalRevenue = Math.max(
    Number(turnSummary?.total || 0),
    Number(metrics?.total_revenue || 0)
  );

  const initialAmount = Number(activeSession?.initial_amount) || 0;
  const totalCashInDrawer = expectedDrawerAmount;

  const dailyTotals = useMemo(() => {
    return dailySummary.reduce(
      (totals, summary) => ({
        realized: totals.realized + summary.realized_revenue,
        received: totals.received + summary.received_total,
      }),
      { realized: 0, received: 0 },
    );
  }, [dailySummary]);

  const formatDailyDate = (date: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(`${date}T12:00:00Z`));
  };

  const handleOpenMovement = (type: 'sangria' | 'suprimento') => {
    setMovementType(type);
    setMovementAmount('');
    setMovementReason('');
    setMovementModalOpen(true);
  };

  const handleSaveMovement = async () => {
    const val = parseFloat(movementAmount.replace(',', '.'));
    if (!val || val <= 0) {
      addToast('Informe um valor válido maior que zero.', 'error');
      return;
    }
    if (!movementReason.trim()) {
      addToast('Informe o motivo ou descrição da movimentação.', 'error');
      return;
    }

    try {
      if (movementType === 'sangria') {
        if (onSangria) {
          await onSangria(val, movementReason);
        } else {
          addToast(`Sangria de ${formatCurrency(val)} registrada com sucesso.`, 'success');
        }
      } else {
        if (onSuprimento) {
          await onSuprimento(val, movementReason);
        } else {
          addToast(`Suprimento de ${formatCurrency(val)} registrado com sucesso.`, 'success');
        }
      }
      setMovementModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao registrar movimentação:', err);
      addToast(err?.message || 'Erro ao registrar movimentação.', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full min-w-0 max-w-full box-border">
      {/* ─── 1. STATUS DO CAIXA DO DIA ─── */}
      <div
        className={`bg-bg-secondary border rounded-lg p-[1.15rem] flex flex-col gap-3.5 shadow-sm ${activeSession ? 'border-[rgba(14,159,110,0.3)]' : 'border-[rgba(240,82,82,0.25)]'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
            <span
              className={`w-2 h-2 rounded-full ${
                activeSession
                  ? 'bg-success shadow-[0_0_8px_var(--color-success)]'
                  : 'bg-error'
              }`}
            />
            <span>{activeSession ? 'Caixa aberto' : 'Caixa fechado'}</span>
          </div>

          {activeSession && (
            <span className="flex items-center gap-[0.35rem] text-xs text-text-secondary">
              <HugeiconsIcon icon={Clock01Icon} size={14} />
              {formatDate(activeSession.opened_at)}
            </span>
          )}
        </div>

        <div>
          {activeSession ? (
            <div className="flex items-center justify-between bg-bg-primary p-3 rounded-md border border-border">
              <div>
                <span className="text-[0.6875rem] text-text-secondary uppercase block">Troco inicial</span>
                <span className="text-base font-bold text-text-primary">
                  {formatCurrency(initialAmount)}
                </span>
              </div>
              <div>
                <span className="text-[0.6875rem] text-text-secondary uppercase block">Entradas no turno</span>
                <span className="text-base font-bold text-success">
                  +{formatCurrency(turnSummary?.total || 0)}
                </span>
              </div>
              {activeSessionCashReceipts > 0 && (
                <div>
                  <span className="text-[0.6875rem] text-text-secondary uppercase block">Dinheiro espécie</span>
                  <span className="text-base font-bold text-success">
                    +{formatCurrency(activeSessionCashReceipts)}
                  </span>
                </div>
              )}
              {suprimentosTotal > 0 && (
                <div>
                  <span className="text-[0.6875rem] text-text-secondary uppercase block">Suprimentos</span>
                  <span className="text-base font-bold text-success">
                    +{formatCurrency(suprimentosTotal)}
                  </span>
                </div>
              )}
              {sangriasTotal > 0 && (
                <div>
                  <span className="text-[0.6875rem] text-text-secondary uppercase block">Sangrias</span>
                  <span className="text-base font-bold text-error">
                    -{formatCurrency(sangriasTotal)}
                  </span>
                </div>
              )}
              {repassesComissaoTotal > 0 && (
                <div>
                  <span className="text-[0.6875rem] text-text-secondary uppercase block">Repasses de comissão</span>
                  <span className="text-base font-bold text-error">
                    -{formatCurrency(repassesComissaoTotal)}
                  </span>
                </div>
              )}
              {valesTotal > 0 && (
                <div>
                  <span className="text-[0.6875rem] text-text-secondary uppercase block">Vales</span>
                  <span className="text-base font-bold text-error">
                    -{formatCurrency(valesTotal)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[0.8125rem] text-text-secondary m-0">
              Inicie o turno para liberar o recebimento de comandas em dinheiro e pagamentos.
            </p>
          )}
        </div>

        <div>
          {activeSession ? (
            <div className="flex flex-col gap-2 w-full">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="flex items-center justify-center gap-[0.35rem] py-[0.65rem] px-2 min-h-11 rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] touch-manipulation bg-[rgba(14,159,110,0.12)] border border-[rgba(14,159,110,0.25)] text-success"
                  onClick={() => handleOpenMovement('suprimento')}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} size={15} />
                  <span>+ Suprimento (entrada)</span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-[0.35rem] py-[0.65rem] px-2 min-h-11 rounded-md text-xs font-semibold cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] touch-manipulation bg-[rgba(240,82,82,0.12)] border border-[rgba(240,82,82,0.25)] text-error"
                  onClick={() => handleOpenMovement('sangria')}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} size={15} />
                  <span>- Sangria (retirada)</span>
                </button>
              </div>

              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-md text-sm font-bold border cursor-pointer min-h-12 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] bg-[rgba(240,82,82,0.15)] text-error border-[rgba(240,82,82,0.3)]"
                onClick={onOpenFechamento}
              >
                <LockIcon size={16} />
                <span>Fechar caixa do turno</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-md text-sm font-bold border-none cursor-pointer min-h-12 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] bg-brand-primary text-brand-lightest"
              onClick={onOpenAbertura}
            >
              <HugeiconsIcon icon={PlusSignIcon} size={18} />
              <span>Abrir caixa do turno</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. RESUMO DOS VALORES DO DIA (4 CARDS) ─── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-secondary border border-border rounded-lg p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[0.6875rem] text-text-secondary uppercase">Faturamento total</span>
          <span className="text-lg font-extrabold text-brand-primary">
            {formatCurrency(totalRevenue)}
          </span>
        </div>

        <div className="bg-bg-secondary border border-border rounded-lg p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[0.6875rem] text-text-secondary uppercase">Dinheiro em gaveta</span>
          <span className="text-lg font-extrabold text-text-primary">
            {totalCashInDrawer === undefined ? 'indisponível' : formatCurrency(totalCashInDrawer)}
          </span>
        </div>

        <div className="bg-bg-secondary border border-border rounded-lg p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[0.6875rem] text-text-secondary uppercase">Recebimentos Pix</span>
          <span className="text-lg font-extrabold text-info">
            {formatCurrency(pixTotal)}
          </span>
        </div>

        <div className="bg-bg-secondary border border-border rounded-lg p-3.5 flex flex-col gap-1 shadow-sm">
          <span className="text-[0.6875rem] text-text-secondary uppercase">Cartão de crédito e débito</span>
          <span className="text-lg font-extrabold text-text-primary">
            {formatCurrency(cardTotal)}
          </span>
        </div>
      </div>

      {/* ─── 3. RESUMO FINANCEIRO POR DIA ─── */}
      <section
        className="flex flex-col gap-3 p-4 bg-bg-secondary border border-border rounded-lg shadow-sm min-w-0 max-w-full box-border"
        aria-labelledby="mobile-daily-summary-title"
      >
        <div>
          <div>
            <h3 id="mobile-daily-summary-title" className="m-0 text-base text-text-primary">Resumo por dia</h3>
            <p className="mt-1 mb-0 text-xs text-text-secondary">Faturamento realizado separado das entradas no caixa.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 min-w-0 max-w-full box-border">
          <label className="flex flex-col gap-1 min-w-0 text-[0.6875rem] font-bold text-text-secondary max-w-full box-border">
            <span>De</span>
            <input
              aria-label="Data inicial do resumo diário"
              type="date"
              value={dailyStartDate}
              onChange={(event) => onDailyStartDateChange?.(event.target.value)}
              className="w-full min-w-0 max-w-full min-h-10 p-[0.45rem] border border-border rounded-md bg-bg-primary text-text-primary font-base text-xs font-semibold box-border"
            />
          </label>
          <label className="flex flex-col gap-1 min-w-0 text-[0.6875rem] font-bold text-text-secondary max-w-full box-border">
            <span>Até</span>
            <input
              aria-label="Data final do resumo diário"
              type="date"
              value={dailyEndDate}
              onChange={(event) => onDailyEndDateChange?.(event.target.value)}
              className="w-full min-w-0 max-w-full min-h-10 p-[0.45rem] border border-border rounded-md bg-bg-primary text-text-primary font-base text-xs font-semibold box-border"
            />
          </label>
          <label className="flex flex-col gap-1 min-w-0 text-[0.6875rem] font-bold text-text-secondary max-w-full box-border col-span-full">
            <span>Sessão</span>
            <select
              aria-label="Sessão do resumo diário"
              value={selectedDailySessionId || ''}
              onChange={(event) => onDailySessionChange?.(event.target.value)}
              className="w-full min-w-0 max-w-full min-h-10 p-[0.45rem] border border-border rounded-md bg-bg-primary text-text-primary font-base text-xs font-semibold box-border"
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

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-[0.2rem] p-[0.7rem] rounded-md bg-bg-primary border border-border">
            <span className="text-[0.6875rem] text-text-secondary">Faturamento realizado</span>
            <strong className="text-base text-brand-primary [font-variant-numeric:tabular-nums]">{formatCurrency(dailyTotals.realized)}</strong>
          </div>
          <div className="flex flex-col gap-[0.2rem] p-[0.7rem] rounded-md bg-bg-primary border border-border">
            <span className="text-[0.6875rem] text-text-secondary">Entradas no caixa</span>
            <strong className="text-base text-success [font-variant-numeric:tabular-nums]">{formatCurrency(dailyTotals.received)}</strong>
          </div>
        </div>

        {dailySummaryLoading ? (
          <div className="p-3 text-center text-xs text-text-secondary" role="status">Carregando resumo por dia...</div>
        ) : dailySummaryError ? (
          <div className="p-3 text-center text-xs text-error" role="alert">{dailySummaryError}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {dailySummary.map((summary) => (
              <div className="flex flex-col gap-[0.45rem] p-[0.7rem] border border-border rounded-md bg-bg-primary" key={summary.date}>
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-text-primary text-[0.8125rem]">{formatDailyDate(summary.date)}</strong>
                  <span className="text-text-secondary text-[0.6875rem]">{summary.closed_comandas_count} comanda(s)</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-secondary text-[0.6875rem]">Faturado <b className="text-text-primary [font-variant-numeric:tabular-nums]">{formatCurrency(summary.realized_revenue)}</b></span>
                  <span className="text-text-secondary text-[0.6875rem]">Recebido <b className="text-text-primary [font-variant-numeric:tabular-nums]">{formatCurrency(summary.received_total)}</b></span>
                </div>
                <div className="flex items-center flex-wrap justify-start gap-2 pt-[0.35rem] border-t border-border">
                  <span className="text-text-secondary text-[0.6875rem]">Dinheiro {formatCurrency(summary.by_method.dinheiro)}</span>
                  <span className="text-text-secondary text-[0.6875rem]">PIX {formatCurrency(summary.by_method.pix)}</span>
                  <span className="text-text-secondary text-[0.6875rem]">Cartão {formatCurrency(summary.by_method.cartao)}</span>
                  <span className="text-text-secondary text-[0.6875rem]">Outros {formatCurrency(summary.by_method.outros)}</span>
                </div>
              </div>
            ))}
            {dailySummary.length === 0 && (
              <div className="p-3 text-center text-xs text-text-secondary">Nenhum movimento no período selecionado.</div>
            )}
          </div>
        )}
      </section>

      {/* ─── 4. ÚLTIMOS TURNOS / MOVIMENTAÇÕES ─── */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[0.9375rem] font-bold text-text-primary m-0">Turnos recentes</h3>
        {historySessions.length === 0 ? (
          <div className="p-6 text-center text-[0.8125rem] text-text-secondary bg-bg-secondary rounded-md">
            <span>Nenhum histórico de turno registrado ainda.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {historySessions.slice(0, 5).map((session) => {
              const isCurrentActive = activeSession?.id === session.id;
              const revenue = isCurrentActive
                ? (turnSummary?.total || session.total_revenue || 0)
                : (session.total_revenue || 0);

              return (
                <div key={session.id} className="flex items-center justify-between bg-bg-secondary border border-border rounded-md p-3 shadow-sm text-[0.8125rem]">
                  <div className="flex flex-col gap-[0.15rem]">
                    <span className="font-semibold text-text-primary">
                      {formatDate(session.opened_at)}
                    </span>
                    <span className={`text-[0.6875rem] font-semibold ${session.closed_at ? 'text-text-secondary' : 'text-success'}`}>
                      {session.closed_at ? 'Fechado' : 'Aberto (Em andamento)'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-[0.15rem] text-xs text-text-secondary">
                    <span className="text-[0.8125rem] font-extrabold text-brand-primary">
                      Arrecadado: {formatCurrency(revenue)}
                    </span>
                    <span className="text-[0.6875rem] text-text-secondary">
                      {session.closed_at
                        ? `Gaveta: ${formatCurrency(session.closing_amount ?? 0)}`
                        : `Troco inicial: ${formatCurrency(session.initial_amount)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── MODAL DE SANGRIA / SUPRIMENTO ─── */}
      <MobileBottomSheet
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        title={movementType === 'sangria' ? 'Registrar Sangria (Saída)' : 'Registrar Suprimento (Entrada)'}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-[0.35rem]">
            <label className="text-xs font-semibold text-text-secondary">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              className="bg-bg-primary border border-border rounded-md text-text-primary py-2.5 px-3 text-sm outline-none focus:border-brand-primary"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-[0.35rem]">
            <label className="text-xs font-semibold text-text-secondary">Motivo / Descrição</label>
            <input
              type="text"
              placeholder={movementType === 'sangria' ? 'Ex: Pagamento de Fornecedor, Troco' : 'Ex: Aporte extra de troco'}
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              className="bg-bg-primary border border-border rounded-md text-text-primary py-2.5 px-3 text-sm outline-none focus:border-brand-primary"
            />
          </div>

          <button
            type="button"
            className="bg-brand-primary text-brand-lightest border-none rounded-md py-3 text-sm font-bold cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-brand-hover"
            onClick={handleSaveMovement}
          >
            Confirmar {movementType === 'sangria' ? 'Sangria' : 'Suprimento'}
          </button>
        </div>
      </MobileBottomSheet>
    </div>
  );
};
