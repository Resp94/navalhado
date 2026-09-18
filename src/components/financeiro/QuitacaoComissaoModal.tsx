import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { formatCurrency, parseCurrencyInput, formatCurrencyInput } from '../../lib/currency';
import { Select } from '../ui';
import type { PaymentMethod } from '../../modules/caixa/types';
import { ComissaoRepository } from '../../modules/comissoes/ComissaoRepository';
import { SupabaseComissaoAdapter } from '../../modules/comissoes/adapters/SupabaseComissaoAdapter';
import type { SaldoComissaoProfissional } from '../../modules/comissoes/types';

const comissaoRepository = new ComissaoRepository(new SupabaseComissaoAdapter());

/**
 * Maior abate de vale que ainda deixa pelo menos um centavo de repasse: o backend
 * exige um valor de repasse maior que zero, então nunca sugerimos um abate que
 * zere o campo sozinho (aconteceria sempre que o vale em aberto cobrisse o total
 * devido ao profissional).
 */
function maxSafeAdvance(valeAberto: number, orcamentoDisponivel: number): number {
  if (orcamentoDisponivel <= 0) return 0;
  return Math.min(valeAberto, Math.max(0, orcamentoDisponivel - 0.01));
}

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
  /** ID da sessão de caixa aberta no turno atual, se houver. */
  activeCashSessionId?: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

