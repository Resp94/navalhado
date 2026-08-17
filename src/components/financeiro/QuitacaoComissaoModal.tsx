import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Coins01Icon,
} from '@hugeicons/core-free-icons';
import { supabase } from '../../lib/supabase';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../../lib/currency';
import type { PaymentMethod } from '../../modules/caixa/types';

interface QuitacaoComissaoModalProps {
  isOpen: boolean;
  professional: {
    id: string;
    name: string;
    pending_sum: number;
    commission_sum: number;
    paid_sum: number;
  } | null;
  tenantId?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const QuitacaoComissaoModal: React.FC<QuitacaoComissaoModalProps> = ({
  isOpen,
  professional,
  tenantId,
  onSuccess,
  onClose,
}) => {
  const [amount, setAmount] = useState<string>('0,00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paidAtDate, setPaidAtDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar com o valor pendente quando o modal abrir
  React.useEffect(() => {
    if (professional) {
      const initialVal = Math.max(0, professional.pending_sum || 0);
      setAmount(formatCurrencyInput(initialVal));
      setPaidAtDate(new Date().toISOString().split('T')[0]);
      setErrorMsg(null);
      setNotes('');
    }
  }, [professional, isOpen]);

  if (!isOpen || !professional) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatCurrencyInput(e.target.value));
  };

