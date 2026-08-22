import React, { useState } from 'react';
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
import type { CashSession, TurnPaymentsSummary } from '../../../modules/caixa/types';
import type { FinancialMetrics } from '../Financeiro';

interface MobileCaixaViewProps {
  activeSession: CashSession | null;
  activeSessionCashReceipts: number;
  turnSummary?: TurnPaymentsSummary;
  suprimentosTotal?: number;
  sangriasTotal?: number;
  metrics: FinancialMetrics | null;
  historySessions: CashSession[];
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
  metrics,
  historySessions,
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
  const totalCashInDrawer = initialAmount + activeSessionCashReceipts + suprimentosTotal - sangriasTotal;

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
    <div className="mobile-caixa">
      {/* ─── 1. STATUS DO CAIXA DO DIA ─── */}
      <div className={`mobile-caixa__status-card ${activeSession ? 'status--open' : 'status--closed'}`}>
        <div className="mobile-caixa__status-header">
          <div className="mobile-caixa__status-badge">
            <span className="mobile-caixa__status-dot" />
            <span>{activeSession ? 'Caixa aberto' : 'Caixa fechado'}</span>
          </div>

          {activeSession && (
            <span className="mobile-caixa__opened-time">
              <HugeiconsIcon icon={Clock01Icon} size={14} />
              {formatDate(activeSession.opened_at)}
            </span>
          )}
        </div>

