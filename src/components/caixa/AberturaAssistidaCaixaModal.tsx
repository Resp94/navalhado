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
              Nenhum caixa aberto para o turno atual
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="caixa-close-btn"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        <div className="caixa-info-alert">
          <HugeiconsIcon icon={InformationCircleIcon} size={18} className="caixa-alert-icon" />
          <p className="caixa-alert-text">
            Informe o valor em dinheiro guardado na gaveta para servir de troco aos primeiros clientes do dia.
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
              Fundo de troco inicial da gaveta *
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
              placeholder="Ex: Turno da manhã, troco em moedas"
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
                  <span>Abrir caixa e liberar agenda</span>
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
          background-color: rgba(20, 17, 15, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          padding: 1rem;
          animation: fadeIn 0.2s cubic-bezier(0.32, 0.72, 0, 1);
        }

        .caixa-modal-shell {
          width: 100%;
          max-width: 440px;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-xl);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          font-family: var(--font-family-base);
          color: var(--color-text-primary);
        }

        .caixa-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--color-border);
        }

        .caixa-header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .caixa-icon-badge {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-lg);
          background-color: var(--color-brand-lightest);
          color: var(--color-brand-primary);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .caixa-modal-title {
          font-size: var(--font-size-lg);
          font-weight: 700;
          color: var(--color-text-primary);
          margin: 0;
        }

        .caixa-modal-subtitle {
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          margin: 0.2rem 0 0 0;
        }

        .caixa-close-btn {
          min-width: 44px;
          min-height: 44px;
          border-radius: var(--radius-full);
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .caixa-close-btn:hover {
          background-color: var(--color-error-bg);
          color: var(--color-error);
        }

        .caixa-info-alert {
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          background-color: var(--color-info-bg);
          border: 1px solid rgba(63, 131, 248, 0.2);
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
        }

        .caixa-alert-icon {
          color: var(--color-info);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .caixa-alert-text {
          font-size: var(--font-size-xs);
          color: var(--color-text-primary);
          line-height: 1.4;
          margin: 0;
        }

        .caixa-error-alert {
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          background-color: var(--color-error-bg);
          border: 1px solid var(--color-error);
          color: var(--color-error);
          font-size: var(--font-size-xs);
          font-weight: 600;
        }

        .caixa-modal-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .caixa-form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .caixa-label {
          font-size: var(--font-size-xs);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-secondary);
        }

        .caixa-input-prefix-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .caixa-input-prefix {
          position: absolute;
          left: 1rem;
          font-size: var(--font-size-lg);
          font-weight: 800;
          color: var(--color-brand-primary);
          pointer-events: none;
        }

        .caixa-input-amount {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 3rem;
          font-size: var(--font-size-xl);
          font-weight: 800;
          color: var(--color-text-primary);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          outline: none;
          transition: all 0.2s ease;
        }

        .caixa-input-amount:focus {
          border-color: var(--color-brand-primary);
          box-shadow: 0 0 0 3px var(--color-brand-lightest);
        }

        .caixa-input-text {
          width: 100%;
          padding: 0.65rem 1rem;
          font-size: var(--font-size-sm);
          color: var(--color-text-primary);
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          outline: none;
          transition: all 0.2s ease;
        }

        .caixa-input-text:focus {
          border-color: var(--color-brand-primary);
        }

        .caixa-actions-footer {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding-top: 0.5rem;
        }

        .caixa-btn-secondary {
          flex: 1;
          padding: 0.65rem 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-border);
          background-color: var(--color-bg-primary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .caixa-btn-secondary:hover {
          background-color: var(--color-border);
        }

        .caixa-btn-primary {
          flex: 1.5;
          padding: 0.65rem 1.25rem;
          border-radius: var(--radius-lg);
          border: none;
          background-color: var(--color-brand-primary);
          color: white;
          font-size: var(--font-size-sm);
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          transition: all 0.2s ease;
        }

        .caixa-btn-primary:hover:not(:disabled) {
          background-color: var(--color-brand-hover);
        }

        .caixa-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
