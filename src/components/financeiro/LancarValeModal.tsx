import React, { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../../lib/currency';
import type { PaymentMethod } from '../../modules/caixa/types';
import { ContaProfissionalRepository } from '../../modules/contaProfissional/ContaProfissionalRepository';
import { SupabaseContaProfissionalAdapter } from '../../modules/contaProfissional/adapters/SupabaseContaProfissionalAdapter';
import type { ProfessionalAccountEntry } from '../../modules/contaProfissional/types';

const contaProfissionalRepository = new ContaProfissionalRepository(new SupabaseContaProfissionalAdapter());

interface LancarValeModalProps {
  isOpen: boolean;
  professional: { id: string; name: string } | null;
  tenantId?: string;
  /** ID da sessão de caixa aberta no turno atual, se houver. */
  activeCashSessionId?: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

/**
 * Lançamento e estorno de vale na Conta do Profissional (ticket 05 da spec 034).
 * Vale é dívida registrada e visível; o abate na Quitação de Comissão é o ticket 06 —
 * aqui o gestor só lança, lista e estorna.
 */
export const LancarValeModal: React.FC<LancarValeModalProps> = ({
  isOpen,
  professional,
  tenantId,
  activeCashSessionId,
  onSuccess,
  onClose,
}) => {
  const [amount, setAmount] = useState<string>('0,00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [entries, setEntries] = useState<ProfessionalAccountEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reversalReason, setReversalReason] = useState<string>('');
  const [reversalError, setReversalError] = useState<string | null>(null);

  const loadEntries = React.useCallback(async () => {
    if (!professional?.id || !tenantId) return;
    setLoadingEntries(true);
    try {
      const list = await contaProfissionalRepository.listEntries(professional.id, tenantId);
      setEntries(list.filter((e) => e.entry_type === 'vale'));
    } catch {
      // Lista é auxiliar; falha ao carregar não bloqueia o lançamento de um novo vale.
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  }, [professional?.id, tenantId]);

  useEffect(() => {
    if (isOpen && professional) {
      setAmount('0,00');
      setPaymentMethod('pix');
      setReason('');
      setErrorMsg(null);
      setReversingId(null);
      setReversalReason('');
      setReversalError(null);
      loadEntries();
    }
  }, [isOpen, professional, loadEntries]);

  if (!isOpen || !professional) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatCurrencyInput(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const valorNumerico = parseCurrencyInput(amount);

    try {
      await contaProfissionalRepository.registerAdvance({
        professional_id: professional.id,
        amount: valorNumerico,
        reason: reason.trim(),
        payment_method: paymentMethod,
        tenant_id: tenantId || null,
        cash_session_id: paymentMethod === 'cash' ? activeCashSessionId : null,
      });

      setAmount('0,00');
      setReason('');
      await loadEntries();
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível lançar o vale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReversal = async (entryId: string) => {
    setReversalError(null);
    if (reversalReason.trim().length < 5) {
      setReversalError('Informe uma justificativa com pelo menos cinco caracteres.');
      return;
    }
    try {
      await contaProfissionalRepository.reverseAdvance({
        entry_id: entryId,
        tenant_id: tenantId || null,
        reason: reversalReason.trim(),
      });
      setReversingId(null);
      setReversalReason('');
      await loadEntries();
      onSuccess();
    } catch (err: any) {
      setReversalError(err?.message || 'Não foi possível estornar o vale.');
    }
  };

  const openEntries = entries.filter((e) => e.status !== 'reversed');

  return (
    <div className="vale-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-lancar-vale-title">
      <div className="vale-modal-shell">
        <div className="vale-modal-header">
          <div>
            <h3 id="modal-lancar-vale-title" className="vale-modal-title">
              Vale de profissional
            </h3>
            <p className="vale-modal-subtitle">
              Registre um adiantamento para <strong className="vale-prof-highlight">{professional.name}</strong> — a dívida
              fica visível na Conta do Profissional em vez de viver na memória.
            </p>
          </div>
          <button onClick={onClose} className="vale-close-btn" aria-label="Fechar modal" type="button">
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="vale-modal-body">
          <div className="vale-field-group">
            <label htmlFor="vale-amount-input" className="vale-label">
              Valor do vale (R$) *
            </label>
            <div className="vale-input-container">
              <span className="vale-input-prefix">R$</span>
              <input
                id="vale-amount-input"
                type="text"
                className="vale-input"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="vale-field-group">
            <label htmlFor="vale-method-select" className="vale-label">
              Forma de pagamento *
            </label>
            <select
              id="vale-method-select"
              className="vale-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              required
            >
              <option value="pix">PIX</option>
              <option value="cash" disabled={!activeCashSessionId}>
                Dinheiro (sai da gaveta){!activeCashSessionId ? ' — abra o caixa do turno' : ''}
              </option>
              <option value="transfer">Transferência bancária</option>
              <option value="other">Outra forma</option>
            </select>
          </div>

          <div className="vale-field-group">
            <label htmlFor="vale-reason-input" className="vale-label">
              Motivo *
            </label>
            <textarea
              id="vale-reason-input"
              className="vale-textarea"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Adiantamento para compra de material..."
              required
              minLength={5}
            />
          </div>

          {errorMsg && (
            <div className="vale-error-banner" role="alert">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="vale-modal-actions">
            <button type="button" onClick={onClose} className="vale-cancel-btn" disabled={isSubmitting}>
              Fechar
            </button>
            <button type="submit" className="vale-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                'Lançando vale...'
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />
                  <span>Lançar vale</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="vale-entries-section">
          <h4 className="vale-entries-title">Vales em aberto</h4>
          {loadingEntries ? (
            <p className="vale-entries-empty">Carregando...</p>
          ) : openEntries.length === 0 ? (
            <p className="vale-entries-empty">Nenhum vale em aberto para este profissional.</p>
          ) : (
            <ul className="vale-entries-list">
              {openEntries.map((entry) => (
                <li key={entry.id} className="vale-entry-row">
                  <div className="vale-entry-info">
                    <span className="vale-entry-amount">{formatCurrency(entry.amount)}</span>
                    <span className="vale-entry-reason">{entry.reason}</span>
                  </div>
                  {reversingId === entry.id ? (
                    <div className="vale-reversal-form">
                      <input
                        type="text"
                        className="vale-reversal-input"
                        placeholder="Motivo do estorno"
                        value={reversalReason}
                        onChange={(e) => setReversalReason(e.target.value)}
                        aria-label="Motivo do estorno do vale"
                      />
                      <button
                        type="button"
                        className="vale-reversal-confirm-btn"
                        onClick={() => handleConfirmReversal(entry.id)}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="vale-reversal-cancel-btn"
                        onClick={() => {
                          setReversingId(null);
                          setReversalReason('');
                          setReversalError(null);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="vale-reversal-trigger-btn"
                      onClick={() => setReversingId(entry.id)}
                    >
                      Estornar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {reversalError && (
            <div className="vale-error-banner" role="alert">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              <span>{reversalError}</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .vale-modal-overlay {
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
        .vale-modal-shell {
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-lg, 1rem);
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
        }
        .vale-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #EADED6);
        }
        .vale-modal-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
        }
        .vale-modal-subtitle {
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
          margin-top: 0.25rem;
        }
        .vale-prof-highlight {
          color: var(--color-brand-primary, #D96C00);
          font-weight: 700;
        }
        .vale-close-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--color-text-secondary, #70625B);
          display: flex;
          align-items: center;
        }
        .vale-modal-body {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }
        .vale-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .vale-label {
          font-size: var(--font-size-xs, 0.8125rem);
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .vale-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .vale-input-prefix {
          position: absolute;
          left: 1.15rem;
          color: var(--color-brand-primary, #D96C00);
          font-weight: 800;
          font-size: 1.125rem;
        }
        .vale-input {
          width: 100%;
          border: 1.5px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.75rem 1rem 0.75rem 3.25rem;
          font-size: 1.35rem;
          font-weight: 800;
          outline: none;
        }
        .vale-select, .vale-textarea {
          width: 100%;
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.65rem 0.85rem;
          font-size: var(--font-size-sm, 0.875rem);
          outline: none;
        }
        .vale-textarea {
          resize: none;
        }
        .vale-error-banner {
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
        .vale-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-border, #EADED6);
        }
        .vale-cancel-btn {
          padding: 0.65rem 1.25rem;
          background: var(--color-bg-primary, #FFF1E6);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          font-weight: 700;
          cursor: pointer;
        }
        .vale-submit-btn {
          padding: 0.65rem 1.35rem;
          color: #fff;
          background: var(--color-brand-primary, #D96C00);
          border: none;
          border-radius: var(--radius-md, 0.5rem);
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .vale-submit-btn:disabled, .vale-cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .vale-entries-section {
          padding: 1rem 1.5rem 1.5rem;
          border-top: 1px solid var(--color-border, #EADED6);
        }
        .vale-entries-title {
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: var(--color-text-secondary, #70625B);
          margin: 0 0 0.6rem;
        }
        .vale-entries-empty {
          font-size: 0.85rem;
          color: var(--color-text-secondary, #70625B);
          margin: 0;
        }
        .vale-entries-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .vale-entry-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.5rem 0;
          border-bottom: 1px dashed var(--color-border, #EADED6);
        }
        .vale-entry-info {
          display: flex;
          flex-direction: column;
        }
        .vale-entry-amount {
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }
        .vale-entry-reason {
          font-size: 0.8rem;
          color: var(--color-text-secondary, #70625B);
        }
        .vale-reversal-trigger-btn {
          background: transparent;
          border: 1px solid var(--color-error, #F05252);
          color: var(--color-error, #F05252);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.35rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }
        .vale-reversal-form {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .vale-reversal-input {
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-sm, 0.375rem);
          padding: 0.35rem 0.5rem;
          font-size: 0.8rem;
          width: 160px;
        }
        .vale-reversal-confirm-btn {
          background: var(--color-error, #F05252);
          color: #fff;
          border: none;
          border-radius: var(--radius-sm, 0.375rem);
          padding: 0.35rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }
        .vale-reversal-cancel-btn {
          background: transparent;
          border: none;
          color: var(--color-text-secondary, #70625B);
          font-size: 0.75rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};