  const handleQuitarTudo = () => {
    const totalPendente = Math.max(0, professional.pending_sum || 0);
    setAmount(formatCurrencyInput(totalPendente));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const valorNumerico = parseCurrencyInput(amount);

    if (valorNumerico <= 0) {
      setErrorMsg('Informe um valor de quitação maior que zero.');
      setIsSubmitting(false);
      return;
    }

    try {
      const dateTimestamp = paidAtDate
        ? new Date(`${paidAtDate}T12:00:00Z`).toISOString()
        : new Date().toISOString();

      const { error } = await supabase.rpc('register_commission_payout', {
        p_professional_id: professional.id,
        p_amount: valorNumerico,
        p_payment_method: paymentMethod,
        p_notes: notes.trim() || null,
        p_paid_at: dateTimestamp,
        p_tenant_id: tenantId || null,
      });

      if (error) {
        throw new Error(error.message || 'Erro ao registrar quitação de comissão.');
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível registrar o pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="comissao-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-quitacao-comissao-title"
    >
      <div className="comissao-modal-shell">
        <div className="comissao-modal-header">
          <div>
            <h3 id="modal-quitacao-comissao-title" className="comissao-modal-title">
              Quitação de comissão
            </h3>
            <p className="comissao-modal-subtitle">
              Repasse para <strong className="text-amber-400">{professional.name}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="comissao-close-btn"
            aria-label="Fechar modal"
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} />
          </button>
        </div>

        {/* Resumo da Produção do Profissional */}
        <div className="comissao-summary-box">
          <div className="comissao-summary-item">
            <span className="comissao-summary-label">Comissão total acumulada:</span>
            <span className="comissao-summary-val">{formatCurrency(professional.commission_sum)}</span>
          </div>
          <div className="comissao-summary-item">
            <span className="comissao-summary-label">Já quitado anteriormente:</span>
            <span className="comissao-summary-val text-emerald-400">{formatCurrency(professional.paid_sum)}</span>
          </div>
          <div className="comissao-summary-item highlight">
            <span className="comissao-summary-label font-semibold text-slate-200">Saldo pendente atual:</span>
            <span className="comissao-summary-val font-bold text-amber-400">
              {formatCurrency(professional.pending_sum)}
            </span>
          </div>
        </div>

        {/* Formulário de Quitação */}
        <form onSubmit={handleSubmit} className="comissao-modal-body">
          <div className="comissao-field-group">
            <div className="flex items-center justify-between">
              <label htmlFor="payout-amount-input" className="comissao-label">
                Valor do repasse (R$) *
              </label>
              <button
                type="button"
                onClick={handleQuitarTudo}
                className="comissao-quick-action"
              >
                Quitar saldo total
              </button>
            </div>
            <div className="comissao-input-container">
              <span className="comissao-input-prefix">R$</span>
              <input
                id="payout-amount-input"
                type="text"
                className="comissao-input"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="comissao-field-group">
              <label htmlFor="payout-method-select" className="comissao-label">
                Forma de pagamento *
              </label>
              <select
                id="payout-method-select"
                className="comissao-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                required
              >
                <option value="pix">PIX</option>
                <option value="cash">Dinheiro em espécie (gaveta)</option>
                <option value="transfer">Transferência bancária (TED/DOC)</option>
                <option value="other">Outros</option>
              </select>
            </div>

            <div className="comissao-field-group">
              <label htmlFor="payout-date-input" className="comissao-label">
                Data do repasse *
              </label>
              <input
                id="payout-date-input"
                type="date"
                className="comissao-date-input"
                value={paidAtDate}
                onChange={(e) => setPaidAtDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="comissao-field-group">
            <label htmlFor="payout-notes-input" className="comissao-label">
              Observações ou comprovante (opcional)
            </label>
            <textarea
              id="payout-notes-input"
              className="comissao-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Quitação semanal referente aos cortes de 10 a 16/08..."
            />
          </div>

          {errorMsg && (
            <div className="comissao-error-banner" role="alert">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="comissao-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="comissao-cancel-btn"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="comissao-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Gravando quitação...'
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={18} />
                  <span>Confirmar pagamento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .comissao-modal-overlay {
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
        .comissao-modal-shell {
          background: var(--color-bg-secondary, #18181b);
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
          border-radius: 1rem;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: comissaoFadeIn 0.15s ease-out;
        }
        @keyframes comissaoFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .comissao-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
        }
        .comissao-modal-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text-primary, #f4f4f5);
        }
        .comissao-modal-subtitle {
          font-size: 0.8125rem;
          color: var(--color-text-secondary, #a1a1aa);
          margin-top: 0.125rem;
        }
        .comissao-close-btn {
          color: var(--color-text-muted, #71717a);
          padding: 0.25rem;
          border-radius: 0.375rem;
          transition: all 0.15s ease;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .comissao-close-btn:hover {
          color: var(--color-text-primary, #f4f4f5);
          background: rgba(255, 255, 255, 0.05);
        }
        .comissao-summary-box {
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.06));
          padding: 0.875rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .comissao-summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8125rem;
        }
        .comissao-summary-label {
          color: var(--color-text-secondary, #a1a1aa);
        }
        .comissao-summary-val {
          color: var(--color-text-primary, #e4e4e7);
          font-variant-numeric: tabular-nums;
        }
        .comissao-summary-item.highlight {
          border-top: 1px dashed var(--color-border, rgba(255, 255, 255, 0.1));
          padding-top: 0.375rem;
          margin-top: 0.25rem;
        }
        .comissao-modal-body {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .comissao-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .comissao-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-text-primary, #e4e4e7);
        }
        .comissao-quick-action {
          font-size: 0.75rem;
          color: var(--color-brand-primary, #f59e0b);
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: 500;
          text-decoration: underline;
        }
        .comissao-quick-action:hover {
          color: var(--color-brand-hover, #fbbf24);
        }
        .comissao-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .comissao-input-prefix {
          position: absolute;
          left: 1rem;
          color: var(--color-text-muted, #71717a);
          font-weight: 500;
          font-size: 1.125rem;
        }
        .comissao-input {
          width: 100%;
          background: var(--color-bg-primary, #09090b);
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
          border-radius: 0.5rem;
          padding: 0.75rem 1rem 0.75rem 3rem;
          color: var(--color-text-primary, #f4f4f5);
          font-size: 1.25rem;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .comissao-input:focus {
          border-color: var(--color-brand-primary, #f59e0b);
        }
        .comissao-select, .comissao-date-input {
          width: 100%;
          background: var(--color-bg-primary, #09090b);
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          color: var(--color-text-primary, #f4f4f5);
          font-size: 0.875rem;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }
        .comissao-select:focus, .comissao-date-input:focus {
          border-color: var(--color-brand-primary, #f59e0b);
        }
        .comissao-textarea {
          width: 100%;
          background: var(--color-bg-primary, #09090b);
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
          border-radius: 0.5rem;
          padding: 0.625rem 0.875rem;
          color: var(--color-text-primary, #f4f4f5);
          font-size: 0.875rem;
          outline: none;
          resize: none;
          transition: border-color 0.15s ease;
        }
        .comissao-textarea:focus {
          border-color: var(--color-brand-primary, #f59e0b);
        }
        .comissao-error-banner {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: var(--color-error, #f87171);
          padding: 0.625rem 0.875rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .comissao-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }
        .comissao-cancel-btn {
          padding: 0.625rem 1rem;
          color: var(--color-text-secondary, #a1a1aa);
          background: transparent;
          border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
          border-radius: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .comissao-cancel-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-primary, #f4f4f5);
        }
        .comissao-submit-btn {
          padding: 0.625rem 1.25rem;
          color: #18181b;
          background: var(--color-brand-primary, #f59e0b);
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
        .comissao-submit-btn:hover:not(:disabled) {
          background: var(--color-brand-hover, #fbbf24);
        }
        .comissao-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
