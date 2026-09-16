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
    <div
      className="fixed inset-0 z-[9999] bg-[rgba(20,17,15,0.55)] backdrop-blur-[8px] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-lancar-vale-title"
    >
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-[500px] max-h-[90vh] overflow-y-auto shadow-xl animate-dialog-in">
        <div className="flex items-start justify-between px-6 py-5 border-b border-border">
          <div>
            <h3 id="modal-lancar-vale-title" className="text-lg font-extrabold text-text-primary m-0">
              Vale de profissional
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Registre um adiantamento para <strong className="text-brand-primary font-bold">{professional.name}</strong> — a dívida
              fica visível na Conta do Profissional em vez de viver na memória.
            </p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none cursor-pointer text-text-secondary flex items-center" aria-label="Fechar modal" type="button">
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-[1.1rem]">
          <div className="flex flex-col gap-[0.4rem]">
            <label htmlFor="vale-amount-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
              Valor do vale (R$) *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-[1.15rem] text-brand-primary font-extrabold text-lg">R$</span>
              <input
                id="vale-amount-input"
                type="text"
                className="w-full border-[1.5px] border-border rounded-md py-3 pr-4 pl-13 text-[1.35rem] font-extrabold outline-none"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-[0.4rem]">
            <label htmlFor="vale-method-select" className="text-xs font-bold text-text-primary uppercase tracking-wide">
              Forma de pagamento *
            </label>
            <select
              id="vale-method-select"
              className="w-full border border-border rounded-md px-[0.85rem] py-[0.65rem] text-sm outline-none"
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

          <div className="flex flex-col gap-[0.4rem]">
            <label htmlFor="vale-reason-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
              Motivo *
            </label>
            <textarea
              id="vale-reason-input"
              className="w-full border border-border rounded-md px-[0.85rem] py-[0.65rem] text-sm outline-none resize-none"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Adiantamento para compra de material..."
              required
              minLength={5}
            />
          </div>

          {errorMsg && (
            <div className="bg-[rgba(240,82,82,0.1)] border border-[rgba(240,82,82,0.25)] text-error px-[0.65rem] py-[0.65rem] rounded-md text-xs flex items-center gap-2" role="alert">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-[0.65rem] bg-bg-primary border border-border rounded-md font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Fechar
            </button>
            <button
              type="submit"
              className="px-[1.35rem] py-[0.65rem] text-white bg-brand-primary border-none rounded-md font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
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

        <div className="px-6 pt-4 pb-6 border-t border-border">
          <h4 className="text-[0.85rem] uppercase tracking-wide text-text-secondary m-0 mb-[0.6rem]">Vales em aberto</h4>
          {loadingEntries ? (
            <p className="text-[0.85rem] text-text-secondary m-0">Carregando...</p>
          ) : openEntries.length === 0 ? (
            <p className="text-[0.85rem] text-text-secondary m-0">Nenhum vale em aberto para este profissional.</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {openEntries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-border">
                  <div className="flex flex-col">
                    <span className="font-extrabold tabular-nums">{formatCurrency(entry.amount)}</span>
                    <span className="text-[0.8rem] text-text-secondary">{entry.reason}</span>
                  </div>
                  {reversingId === entry.id ? (
                    <div className="flex items-center gap-[0.35rem]">
                      <input
                        type="text"
                        className="border border-border rounded-sm px-2 py-[0.35rem] text-[0.8rem] w-40"
                        placeholder="Motivo do estorno"
                        value={reversalReason}
                        onChange={(e) => setReversalReason(e.target.value)}
                        aria-label="Motivo do estorno do vale"
                      />
                      <button
                        type="button"
                        className="bg-error text-white border-none rounded-sm px-[0.6rem] py-[0.35rem] text-xs font-bold cursor-pointer"
                        onClick={() => handleConfirmReversal(entry.id)}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="bg-transparent border-none text-text-secondary text-xs cursor-pointer"
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
                      className="bg-transparent border border-error text-error rounded-md px-3 py-[0.35rem] text-[0.8rem] font-bold cursor-pointer"
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
            <div className="bg-[rgba(240,82,82,0.1)] border border-[rgba(240,82,82,0.25)] text-error px-[0.65rem] py-[0.65rem] rounded-md text-xs flex items-center gap-2 mt-2" role="alert">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              <span>{reversalError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
