import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
  Coins01Icon,
} from '@hugeicons/core-free-icons';
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { CashSession } from '../../modules/caixa/types';

interface FechamentoCaixaModalProps {
  isOpen: boolean;
  session: CashSession | null;
  cashReceipts?: number; // Total de recebimentos em dinheiro apurados no turno
  onCaixaFechado: (closedSession: CashSession) => void;
  onClose: () => void;
  caixaRepo?: CaixaRepository;
}

export const FechamentoCaixaModal: React.FC<FechamentoCaixaModalProps> = ({
  isOpen,
  session,
  cashReceipts = 0,
  onCaixaFechado,
  onClose,
  caixaRepo,
}) => {
  const [closingAmount, setClosingAmount] = useState<string>('0,00');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const repo = caixaRepo || new CaixaRepository(new SupabaseCaixaAdapter());

  const initialAmount = Number(session.initial_amount) || 0;
  const expectedAmount = initialAmount + cashReceipts;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const num = parseInt(raw || '0', 10) / 100;
    setClosingAmount(
      num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  };

  const parseAmount = (val: string): number => {
    return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const countedAmount = parseAmount(closingAmount);
  const difference = countedAmount - expectedAmount;

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const closedSession = await repo.closeSession({
        session_id: session.id,
        closing_amount: countedAmount,
        notes: notes.trim() || undefined,
      });

      onCaixaFechado(closedSession);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível fechar a sessão de caixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="caixa-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-fechamento-caixa-title"
    >
      <div className="caixa-modal-shell">
        <div className="caixa-modal-header">
          <div>
            <h3 id="modal-fechamento-caixa-title" className="caixa-modal-title">
              Fechamento e conferência de caixa
            </h3>
            <p className="caixa-modal-subtitle">
              Conferência física do dinheiro em gaveta do turno
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="caixa-close-btn"
            aria-label="Fechar modal"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        <div className="caixa-breakdown-summary">
          <div className="caixa-breakdown-item">
            <span className="caixa-breakdown-label">Fundo de troco inicial:</span>
            <span className="caixa-breakdown-val">{formatCurrency(initialAmount)}</span>
          </div>
          <div className="caixa-breakdown-item">
            <span className="caixa-breakdown-label">Entradas em dinheiro no turno:</span>
            <span className="caixa-breakdown-val">{formatCurrency(cashReceipts)}</span>
          </div>
          <div className="caixa-breakdown-item expected">
            <span className="caixa-breakdown-label font-bold">Total em dinheiro esperado:</span>
            <span className="caixa-breakdown-val font-bold text-amber-500">
              {formatCurrency(expectedAmount)}
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="caixa-modal-body">
          <div className="caixa-field-group">
            <label htmlFor="closing-amount-input" className="caixa-label">
              Valor contado na gaveta física (R$) *
            </label>
            <div className="caixa-input-container">
              <span className="caixa-input-prefix">R$</span>
              <input
                id="closing-amount-input"
                type="text"
                className="caixa-input"
                value={closingAmount}
                onChange={handleAmountChange}
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Destaque de Divergência / Conferência */}
          <div
            className={`caixa-conferencia-badge ${
              Math.abs(difference) < 0.01
                ? 'exact'
                : difference > 0
                ? 'surplus'
                : 'shortage'
            }`}
          >
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={
                  Math.abs(difference) < 0.01
                    ? CheckmarkCircle02Icon
                    : AlertCircleIcon
                }
                size={18}
              />
              <span className="font-medium text-sm">
                {Math.abs(difference) < 0.01
                  ? 'Caixa exato (sem divergência)'
                  : difference > 0
                  ? `Sobra de caixa: +${formatCurrency(difference)}`
                  : `Quebra de caixa: ${formatCurrency(difference)}`}
              </span>
            </div>
            <p className="text-xs mt-1 text-slate-400">
              {Math.abs(difference) < 0.01
                ? 'O valor físico bate exatamente com os lançamentos do sistema.'
                : difference > 0
                ? 'Há mais dinheiro na gaveta do que o registrado nas comandas.'
                : 'Há menos dinheiro na gaveta física do que o apurado pelo sistema.'}
            </p>
          </div>

          <div className="caixa-field-group">
            <label htmlFor="fechamento-notes-input" className="caixa-label">
              Observações do fechamento (opcional)
            </label>
            <textarea
              id="fechamento-notes-input"
              className="caixa-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Justificativa de troco ou divergência..."
            />
          </div>

          {errorMsg && (
            <div className="caixa-error-banner" role="alert">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="caixa-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="caixa-cancel-action-btn"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="caixa-submit-action-btn bg-red-600 hover:bg-red-500"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Encerrando turno...'
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />
                  <span>Confirmar fechamento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .caixa-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .caixa-modal-shell {
          background: #18181b;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1rem;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: caixaFadeIn 0.15s ease-out;
        }
        @keyframes caixaFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .caixa-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .caixa-modal-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #f4f4f5;
        }
        .caixa-modal-subtitle {
          font-size: 0.8125rem;
          color: #a1a1aa;
          margin-top: 0.125rem;
        }
        .caixa-close-btn {
          color: #71717a;
          padding: 0.25rem;
          border-radius: 0.375rem;
          transition: all 0.15s ease;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .caixa-close-btn:hover {
          color: #f4f4f5;
          background: rgba(255, 255, 255, 0.05);
        }
        .caixa-breakdown-summary {
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0.875rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .caixa-breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8125rem;
        }
        .caixa-breakdown-label {
          color: #a1a1aa;
        }
        .caixa-breakdown-val {
          color: #e4e4e7;
          font-variant-numeric: tabular-nums;
        }
        .caixa-breakdown-item.expected {
          border-top: 1px dashed rgba(255, 255, 255, 0.1);
          padding-top: 0.375rem;
          margin-top: 0.25rem;
        }
        .caixa-modal-body {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .caixa-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .caixa-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: #e4e4e7;
        }
        .caixa-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .caixa-input-prefix {
          position: absolute;
          left: 1rem;
          color: #71717a;
          font-weight: 500;
          font-size: 1.125rem;
        }
        .caixa-input {
          width: 100%;
          background: #09090b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem 0.75rem 3rem;
          color: #f4f4f5;
          font-size: 1.25rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .caixa-input:focus {
          border-color: #f59e0b;
        }
        .caixa-conferencia-badge {
          padding: 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid transparent;
        }
        .caixa-conferencia-badge.exact {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.25);
          color: #34d399;
        }
        .caixa-conferencia-badge.surplus {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.25);
          color: #60a5fa;
        }
        .caixa-conferencia-badge.shortage {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.25);
          color: #f87171;
        }
        .caixa-textarea {
          width: 100%;
          background: #09090b;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          color: #f4f4f5;
          font-size: 0.875rem;
          outline: none;
          resize: none;
          transition: border-color 0.15s ease;
        }
        .caixa-textarea:focus {
          border-color: #f59e0b;
        }
        .caixa-error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #f87171;
          padding: 0.625rem 0.875rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .caixa-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }
        .caixa-cancel-action-btn {
          padding: 0.625rem 1rem;
          color: #a1a1aa;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .caixa-cancel-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: #f4f4f5;
        }
        .caixa-submit-action-btn {
          padding: 0.625rem 1.25rem;
          color: #ffffff;
          border: none;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.15s ease;
        }
        .caixa-submit-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
