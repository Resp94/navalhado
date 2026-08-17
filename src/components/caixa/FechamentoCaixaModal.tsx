import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';
import { supabase } from '../../lib/supabase';
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { CashSession } from '../../modules/caixa/types';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../../lib/currency';

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
    setClosingAmount(formatCurrencyInput(e.target.value));
  };

  const countedAmount = parseCurrencyInput(closingAmount);
  const difference = countedAmount - expectedAmount;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id || null;

      const closedSession = await repo.closeSession({
        session_id: session.id,
        closed_by: currentUserId,
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
              Conte o dinheiro físico da gaveta para validar o fechamento do turno com segurança.
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
            <span className="caixa-breakdown-val font-bold caixa-val-highlight">
              {formatCurrency(expectedAmount)}
            </span>
          </div>
        </div>

        <form onSubmit={handleConfirm} className="caixa-modal-body">
          <div className="caixa-field-group">
            <label htmlFor="closing-amount-input" className="caixa-label">
              Valor total em dinheiro contado na gaveta *
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

          <div
            className={`caixa-conferencia-badge ${
              Math.abs(difference) < 0.01
                ? 'exact'
                : difference > 0
                ? 'surplus'
                : 'shortage'
            }`}
          >
            <span className="caixa-conferencia-icon">
              <HugeiconsIcon
                icon={
                  Math.abs(difference) < 0.01
                    ? CheckmarkCircle02Icon
                    : AlertCircleIcon
                }
                size={18}
              />
            </span>
            <span className="caixa-conferencia-text">
              {Math.abs(difference) < 0.01
                ? 'Conferência exata. O valor contado bate perfeitamente com o esperado.'
                : difference > 0
                ? `Sobra de caixa identificada (+${formatCurrency(difference)}). O valor físico é maior que o registrado.`
                : `Divergência de caixa identificada (${formatCurrency(difference)}). O valor físico é menor que o esperado.`}
            </span>
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
              placeholder="Ex: Sobra referente a gorjeta ou arredondamento de troco..."
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
              className="caixa-submit-action-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Encerrando turno...'
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />
                  <span>Encerrar turno e fechar caixa</span>
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
          background: rgba(20, 17, 15, 0.55);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .caixa-modal-shell {
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-lg, 1rem);
          width: 100%;
          max-width: 500px;
          box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
          overflow: hidden;
          animation: caixaFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes caixaFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .caixa-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #EADED6);
          background: var(--color-bg-secondary, #ffffff);
        }
        .caixa-modal-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .caixa-modal-subtitle {
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
          margin-top: 0.25rem;
          line-height: 1.4;
        }
        .caixa-close-btn {
          color: var(--color-text-secondary, #70625B);
          padding: 0.35rem;
          border-radius: var(--radius-sm, 0.375rem);
          transition: all 0.2s ease;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .caixa-close-btn:hover {
          color: var(--color-text-primary, #2D231E);
          background: var(--color-bg-primary, #FFF1E6);
        }
        .caixa-breakdown-summary {
          background: var(--color-bg-primary, #FFF1E6);
          border-bottom: 1px solid var(--color-border, #EADED6);
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .caixa-breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-xs, 0.8125rem);
        }
        .caixa-breakdown-label {
          color: var(--color-text-secondary, #70625B);
          font-weight: 600;
        }
        .caixa-breakdown-val {
          color: var(--color-text-primary, #2D231E);
          font-variant-numeric: tabular-nums;
          font-weight: 700;
        }
        .caixa-val-highlight {
          color: var(--color-brand-primary, #D96C00);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 800;
        }
        .caixa-breakdown-item.expected {
          border-top: 1px dashed var(--color-border, #EADED6);
          padding-top: 0.5rem;
          margin-top: 0.25rem;
        }
        .caixa-modal-body {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          background: var(--color-bg-secondary, #ffffff);
        }
        .caixa-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .caixa-label {
          font-size: var(--font-size-xs, 0.8125rem);
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .caixa-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .caixa-input-prefix {
          position: absolute;
          left: 1.15rem;
          color: var(--color-brand-primary, #D96C00);
          font-weight: 800;
          font-size: 1.125rem;
        }
        .caixa-input {
          width: 100%;
          background: var(--color-bg-secondary, #ffffff);
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.75rem 1rem 0.75rem 3.25rem;
          color: var(--color-text-primary, #2D231E);
          font-size: 1.35rem;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          outline: none;
          transition: all 0.2s ease;
        }
        .caixa-input:focus {
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }
        .caixa-conferencia-badge {
          padding: 0.85rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }
        .caixa-conferencia-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .caixa-conferencia-text {
          font-size: var(--font-size-xs, 0.8125rem);
          font-weight: 700;
          line-height: 1.35;
        }
        .caixa-conferencia-badge.exact {
          background: var(--color-success-bg, rgba(14, 159, 110, 0.1));
          border: 1px solid rgba(14, 159, 110, 0.3);
          color: var(--color-success, #0E9F6E);
        }
        .caixa-conferencia-badge.surplus {
          background: rgba(63, 131, 248, 0.1);
          border: 1px solid rgba(63, 131, 248, 0.3);
          color: var(--color-info, #3F83F8);
        }
        .caixa-conferencia-badge.shortage {
          background: rgba(240, 82, 82, 0.1);
          border: 1px solid rgba(240, 82, 82, 0.3);
          color: var(--color-error, #F05252);
        }
        .caixa-textarea {
          width: 100%;
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.65rem 0.85rem;
          color: var(--color-text-primary, #2D231E);
          font-size: var(--font-size-sm, 0.875rem);
          outline: none;
          resize: none;
          transition: all 0.2s ease;
        }
        .caixa-textarea:focus {
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }
        .caixa-error-banner {
          background: rgba(240, 82, 82, 0.1);
          border: 1px solid rgba(240, 82, 82, 0.25);
          color: var(--color-error, #F05252);
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: var(--font-size-xs, 0.8125rem);
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
          padding-top: 1rem;
          border-top: 1px solid var(--color-border, #EADED6);
        }
        .caixa-cancel-action-btn {
          padding: 0.65rem 1.25rem;
          color: var(--color-text-primary, #2D231E);
          background: var(--color-bg-primary, #FFF1E6);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .caixa-cancel-action-btn:hover:not(:disabled) {
          border-color: var(--color-brand-primary, #D96C00);
          color: var(--color-brand-primary, #D96C00);
        }
        .caixa-submit-action-btn {
          padding: 0.65rem 1.35rem;
          color: #ffffff;
          background: var(--color-error, #F05252);
          border: none;
          border-radius: var(--radius-md, 0.5rem);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .caixa-submit-action-btn:hover:not(:disabled) {
          background: #D83A3A;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(240, 82, 82, 0.25);
        }
        .caixa-submit-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
