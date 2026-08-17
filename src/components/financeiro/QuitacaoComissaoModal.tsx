import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { supabase } from '../../lib/supabase';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../../lib/currency';
import type { PaymentMethod } from '../../modules/caixa/types';

interface QuitacaoComissaoModalProps {
  isOpen: boolean;
  professional: {
    id?: string;
    professional_id?: string;
    name?: string;
    professional_name?: string;
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

  const profId = professional?.professional_id || professional?.id || '';
  const profName = professional?.professional_name || professional?.name || 'Profissional';

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
        p_professional_id: profId,
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
              Realize o pagamento de comissão para <strong className="comissao-prof-highlight">{profName}</strong> e mantenha o saldo em dia.
            </p>
          </div>
          <button
            onClick={onClose}
            className="comissao-close-btn"
            aria-label="Fechar modal"
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* Resumo da Produção do Profissional */}
        <div className="comissao-summary-box">
          <div className="comissao-summary-item">
            <span className="comissao-summary-label">Comissão total faturada no período:</span>
            <span className="comissao-summary-val">{formatCurrency(professional.commission_sum)}</span>
          </div>
          <div className="comissao-summary-item">
            <span className="comissao-summary-label">Total já repassado anteriormente:</span>
            <span className="comissao-summary-val comissao-summary-val--paid">{formatCurrency(professional.paid_sum)}</span>
          </div>
          <div className="comissao-summary-item highlight">
            <span className="comissao-summary-label font-semibold">Saldo pendente para quitação:</span>
            <span className="comissao-summary-val comissao-summary-val--pending">
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
                Preencher saldo total pendente
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
                <option value="pix">PIX (transferência instantânea)</option>
                <option value="cash">Dinheiro em espécie (retirado da gaveta)</option>
                <option value="transfer">Transferência bancária (TED ou DOC)</option>
                <option value="other">Outra forma de pagamento</option>
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
                  <span>Confirmar quitação do repasse</span>
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
          background: rgba(20, 17, 15, 0.55);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }
        .comissao-modal-shell {
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-lg, 1rem);
          width: 100%;
          max-width: 500px;
          box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
          overflow: hidden;
          animation: comissaoFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes comissaoFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .comissao-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #EADED6);
          background: var(--color-bg-secondary, #ffffff);
        }
        .comissao-modal-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .comissao-modal-subtitle {
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
          margin-top: 0.25rem;
        }
        .comissao-prof-highlight {
          color: var(--color-brand-primary, #D96C00);
          font-weight: 700;
        }
        .comissao-close-btn {
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
        }
        .comissao-close-btn:hover {
          color: var(--color-text-primary, #2D231E);
          background: var(--color-bg-primary, #FFF1E6);
        }
        .comissao-summary-box {
          background: var(--color-bg-primary, #FFF1E6);
          border-bottom: 1px solid var(--color-border, #EADED6);
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .comissao-summary-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-xs, 0.8125rem);
        }
        .comissao-summary-label {
          color: var(--color-text-secondary, #70625B);
          font-weight: 600;
        }
        .comissao-summary-val {
          color: var(--color-text-primary, #2D231E);
          font-variant-numeric: tabular-nums;
          font-weight: 700;
        }
        .comissao-summary-val--paid {
          color: var(--color-success, #0E9F6E);
        }
        .comissao-summary-val--pending {
          color: var(--color-brand-primary, #D96C00);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 800;
        }
        .comissao-summary-item.highlight {
          border-top: 1px dashed var(--color-border, #EADED6);
          padding-top: 0.5rem;
          margin-top: 0.25rem;
        }
        .comissao-modal-body {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          background: var(--color-bg-secondary, #ffffff);
        }
        .comissao-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .comissao-label {
          font-size: var(--font-size-xs, 0.8125rem);
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .comissao-quick-action {
          font-size: var(--font-size-xs, 0.75rem);
          color: var(--color-brand-primary, #D96C00);
          background: transparent;
          border: none;
          cursor: pointer;
          font-weight: 700;
          text-decoration: underline;
          transition: color 0.2s ease;
        }
        .comissao-quick-action:hover {
          color: var(--color-brand-hover, #9C3F00);
        }
        .comissao-input-container {
          position: relative;
          display: flex;
          align-items: center;
        }
        .comissao-input-prefix {
          position: absolute;
          left: 1.15rem;
          color: var(--color-brand-primary, #D96C00);
          font-weight: 800;
          font-size: 1.125rem;
        }
        .comissao-input {
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
        .comissao-input:focus {
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }
        .comissao-select, .comissao-date-input {
          width: 100%;
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.65rem 0.85rem;
          color: var(--color-text-primary, #2D231E);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 600;
          outline: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .comissao-select:focus, .comissao-date-input:focus {
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }
        .comissao-textarea {
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
        .comissao-textarea:focus {
          border-color: var(--color-brand-primary, #D96C00);
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.15);
        }
        .comissao-error-banner {
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
        .comissao-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border, #EADED6);
        }
        .comissao-cancel-btn {
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
        .comissao-cancel-btn:hover:not(:disabled) {
          border-color: var(--color-brand-primary, #D96C00);
          color: var(--color-brand-primary, #D96C00);
        }
        .comissao-submit-btn {
          padding: 0.65rem 1.35rem;
          color: var(--color-brand-lightest, #FFF1E6);
          background: var(--color-brand-primary, #D96C00);
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
        .comissao-submit-btn:hover:not(:disabled) {
          background: var(--color-brand-hover, #9C3F00);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(217, 108, 0, 0.25);
        }
        .comissao-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
