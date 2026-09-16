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
      className="fixed inset-0 bg-[rgba(20,17,15,0.55)] backdrop-blur-[8px] flex items-center justify-center z-[9999] p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-caixa-title"
    >
      <div className="w-full max-w-[500px] max-h-[min(90dvh,720px)] bg-bg-secondary border border-border rounded-lg shadow-xl flex flex-col font-base text-text-primary overflow-hidden animate-dialog-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-secondary shrink-0">
          <div>
            <h3 id="modal-caixa-title" className="text-lg font-extrabold text-text-primary m-0 tracking-tight leading-tight">
              Abertura de caixa do turno
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-text-primary p-[0.35rem] min-w-11 min-h-11 -mr-[0.35rem] rounded-sm border-none bg-transparent inline-flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[rgba(45,35,30,0.05)]"
            aria-label="Fechar modal"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        <div className="px-6 py-[0.85rem] bg-bg-primary border-b border-border flex items-center gap-3 shrink-0">
          <HugeiconsIcon icon={InformationCircleIcon} size={18} className="text-text-primary shrink-0 [&_circle]:stroke-text-primary [&_path]:stroke-text-primary" />
          <p className="text-xs text-text-primary leading-relaxed m-0">
            Informe a quantia em dinheiro que está na gaveta para servir de troco aos primeiros clientes.
          </p>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-md bg-[rgba(240,82,82,0.1)] border border-[rgba(240,82,82,0.3)] text-error text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleConfirm} className="px-6 py-5 flex flex-col gap-[1.15rem] bg-bg-secondary overflow-y-auto">
          <div className="flex flex-col gap-[0.4rem]">
            <label className="text-xs font-bold uppercase tracking-wide text-text-primary">
              Valor do troco inicial na gaveta *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-[1.15rem] text-lg font-extrabold text-brand-primary pointer-events-none">R$</span>
              <input
                type="text"
                value={initialAmount}
                onChange={handleAmountChange}
                className="w-full py-3 pr-4 pl-13 text-[1.35rem] font-extrabold text-text-primary bg-bg-secondary border-none shadow-[0_0_0_3px_var(--color-text-primary)] rounded-md outline-none transition-all duration-200 tabular-nums focus:shadow-[0_0_0_3px_var(--color-brand-primary)]"
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-[0.4rem]">
            <label className="text-xs font-bold uppercase tracking-wide text-text-primary">
              Observações do turno (opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Troco separado em moedas e cédulas de pequeno valor..."
              className="w-full px-[0.85rem] py-[0.65rem] text-sm text-text-primary bg-bg-secondary border-none shadow-[0_0_0_0.888889px_var(--color-text-primary)] rounded-md outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_var(--color-brand-primary)]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-[0.65rem] min-h-11 rounded-md border-none shadow-[0_0_0_0.888889px_var(--color-text-primary)] bg-transparent text-text-primary text-sm font-bold cursor-pointer transition-all duration-200 hover:bg-[rgba(45,35,30,0.04)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-[1.35rem] py-[0.65rem] min-h-11 rounded-md border-none bg-bg-secondary text-text-primary text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-2 shadow-[0_0_0_0.8px_var(--color-text-primary)] transition-all duration-200 [&_svg]:stroke-text-primary [&_svg]:text-text-primary hover:not-disabled:bg-success hover:not-disabled:text-text-primary hover:not-disabled:shadow-[0_0_0_0.8px_var(--color-text-primary)] hover:not-disabled:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};
