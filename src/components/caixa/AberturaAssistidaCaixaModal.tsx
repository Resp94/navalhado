import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { CashSession } from '../../modules/caixa/types';
import { formatCurrencyInput, parseCurrencyInput } from '../../lib/currency';

interface AberturaAssistidaCaixaModalProps {
  isOpen: boolean;
  tenantId: string;
  onCaixaAberto: (session: CashSession) => void;
  onClose: () => void;
  caixaRepo?: CaixaRepository;
}

export const AberturaAssistidaCaixaModal: React.FC<AberturaAssistidaCaixaModalProps> = ({
  isOpen,
  tenantId,
  onCaixaAberto,
  onClose,
  caixaRepo,
}) => {
  const [initialAmount, setInitialAmount] = useState<string>('0,00');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const repo = caixaRepo || new CaixaRepository(new SupabaseCaixaAdapter());

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInitialAmount(formatCurrencyInput(e.target.value));
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const valorInicial = parseCurrencyInput(initialAmount);
      const session = await repo.openSession({
        tenant_id: tenantId,
        initial_amount: valorInicial,
        notes: notes.trim() || undefined,
      });

      onCaixaAberto(session);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível abrir a sessão de caixa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="caixa-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-caixa-title"
    >
      <div className="caixa-modal-shell">
        <div className="caixa-modal-header">
          <div>
            <h3 id="modal-caixa-title" className="caixa-modal-title">
              Abertura de caixa do turno
            </h3>
            <p className="caixa-modal-subtitle">
              Inicie os atendimentos com o controle de troco atualizado.
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

        <div className="caixa-info-alert">
          <HugeiconsIcon icon={InformationCircleIcon} size={18} className="caixa-alert-icon" />
          <p className="caixa-alert-text">
            Informe a quantia em dinheiro que está na gaveta para servir de troco aos primeiros clientes.
          </p>
        </div>

        {errorMsg && (
          <div className="caixa-error-alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleConfirm} className="caixa-modal-form">
          <div className="caixa-form-group">
            <label className="caixa-label">
              Valor do troco inicial na gaveta *
            </label>
            <div className="caixa-input-prefix-wrapper">
              <span className="caixa-input-prefix">R$</span>
              <input
                type="text"
                value={initialAmount}
                onChange={handleAmountChange}
                className="caixa-input-amount"
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="caixa-form-group">
            <label className="caixa-label">
              Observações do turno (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Troco separado em moedas e cédulas de pequeno valor..."
              className="caixa-input-text"
            />
          </div>

          <div className="caixa-actions-footer">
            <button
              type="button"
              onClick={onClose}
              className="caixa-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="caixa-btn-primary"
            >
              {isSubmitting ? (
                <span>Abrindo caixa...</span>
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />
                  <span>Confirmar e abrir caixa</span>
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
          background: rgba(20, 17, 15, 0.55);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
          animation: caixaFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .caixa-modal-shell {
          width: 100%;
          max-width: 500px;
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-lg, 1rem);
          box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
          display: flex;
          flex-direction: column;
          font-family: var(--font-family, Outfit, sans-serif);
          color: var(--color-text-primary, #2D231E);
          overflow: hidden;
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
          margin: 0.25rem 0 0 0;
        }

        .caixa-close-btn {
          color: var(--color-text-secondary, #70625B);
          padding: 0.35rem;
          border-radius: var(--radius-sm, 0.375rem);
          border: none;
          background: transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .caixa-close-btn:hover {
          color: var(--color-text-primary, #2D231E);
          background: var(--color-bg-primary, #FFF1E6);
        }

        .caixa-info-alert {
          padding: 0.85rem 1.25rem;
          background-color: var(--color-bg-primary, #FFF1E6);
          border-bottom: 1px solid var(--color-border, #EADED6);
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .caixa-alert-icon {
          color: var(--color-brand-primary, #D96C00);
          flex-shrink: 0;
        }

        .caixa-alert-text {
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
          line-height: 1.4;
          margin: 0;
        }

        .caixa-error-alert {
          margin: 1rem 1.5rem 0 1.5rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md, 0.5rem);
          background-color: rgba(224, 36, 36, 0.1);
          border: 1px solid rgba(224, 36, 36, 0.25);
          color: var(--color-error, #E02424);
          font-size: var(--font-size-xs, 0.8125rem);
          font-weight: 600;
        }

        .caixa-modal-form {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          background: var(--color-bg-secondary, #ffffff);
        }

        .caixa-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .caixa-label {
          font-size: var(--font-size-xs, 0.8125rem);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-primary, #2D231E);
        }

        .caixa-input-prefix-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .caixa-input-prefix {
          position: absolute;
          left: 1.15rem;
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-brand-primary, #D96C00);
          pointer-events: none;
        }

        .caixa-input-amount {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 3.25rem;
          font-size: 1.35rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          background: var(--color-bg-secondary, #ffffff);
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          outline: none;
          transition: all 0.2s ease;
          font-variant-numeric: tabular-nums;
        }

        .caixa-input-amount:focus {
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .caixa-input-text {
          width: 100%;
          padding: 0.65rem 0.85rem;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          outline: none;
          transition: all 0.2s ease;
        }

        .caixa-input-text:focus {
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }

        .caixa-actions-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border, #EADED6);
        }

        .caixa-btn-secondary {
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          border: 1px solid var(--color-border, #EADED6);
          background: var(--color-bg-primary, #FFF1E6);
          color: var(--color-text-primary, #2D231E);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .caixa-btn-secondary:hover {
          border-color: var(--color-brand-primary, #D96C00);
          color: var(--color-brand-primary, #D96C00);
        }

        .caixa-btn-primary {
          padding: 0.65rem 1.35rem;
          border-radius: var(--radius-md, 0.5rem);
          border: none;
          background: var(--color-brand-primary, #D96C00);
          color: #FFF1E6;
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .caixa-btn-primary:hover:not(:disabled) {
          background: var(--color-brand-hover, #9C3F00);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(217, 108, 0, 0.25);
        }

        .caixa-btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
