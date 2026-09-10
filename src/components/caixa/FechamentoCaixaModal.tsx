import React, { useState, useEffect, useMemo } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertCircleIcon,
  Coins01Icon,
  Invoice01Icon,
} from '@hugeicons/core-free-icons';
import { supabase } from '../../lib/supabase';
import { CaixaRepository, calculateExpectedDrawerCash } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { CashSession, TurnPaymentsSummary } from '../../modules/caixa/types';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../../lib/currency';

interface FechamentoCaixaModalProps {
  isOpen: boolean;
  session: CashSession | null;
  cashReceipts?: number; // Total de recebimentos em dinheiro apurados no turno
  turnSummary?: TurnPaymentsSummary;
  suprimentos?: number;
  sangrias?: number;
  onCaixaFechado: (closedSession: CashSession) => void;
  onClose: () => void;
  caixaRepo?: CaixaRepository;
}

export const FechamentoCaixaModal: React.FC<FechamentoCaixaModalProps> = ({
  isOpen,
  session,
  cashReceipts = 0,
  turnSummary: initialTurnSummary,
  suprimentos = 0,
  sangrias = 0,
  onCaixaFechado,
  onClose,
  caixaRepo,
}) => {
  const [closingAmount, setClosingAmount] = useState<string>('0,00');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turnSummary, setTurnSummary] = useState<TurnPaymentsSummary | undefined>(initialTurnSummary);
  const [currentSuprimentos, setCurrentSuprimentos] = useState<number>(suprimentos);
  const [currentSangrias, setCurrentSangrias] = useState<number>(sangrias);

  const defaultRepo = useMemo(() => new CaixaRepository(new SupabaseCaixaAdapter()), []);
  const repo = caixaRepo || defaultRepo;

  useEffect(() => {
    setCurrentSuprimentos(suprimentos);
  }, [suprimentos]);

  useEffect(() => {
    setCurrentSangrias(sangrias);
  }, [sangrias]);

  useEffect(() => {
    if (isOpen && session) {
      if (initialTurnSummary) {
        setTurnSummary(initialTurnSummary);
      } else {
        repo.getTurnPaymentsSummary(session.tenant_id, session.opened_at, session.id)
          .then((res) => setTurnSummary(res))
          .catch((err) => console.error('Erro ao carregar resumo de pagamentos no fechamento:', err));
      }

      if (suprimentos === 0 && sangrias === 0) {
        repo.getMovementsSummary(session.id)
          .then((movRes) => {
            if (movRes) {
              setCurrentSuprimentos(movRes.suprimentos ?? 0);
              setCurrentSangrias(movRes.sangrias ?? 0);
            }
          })
          .catch((err) => console.error('Erro ao carregar movimentações no fechamento:', err));
      }
    }
  }, [isOpen, session, initialTurnSummary, suprimentos, sangrias, repo]);

  if (!isOpen || !session) return null;

  const totalTurnRevenue = turnSummary?.total ?? cashReceipts;
  const cashInTurn = turnSummary?.dinheiro ?? cashReceipts;
  const pixInTurn = turnSummary?.pix ?? 0;
  const cardInTurn = turnSummary?.cartao ?? 0;

  const initialAmount = Number(session.initial_amount) || 0;
  const expectedAmount = calculateExpectedDrawerCash(initialAmount, cashInTurn, currentSuprimentos, currentSangrias);

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível fechar a sessão de caixa.';
      setErrorMsg(message);
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

        {/* ─── RESUMO DE ARRECADAÇÃO GERAL DO TURNO ─── */}
        <div className="caixa-turn-revenue-card">
          <div className="caixa-turn-revenue-header">
            <span className="caixa-turn-revenue-label">
              <HugeiconsIcon icon={Invoice01Icon} size={15} />
              Total arrecadado no turno:
            </span>
            <span className="caixa-turn-revenue-val">
              {formatCurrency(totalTurnRevenue)}
            </span>
          </div>
          <div className="caixa-turn-methods-grid">
            <div className="caixa-turn-method-badge">
              <span className="caixa-turn-method-label">Pix</span>
              <span className="caixa-turn-method-val">{formatCurrency(pixInTurn)}</span>
            </div>
            <div className="caixa-turn-method-badge">
              <span className="caixa-turn-method-label">Cartões</span>
              <span className="caixa-turn-method-val">{formatCurrency(cardInTurn)}</span>
            </div>
            <div className="caixa-turn-method-badge">
              <span className="caixa-turn-method-label">Dinheiro</span>
              <span className="caixa-turn-method-val">{formatCurrency(cashInTurn)}</span>
            </div>
          </div>
        </div>

        {/* ─── CONFERÊNCIA FÍSICA DA GAVETA ─── */}
        <div className="caixa-breakdown-summary">
          <div className="caixa-breakdown-title">
            <HugeiconsIcon icon={Coins01Icon} size={15} />
            <span>Conferência da gaveta (dinheiro físico)</span>
          </div>
          <div className="caixa-breakdown-item">
            <span className="caixa-breakdown-label">Fundo de troco inicial:</span>
            <span className="caixa-breakdown-val">{formatCurrency(initialAmount)}</span>
          </div>
          <div className="caixa-breakdown-item">
            <span className="caixa-breakdown-label">(+) Entradas em dinheiro (espécie):</span>
            <span className="caixa-breakdown-val text-success">+{formatCurrency(cashInTurn)}</span>
          </div>
          {suprimentos > 0 ? (
            <div className="caixa-breakdown-item">
              <span className="caixa-breakdown-label">(+) Suprimentos (entradas avulsas):</span>
              <span className="caixa-breakdown-val text-success">+{formatCurrency(suprimentos)}</span>
            </div>
          ) : null}
          {sangrias > 0 ? (
            <div className="caixa-breakdown-item">
              <span className="caixa-breakdown-label">(-) Sangrias (retiradas):</span>
              <span className="caixa-breakdown-val text-danger">-{formatCurrency(sangrias)}</span>
            </div>
          ) : null}
          <div className="caixa-breakdown-item expected">
            <span className="caixa-breakdown-label font-bold">Total em dinheiro esperado na gaveta:</span>
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
          max-height: min(90dvh, 720px);
          display: flex;
          flex-direction: column;
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
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #EADED6);
          background: var(--color-bg-secondary, #ffffff);
          flex-shrink: 0;
        }
        .caixa-modal-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .caixa-close-btn {
          color: var(--color-text-primary, #2D231E);
          padding: 0.35rem;
          min-width: 44px;
          min-height: 44px;
          margin-right: -0.35rem;
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
          background: rgba(45, 35, 30, 0.05);
        }
        .caixa-turn-revenue-card {
          background: var(--color-bg-secondary, #ffffff);
          border-bottom: 1px solid var(--color-border, #EADED6);
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex-shrink: 0;
        }
        .caixa-turn-revenue-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .caixa-turn-revenue-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
        }
        .caixa-turn-revenue-val {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-brand-primary, #D96C00);
          letter-spacing: -0.01em;
        }
        .caixa-turn-methods-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .caixa-turn-method-badge {
          background-color: transparent;
          border: none;
          box-shadow: 0 0 0 0.888889px var(--color-text-primary, #2D231E);
          border-radius: 8px;
          padding: 0.4rem 0.6rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.15rem;
        }
        .caixa-turn-method-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--color-text-primary, #2D231E);
        }
        .caixa-turn-method-val {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
        }
        .caixa-breakdown-title {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-primary, #2D231E);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          margin-bottom: 0.25rem;
        }
        .caixa-breakdown-title svg {
          stroke: var(--color-text-primary, #2D231E);
          color: var(--color-text-primary, #2D231E);
        }
        .caixa-breakdown-summary {
          background-color: transparent;
          border-bottom: 1px solid var(--color-border, #EADED6);
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          flex-shrink: 0;
        }
        .caixa-breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: var(--font-size-xs, 0.8125rem);
        }
        .caixa-breakdown-label {
          color: var(--color-text-primary, #2D231E);
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
          overflow-y: auto;
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
          color: var(--color-text-primary, #2D231E);
          font-weight: 800;
          font-size: 1.125rem;
          pointer-events: none;
        }
        .caixa-input {
          width: 100%;
          background: var(--color-bg-secondary, #ffffff);
          border: none;
          box-shadow: 0 0 0 2.11677px var(--color-text-primary, #2D231E);
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
          box-shadow: 0 0 0 3px rgba(217, 108, 0, 0.25);
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
        .caixa-conferencia-icon svg {
          height: fit-content;
        }
        .caixa-conferencia-icon svg path {
          stroke: var(--color-text-primary, #2D231E);
        }
        .caixa-conferencia-text {
          font-size: var(--font-size-xs, 0.8125rem);
          font-weight: 700;
          line-height: 1.35;
          color: var(--color-text-primary, #2D231E);
        }
        .caixa-conferencia-badge.exact {
          background: var(--color-success-bg, rgba(14, 159, 110, 0.1));
          border: 1px solid rgba(14, 159, 110, 0.3);
        }
        .caixa-conferencia-badge.surplus {
          background: rgba(63, 131, 248, 0.1);
          border: 1px solid rgba(63, 131, 248, 0.3);
        }
        .caixa-conferencia-badge.shortage {
          background: rgba(240, 82, 82, 0.1);
          border: 1px solid rgba(240, 82, 82, 0.3);
        }
        .caixa-textarea {
          width: 100%;
          background: var(--color-bg-secondary, #ffffff);
          border: none;
          box-shadow: 0 0 0 0.888889px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.65rem 0.85rem;
          color: var(--color-text-primary, #2D231E);
          font-size: var(--font-size-sm, 0.875rem);
          outline: none;
          resize: none;
          transition: all 0.2s ease;
        }
        .caixa-textarea:focus {
          box-shadow: 0 0 0 2px var(--color-brand-primary, #D96C00);
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
          min-height: 44px;
          color: var(--color-text-primary, #2D231E);
          background-color: transparent;
          border: none;
          box-shadow: 0 0 0 0.888889px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 0.5rem);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .caixa-cancel-action-btn:hover:not(:disabled) {
          background-color: rgba(45, 35, 30, 0.04);
        }
        .caixa-submit-action-btn {
          padding: 0.65rem 1.35rem;
          min-height: 44px;
          color: var(--color-text-primary, #2D231E);
          background-color: transparent;
          border: none;
          box-shadow: 0 0 0 1.5px var(--color-error, #F05252), var(--shadow-sm, 0 1px 2px rgba(45, 35, 30, 0.06));
          border-radius: var(--radius-md, 0.5rem);
          font-size: var(--font-size-sm, 0.875rem);
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .caixa-submit-action-btn span {
          color: var(--color-text-primary, #2D231E);
        }
        .caixa-submit-action-btn svg path {
          stroke: var(--color-text-primary, #2D231E);
        }
        .caixa-submit-action-btn:hover:not(:disabled) {
          background-color: var(--color-error-bg, #FDE8E8);
          transform: translateY(-1px);
        }
        .caixa-submit-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