        <div className="mobile-caixa__status-body">
          {activeSession ? (
            <div className="mobile-caixa__amount-row">
              <div>
                <span className="mobile-caixa__amount-label">Troco inicial</span>
                <span className="mobile-caixa__amount-val">
                  {formatCurrency(initialAmount)}
                </span>
              </div>
              <div>
                <span className="mobile-caixa__amount-label">Entradas no turno</span>
                <span className="mobile-caixa__amount-val text-success">
                  +{formatCurrency(turnSummary?.total || 0)}
                </span>
              </div>
              {activeSessionCashReceipts > 0 && (
                <div>
                  <span className="mobile-caixa__amount-label">Dinheiro espécie</span>
                  <span className="mobile-caixa__amount-val text-success">
                    +{formatCurrency(activeSessionCashReceipts)}
                  </span>
                </div>
              )}
              {suprimentosTotal > 0 && (
                <div>
                  <span className="mobile-caixa__amount-label">Suprimentos</span>
                  <span className="mobile-caixa__amount-val text-success">
                    +{formatCurrency(suprimentosTotal)}
                  </span>
                </div>
              )}
              {sangriasTotal > 0 && (
                <div>
                  <span className="mobile-caixa__amount-label">Sangrias</span>
                  <span className="mobile-caixa__amount-val text-danger">
                    -{formatCurrency(sangriasTotal)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="mobile-caixa__closed-msg">
              Inicie o turno para liberar o recebimento de comandas em dinheiro e pagamentos.
            </p>
          )}
        </div>

        <div className="mobile-caixa__status-footer">
          {activeSession ? (
            <div className="mobile-caixa__actions-wrapper">
              <div className="mobile-caixa__quick-movements">
                <button
                  type="button"
                  className="mobile-caixa__movement-btn btn--suprimento"
                  onClick={() => handleOpenMovement('suprimento')}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} size={15} />
                  <span>+ Suprimento (entrada)</span>
                </button>
                <button
                  type="button"
                  className="mobile-caixa__movement-btn btn--sangria"
                  onClick={() => handleOpenMovement('sangria')}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} size={15} />
                  <span>- Sangria (retirada)</span>
                </button>
              </div>

              <button
                type="button"
                className="mobile-caixa__btn-action btn--close-caixa"
                onClick={onOpenFechamento}
              >
                <LockIcon size={16} />
                <span>Fechar caixa do turno</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mobile-caixa__btn-action btn--open-caixa"
              onClick={onOpenAbertura}
            >
              <HugeiconsIcon icon={PlusSignIcon} size={18} />
              <span>Abrir caixa do turno</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. RESUMO DOS VALORES DO DIA (4 CARDS) ─── */}
      <div className="mobile-caixa__cards-grid">
        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Faturamento total</span>
          <span className="mobile-caixa__kpi-val text-primary">
            {formatCurrency(totalRevenue)}
          </span>
        </div>

        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Dinheiro em gaveta</span>
          <span className="mobile-caixa__kpi-val">
            {formatCurrency(totalCashInDrawer)}
          </span>
        </div>

        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Recebimentos Pix</span>
          <span className="mobile-caixa__kpi-val text-info">
            {formatCurrency(pixTotal)}
          </span>
        </div>

        <div className="mobile-caixa__kpi-card">
          <span className="mobile-caixa__kpi-label">Cartão de crédito e débito</span>
          <span className="mobile-caixa__kpi-val">
            {formatCurrency(cardTotal)}
          </span>
        </div>
      </div>

      {/* ─── 4. ÚLTIMOS TURNOS / MOVIMENTAÇÕES ─── */}
      <div className="mobile-caixa__history">
        <h3 className="mobile-caixa__history-title">Turnos recentes</h3>
        {historySessions.length === 0 ? (
          <div className="mobile-caixa__history-empty">
            <span>Nenhum histórico de turno registrado ainda.</span>
          </div>
        ) : (
          <div className="mobile-caixa__history-list">
            {historySessions.slice(0, 5).map((session) => {
              const isCurrentActive = activeSession?.id === session.id;
              const revenue = isCurrentActive
                ? (turnSummary?.total || session.total_revenue || 0)
                : (session.total_revenue || 0);

              return (
                <div key={session.id} className="mobile-caixa__history-item">
                  <div className="mobile-caixa__history-info">
                    <span className="mobile-caixa__history-date">
                      {formatDate(session.opened_at)}
                    </span>
                    <span className={`mobile-caixa__history-status ${session.closed_at ? 'status--closed' : 'status--open'}`}>
                      {session.closed_at ? 'Fechado' : 'Aberto (Em andamento)'}
                    </span>
                  </div>
                  <div className="mobile-caixa__history-amounts">
                    <span className="mobile-caixa__history-revenue">
                      Arrecadado: {formatCurrency(revenue)}
                    </span>
                    <span className="mobile-caixa__history-drawer">
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
        <div className="mobile-caixa__movement-form">
          <div className="form-group">
            <label className="form-label">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Motivo / Descrição</label>
            <input
              type="text"
              placeholder={movementType === 'sangria' ? 'Ex: Pagamento de Fornecedor, Troco' : 'Ex: Aporte extra de troco'}
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              className="form-input"
            />
          </div>

          <button
            type="button"
            className="mobile-caixa__btn-submit"
            onClick={handleSaveMovement}
          >
            Confirmar {movementType === 'sangria' ? 'Sangria' : 'Suprimento'}
          </button>
        </div>
      </MobileBottomSheet>

      <style>{`
        .mobile-caixa {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          width: 100%;
        }

        .mobile-caixa__status-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          box-shadow: var(--shadow-sm, 0 4px 12px rgba(0, 0, 0, 0.2));
        }

        .mobile-caixa__status-card.status--open {
          border-color: rgba(14, 159, 110, 0.3);
        }

        .mobile-caixa__status-card.status--closed {
          border-color: rgba(240, 82, 82, 0.25);
        }

        .mobile-caixa__status-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mobile-caixa__status-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .status--open .mobile-caixa__status-dot {
          width: 8px;
          height: 8px;
          border-radius: var(--radius-full, 50%);
          background: var(--color-success);
          box-shadow: 0 0 8px var(--color-success);
        }

        .status--closed .mobile-caixa__status-dot {
          width: 8px;
          height: 8px;
          border-radius: var(--radius-full, 50%);
          background: var(--color-error);
        }

        .mobile-caixa__opened-time {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .mobile-caixa__amount-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-bg-primary);
          padding: 0.75rem;
          border-radius: var(--radius-md, 10px);
          border: 1px solid var(--color-border);
        }

        .mobile-caixa__amount-label {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          display: block;
        }

        .mobile-caixa__amount-val {
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .text-success { color: var(--color-success) !important; }
        .text-primary { color: var(--color-brand-primary) !important; }
        .text-info { color: var(--color-info) !important; }

        .mobile-caixa__closed-msg {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .mobile-caixa__actions-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        .mobile-caixa__quick-movements {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .mobile-caixa__movement-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          padding: 0.65rem 0.5rem;
          min-height: 44px;
          border-radius: var(--radius-md, 8px);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          touch-action: manipulation;
        }

        .btn--suprimento {
          background: rgba(14, 159, 110, 0.12);
          border: 1px solid rgba(14, 159, 110, 0.25);
          color: var(--color-success);
        }

        .btn--sangria {
          background: rgba(240, 82, 82, 0.12);
          border: 1px solid rgba(240, 82, 82, 0.25);
          color: var(--color-error);
        }

        .mobile-caixa__btn-action {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem;
          border-radius: var(--radius-md, 10px);
          font-size: 0.875rem;
          font-weight: 700;
          border: none;
          cursor: pointer;
          min-height: 48px;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .btn--open-caixa {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
        }

        .btn--close-caixa {
          background: rgba(240, 82, 82, 0.15);
          color: var(--color-error);
          border: 1px solid rgba(240, 82, 82, 0.3);
        }

        .mobile-caixa__cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .mobile-caixa__kpi-card {
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg, 12px);
          padding: 0.875rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
        }

        .mobile-caixa__kpi-label {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
        }

        .mobile-caixa__kpi-val {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary);
        }

        .mobile-caixa__desktop-notice {
          display: flex;
          gap: 0.75rem;
          background: rgba(217, 108, 0, 0.08);
          border: 1px dashed rgba(217, 108, 0, 0.3);
          border-radius: var(--radius-lg, 12px);
          padding: 0.875rem;
          align-items: flex-start;
        }

        .mobile-caixa__notice-icon {
          color: var(--color-brand-primary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .mobile-caixa__notice-title {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-brand-primary);
          margin: 0 0 0.15rem;
        }

        .mobile-caixa__notice-desc {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          margin: 0;
          line-height: 1.4;
        }

        .mobile-caixa__history {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mobile-caixa__history-title {
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .mobile-caixa__history-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .mobile-caixa__history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 10px);
          padding: 0.75rem;
          box-shadow: var(--shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.05));
          font-size: 0.8125rem;
        }

        .mobile-caixa__history-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .mobile-caixa__history-date {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .mobile-caixa__history-status {
          font-size: 0.6875rem;
          font-weight: 600;
        }

        .mobile-caixa__history-status.status--open {
          color: var(--color-success, #0E9F6E);
        }

        .mobile-caixa__history-status.status--closed {
          color: var(--color-text-secondary, #70625B);
        }

        .mobile-caixa__history-amounts {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.15rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .mobile-caixa__history-revenue {
          font-size: 0.8125rem;
          font-weight: 800;
          color: var(--color-brand-primary, #D96C00);
        }

        .mobile-caixa__history-drawer {
          font-size: 0.6875rem;
          color: var(--color-text-secondary, #70625B);
        }

        .mobile-caixa__history-empty {
          padding: 1.5rem;
          text-align: center;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md, 10px);
        }

        .mobile-caixa__movement-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .form-input {
          background: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md, 8px);
          color: var(--color-text-primary);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }

        .form-input:focus {
          border-color: var(--color-brand-primary);
        }

        .mobile-caixa__btn-submit {
          background: var(--color-brand-primary);
          color: var(--color-brand-lightest);
          border: none;
          border-radius: var(--radius-md, 8px);
          padding: 0.75rem;
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .mobile-caixa__btn-submit:hover {
          background: var(--color-brand-hover);
        }
      `}</style>
    </div>
  );
};