export const QuitacaoComissaoModal: React.FC<QuitacaoComissaoModalProps> = ({
  isOpen,
  professional,
  tenantId,
  activeCashSessionId,
  onSuccess,
  onClose,
}) => {
  const [amount, setAmount] = useState<string>('0,00');
  const [advanceAmount, setAdvanceAmount] = useState<string>('0,00');
  const [creditAmount, setCreditAmount] = useState<string>('0,00');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [paidAtDate, setPaidAtDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<SaldoComissaoProfissional | null>(null);

  const profId = professional?.professional_id || professional?.id || '';
  const profName = professional?.professional_name || professional?.name || 'Profissional';
  const valeAberto = Math.max(0, balance?.advances_open_amount || 0);
  const gorjetaAberta = Math.max(0, balance?.credits_open_amount || 0);

  // Inicializar com o valor pendente quando o modal abrir
  React.useEffect(() => {
    if (professional) {
      const initialVal = Math.max(0, professional.pending_sum || 0);
      setAmount(formatCurrencyInput(initialVal));
      setAdvanceAmount('0,00');
      setCreditAmount('0,00');
      setPaidAtDate(new Date().toISOString().split('T')[0]);
      setErrorMsg(null);
      setNotes('');
      setBalance(null);
    }
  }, [professional, isOpen]);

  // Consultar vale/gorjeta em aberto e líquido sugerido do profissional
  React.useEffect(() => {
    if (!professional || !profId) return;
    let cancelled = false;

    comissaoRepository
      .getProfessionalBalance({ professional_id: profId, tenant_id: tenantId || null })
      .then((saldo) => {
        if (cancelled) return;
        setBalance(saldo);

        const valeEmAberto = Math.max(0, saldo.advances_open_amount || 0);
        const creditoEmAberto = Math.max(0, saldo.credits_open_amount || 0);
        if (valeEmAberto > 0 || creditoEmAberto > 0) {
          const pendente = Math.max(0, professional.pending_sum || 0);
          const abateSugerido = maxSafeAdvance(valeEmAberto, pendente + creditoEmAberto);
          const liquidoSugerido = Math.max(0, pendente - abateSugerido + creditoEmAberto);
          setAdvanceAmount(formatCurrencyInput(abateSugerido));
          setCreditAmount(formatCurrencyInput(creditoEmAberto));
          setAmount(formatCurrencyInput(liquidoSugerido));
        }
      })
      .catch(() => {
        // Falha ao consultar vale/gorjeta em aberto não deve bloquear a quitação normal.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional, isOpen]);

  if (!isOpen || !professional) return null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(formatCurrencyInput(e.target.value));
  };

  const handleAdvanceAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAdvanceAmount(formatCurrencyInput(e.target.value));
  };

  const handleCreditAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCreditAmount(formatCurrencyInput(e.target.value));
  };

  const handleQuitarTudo = () => {
    const totalPendente = Math.max(0, professional.pending_sum || 0);
    setAmount(formatCurrencyInput(totalPendente));
  };

  const handleAbaterValeTudo = () => {
    const totalPendente = Math.max(0, professional.pending_sum || 0);
    const credito = parseCurrencyInput(creditAmount);
    const abate = maxSafeAdvance(valeAberto, totalPendente + credito);
    setAdvanceAmount(formatCurrencyInput(abate));
    setAmount(formatCurrencyInput(Math.max(0, totalPendente - abate + credito)));
  };

  const handleReceberGorjetaTudo = () => {
    const totalPendente = Math.max(0, professional.pending_sum || 0);
    const abate = parseCurrencyInput(advanceAmount);
    setCreditAmount(formatCurrencyInput(gorjetaAberta));
    setAmount(formatCurrencyInput(Math.max(0, totalPendente - abate + gorjetaAberta)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    const valorNumerico = parseCurrencyInput(amount);
    const abateNumerico = parseCurrencyInput(advanceAmount);
    const creditoNumerico = parseCurrencyInput(creditAmount);

    if (valorNumerico <= 0 && abateNumerico <= 0) {
      setErrorMsg('Informe um valor de quitação ou de abate de vale maior que zero.');
      setIsSubmitting(false);
      return;
    }

    if (abateNumerico > valeAberto) {
      setErrorMsg('O valor do abate excede o saldo de vale em aberto do profissional.');
      setIsSubmitting(false);
      return;
    }

    if (creditoNumerico > gorjetaAberta) {
      setErrorMsg('O valor do crédito excede o saldo de gorjeta em aberto do profissional.');
      setIsSubmitting(false);
      return;
    }

    if (creditoNumerico > valorNumerico) {
      setErrorMsg('O valor do crédito de gorjeta não pode exceder o valor total do repasse.');
      setIsSubmitting(false);
      return;
    }

    if (paymentMethod === 'cash' && !activeCashSessionId) {
      setErrorMsg('Abra o caixa do turno antes de quitar comissão em dinheiro.');
      setIsSubmitting(false);
      return;
    }

    try {
      const dateTimestamp = paidAtDate
        ? new Date(`${paidAtDate}T12:00:00Z`).toISOString()
        : new Date().toISOString();

      await comissaoRepository.registerPayout({
        professional_id: profId,
        amount: valorNumerico,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        paid_at: dateTimestamp,
        tenant_id: tenantId || null,
        cash_session_id: paymentMethod === 'cash' ? activeCashSessionId : null,
        advance_amount: abateNumerico,
        credit_amount: creditoNumerico,
      });

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível registrar o pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[rgba(20,17,15,0.55)] backdrop-blur-[8px] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-quitacao-comissao-title"
    >
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-[500px] shadow-xl overflow-hidden animate-dialog-in">
        <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-bg-secondary">
          <div>
            <h3 id="modal-quitacao-comissao-title" className="text-lg font-extrabold text-text-primary m-0 tracking-tight">
              Quitação de comissão
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Realize o pagamento de comissão para <strong className="text-brand-primary font-bold">{profName}</strong> e mantenha o saldo em dia.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary p-[0.35rem] rounded-sm transition-all duration-200 bg-transparent border-none cursor-pointer flex items-center justify-center hover:text-text-primary hover:bg-bg-primary"
            aria-label="Fechar modal"
            type="button"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* Resumo da Produção do Profissional */}
        <div className="bg-bg-primary border-b border-border px-6 py-4 flex flex-col gap-[0.45rem]">
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary font-semibold">Comissão total faturada no período:</span>
            <span className="text-text-primary tabular-nums font-bold">{formatCurrency(professional.commission_sum)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary font-semibold">Total já repassado anteriormente:</span>
            <span className="text-text-primary tabular-nums font-bold text-success">{formatCurrency(professional.paid_sum)}</span>
          </div>
          <div className="flex justify-between items-center text-xs border-t border-dashed border-border pt-2 mt-1">
            <span className="text-text-secondary font-semibold font-semibold">Saldo pendente para quitação:</span>
            <span className="text-text-primary tabular-nums font-bold text-brand-primary text-sm font-extrabold">
              {formatCurrency(professional.pending_sum)}
            </span>
          </div>
          {valeAberto > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondary font-semibold">Vale em aberto do profissional:</span>
              <span className="text-text-primary tabular-nums font-bold">{formatCurrency(valeAberto)}</span>
            </div>
          )}
          {gorjetaAberta > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-secondary font-semibold">Gorjeta em aberto do profissional:</span>
              <span className="text-text-primary tabular-nums font-bold text-success">{formatCurrency(gorjetaAberta)}</span>
            </div>
          )}
          {(valeAberto > 0 || gorjetaAberta > 0) && (
            <div className="flex justify-between items-center text-xs border-t border-dashed border-border pt-2 mt-1">
              <span className="text-text-secondary font-semibold font-semibold">Líquido sugerido (comissão + gorjeta − vale):</span>
              <span className="text-text-primary tabular-nums font-bold text-brand-primary text-sm font-extrabold">
                {formatCurrency(Math.max(0, balance?.suggested_net_amount ?? professional.pending_sum))}
              </span>
            </div>
          )}
        </div>

        {/* Formulário de Quitação */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-[1.15rem] bg-bg-secondary">
          <div className="flex flex-col gap-[0.4rem]">
            <div className="flex items-center justify-between">
              <label htmlFor="payout-amount-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
                Valor do repasse (R$) *
              </label>
              <button
                type="button"
                onClick={handleQuitarTudo}
                className="text-xs text-brand-primary bg-transparent border-none cursor-pointer font-bold underline transition-colors duration-200 hover:text-brand-hover"
              >
                Preencher saldo total pendente
              </button>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-[1.15rem] text-brand-primary font-extrabold text-lg">R$</span>
              <input
                id="payout-amount-input"
                type="text"
                className="w-full bg-bg-secondary border-[1.5px] border-border rounded-md py-3 pr-4 pl-13 text-text-primary text-[1.35rem] font-extrabold tabular-nums outline-none transition-all duration-200 focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.15)]"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          {valeAberto > 0 && (
            <div className="flex flex-col gap-[0.4rem]">
              <div className="flex items-center justify-between">
                <label htmlFor="payout-advance-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
                  Abater vale em aberto (R$)
                </label>
                <button
                  type="button"
                  onClick={handleAbaterValeTudo}
                  className="text-xs text-brand-primary bg-transparent border-none cursor-pointer font-bold underline transition-colors duration-200 hover:text-brand-hover"
                >
                  Abater vale total ({formatCurrency(valeAberto)})
                </button>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-[1.15rem] text-brand-primary font-extrabold text-lg">R$</span>
                <input
                  id="payout-advance-input"
                  type="text"
                  className="w-full bg-bg-secondary border-[1.5px] border-border rounded-md py-3 pr-4 pl-13 text-text-primary text-[1.35rem] font-extrabold tabular-nums outline-none transition-all duration-200 focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.15)]"
                  value={advanceAmount}
                  onChange={handleAdvanceAmountChange}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          {gorjetaAberta > 0 && (
            <div className="flex flex-col gap-[0.4rem]">
              <div className="flex items-center justify-between">
                <label htmlFor="payout-credit-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
                  Receber gorjeta em aberto (R$)
                </label>
                <button
                  type="button"
                  onClick={handleReceberGorjetaTudo}
                  className="text-xs text-brand-primary bg-transparent border-none cursor-pointer font-bold underline transition-colors duration-200 hover:text-brand-hover"
                >
                  Receber gorjeta total ({formatCurrency(gorjetaAberta)})
                </button>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-[1.15rem] text-brand-primary font-extrabold text-lg">R$</span>
                <input
                  id="payout-credit-input"
                  type="text"
                  className="w-full bg-bg-secondary border-[1.5px] border-border rounded-md py-3 pr-4 pl-13 text-text-primary text-[1.35rem] font-extrabold tabular-nums outline-none transition-all duration-200 focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.15)]"
                  value={creditAmount}
                  onChange={handleCreditAmountChange}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Forma de pagamento *"
              id="payout-method-select"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              required
            >
              <option value="pix">PIX (transferência instantânea)</option>
              <option value="cash" disabled={!activeCashSessionId}>
                Dinheiro em espécie (retirado da gaveta){!activeCashSessionId ? ' — abra o caixa do turno' : ''}
              </option>
              <option value="transfer">Transferência bancária (TED ou DOC)</option>
              <option value="other">Outra forma de pagamento</option>
            </Select>

            <div className="flex flex-col gap-[0.4rem]">
              <label htmlFor="payout-date-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
                Data do repasse *
              </label>
              <input
                id="payout-date-input"
                type="date"
                className="w-full bg-bg-secondary border border-border rounded-md px-[0.85rem] py-[0.65rem] text-text-primary text-sm font-semibold outline-none cursor-pointer transition-all duration-200 focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.15)]"
                value={paidAtDate}
                onChange={(e) => setPaidAtDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-[0.4rem]">
            <label htmlFor="payout-notes-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
              Observações ou comprovante (opcional)
            </label>
            <textarea
              id="payout-notes-input"
              className="w-full bg-bg-secondary border border-border rounded-md px-[0.85rem] py-[0.65rem] text-text-primary text-sm outline-none resize-none transition-all duration-200 focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(217,108,0,0.15)]"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Quitação semanal referente aos cortes de 10 a 16/08..."
            />
          </div>

          {errorMsg && (
            <div className="bg-[rgba(240,82,82,0.1)] border border-[rgba(240,82,82,0.25)] text-error px-[0.85rem] py-[0.65rem] rounded-md text-xs flex items-center gap-2" role="alert">
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-2 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-[0.65rem] text-text-primary bg-bg-primary border border-border rounded-md text-sm font-bold cursor-pointer transition-all duration-200 hover:not-disabled:border-brand-primary hover:not-disabled:text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-[1.35rem] py-[0.65rem] text-brand-lightest bg-brand-primary border-none rounded-md text-sm font-bold cursor-pointer flex items-center gap-2 shadow-sm transition-all duration-200 hover:not-disabled:bg-brand-hover hover:not-disabled:-translate-y-px hover:not-disabled:shadow-[0_4px_12px_rgba(217,108,0,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};
