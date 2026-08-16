import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Money01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { CashSession } from '../../modules/caixa/types';

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
    const raw = e.target.value.replace(/\D/g, '');
    const num = parseInt(raw || '0', 10) / 100;
    setInitialAmount(
      num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  };

  const parseAmount = (val: string): number => {
    return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const valorInicial = parseAmount(initialAmount);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-caixa-title"
    >
      <div className="bg-[var(--color-bg-primary,#121214)] border border-[var(--color-border-subtle,rgba(255,255,255,0.1))] rounded-2xl w-full max-w-md p-6 shadow-2xl relative text-[var(--color-text-primary,#fff)] font-sans">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle,rgba(255,255,255,0.08))]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary,#D4AF37)]/15 flex items-center justify-center text-[var(--color-brand-primary,#D4AF37)]">
              <HugeiconsIcon icon={Money01Icon} size={22} />
            </div>
            <div>
              <h3 id="modal-caixa-title" className="text-lg font-bold">
                Abertura de Caixa Diário
              </h3>
              <p className="text-xs text-[var(--color-text-secondary,#A1A1AA)]">
                Nenhum caixa aberto para o turno de hoje.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-lg text-[var(--color-text-secondary,#A1A1AA)] hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Fechar"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-[var(--color-info,#3B82F6)]/10 border border-[var(--color-info,#3B82F6)]/20 flex items-start gap-2.5">
          <HugeiconsIcon icon={InformationCircleIcon} size={18} className="text-[var(--color-info,#3B82F6)] mt-0.5 shrink-0" />
          <p className="text-xs text-[var(--color-text-secondary,#A1A1AA)] leading-relaxed">
            Para registrar recebimentos e manter o controle de sangria e fechamento, informe o fundo de troco inicial da gaveta.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-[var(--color-error,#EF4444)]/10 border border-[var(--color-error,#EF4444)]/30 text-xs text-[var(--color-error,#EF4444)]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleConfirm} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
              Fundo de Troco Inicial (R$) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--color-brand-primary,#D4AF37)]">
                R$
              </span>
              <input
                type="text"
                value={initialAmount}
                onChange={handleAmountChange}
                className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-[var(--color-border-subtle,rgba(255,255,255,0.15))] rounded-xl text-lg font-bold text-white focus:outline-none focus:border-[var(--color-brand-primary,#D4AF37)] transition-colors"
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#A1A1AA)] mb-1.5">
              Observações (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Turno da manhã, troco em moedas"
              className="w-full px-3.5 py-2 bg-black/40 border border-[var(--color-border-subtle,rgba(255,255,255,0.15))] rounded-xl text-sm text-white focus:outline-none focus:border-[var(--color-brand-primary,#D4AF37)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[var(--color-border-subtle,rgba(255,255,255,0.15))] text-sm font-semibold text-[var(--color-text-secondary,#A1A1AA)] hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--color-brand-primary,#D4AF37)] text-black text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Abrindo...</span>
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} />
                  <span>Abrir Caixa</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
