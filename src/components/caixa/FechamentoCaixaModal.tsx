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
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
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
  /** Repasses de comissão e vales pagos em dinheiro no turno: descontam a gaveta junto com as
   * sangrias. Vêm do mesmo contrato que `expectedDrawerAmount` (ticket 02/036). */
  repassesComissaoTotal?: number;
  valesTotal?: number;
  /**
   * Valor esperado da gaveta, lido do contrato de apuração do banco (ticket 02/036). Quando
   * omitido, o modal busca via `caixaRepo.getExpectedDrawerAmount`, como faz com `turnSummary` e
   * as movimentações. Nunca é recomposto no navegador: a diferença mostrada aqui é a que o
   * fechamento persiste.
   */
  expectedDrawerAmount?: number;
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
  repassesComissaoTotal,
  valesTotal,
  expectedDrawerAmount,
  onCaixaFechado,
  onClose,
  caixaRepo,
}) => {
  const [closingAmount, setClosingAmount] = useState<string>('0,00');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [turnSummary, setTurnSummary] = useState<TurnPaymentsSummary | undefined>(initialTurnSummary);
  const [contractExpectedAmount, setContractExpectedAmount] = useState<number | undefined>(expectedDrawerAmount);
  const [contractRepasses, setContractRepasses] = useState<number>(repassesComissaoTotal ?? 0);
  const [contractVales, setContractVales] = useState<number>(valesTotal ?? 0);
  // Distingue "ainda buscando" de "falhou": nos dois casos `contractExpectedAmount` fica
  // `undefined`, mas só o segundo precisa de aviso e opção de tentar de novo (achado de revisão:
  // sem isso um R$ 0,00 por falha de rede parece um valor apurado numa tela de dinheiro físico).
  const [expectedAmountFailed, setExpectedAmountFailed] = useState(false);

  const defaultRepo = useMemo(() => new CaixaRepository(new SupabaseCaixaAdapter()), []);
  const repo = caixaRepo || defaultRepo;

  useEffect(() => {
    setContractExpectedAmount(expectedDrawerAmount);
  }, [expectedDrawerAmount]);

  useEffect(() => {
    setContractRepasses(repassesComissaoTotal ?? 0);
  }, [repassesComissaoTotal]);

  useEffect(() => {
    setContractVales(valesTotal ?? 0);
  }, [valesTotal]);

  useEffect(() => {
    if (isOpen && session) {
      if (initialTurnSummary) {
        setTurnSummary(initialTurnSummary);
      } else {
        repo.getTurnPaymentsSummary(session.tenant_id, session.opened_at, session.id)
          .then((res) => setTurnSummary(res))
          .catch((err) => console.error('Erro ao carregar resumo de pagamentos no fechamento:', err));
      }

      // Valor esperado da gaveta pelo contrato único de apuração do banco (ticket 02/036): sem
      // formula local, para que a diferença mostrada aqui seja a que o fechamento persiste. Os
      // repasses de comissão e vales em dinheiro (que descontam a gaveta junto com as sangrias)
      // vêm do mesmo detalhamento por tipo do contrato.
      if (expectedDrawerAmount === undefined) {
        void fetchExpectedAmount(session);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, session, initialTurnSummary, expectedDrawerAmount, repo]);

  const fetchExpectedAmount = async (currentSession: CashSession) => {
    try {
      const res = await repo.getExpectedDrawerAmount(currentSession.id, currentSession.tenant_id);
      setContractExpectedAmount(res?.expected_amount ?? 0);
      const movements = res?.movements_by_type ?? [];
      setContractRepasses(
        movements.filter((m) => m.type === 'repasse_comissao').reduce((sum, m) => sum + m.amount, 0)
      );
      setContractVales(
        movements.filter((m) => m.type === 'vale_profissional').reduce((sum, m) => sum + m.amount, 0)
      );
      setExpectedAmountFailed(false);
    } catch (err) {
      // Nunca cai para 0: `contractExpectedAmount` permanece `undefined`, o que a tela trata como
      // "indisponível", não como um valor apurado.
      console.error('Erro ao carregar valor esperado da gaveta no fechamento:', err);
      setExpectedAmountFailed(true);
    }
  };

  if (!isOpen || !session) return null;

  const totalTurnRevenue = turnSummary?.total ?? cashReceipts;
  const cashInTurn = turnSummary?.dinheiro ?? cashReceipts;
  const pixInTurn = turnSummary?.pix ?? 0;
  const cardInTurn = turnSummary?.cartao ?? 0;

  const initialAmount = Number(session.initial_amount) || 0;
  const expectedAmount = contractExpectedAmount ?? 0;

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
        tenant_id: session.tenant_id,
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
      className="fixed inset-0 z-[9999] bg-[rgba(20,17,15,0.55)] backdrop-blur-[8px] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-fechamento-caixa-title"
    >
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-[500px] max-h-[min(90dvh,720px)] flex flex-col shadow-xl overflow-hidden animate-dialog-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-secondary shrink-0">
          <div>
            <h3 id="modal-fechamento-caixa-title" className="text-lg font-extrabold text-text-primary m-0 tracking-tight leading-tight">
              Fechamento e conferência de caixa
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-text-primary p-[0.35rem] min-w-11 min-h-11 -mr-[0.35rem] rounded-sm transition-all duration-200 bg-transparent border-none cursor-pointer flex items-center justify-center shrink-0 hover:bg-[rgba(45,35,30,0.05)]"
            aria-label="Fechar modal"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {/* ─── RESUMO DE ARRECADAÇÃO GERAL DO TURNO ─── */}
        <div className="bg-bg-secondary border-b border-border px-6 py-4 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-[0.4rem] text-sm font-bold text-text-primary">
              <HugeiconsIcon icon={Invoice01Icon} size={15} />
              Total arrecadado no turno:
            </span>
            <span className="text-lg font-extrabold text-brand-primary tracking-tight">
              {formatCurrency(totalTurnRevenue)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-transparent border-none shadow-[0_0_0_0.888889px_var(--color-text-primary)] rounded-lg px-[0.6rem] py-[0.4rem] flex flex-col items-center text-center gap-[0.15rem]">
              <span className="text-[0.6875rem] font-semibold text-text-primary">Pix</span>
              <span className="text-[0.8125rem] font-bold text-text-primary">{formatCurrency(pixInTurn)}</span>
            </div>
            <div className="bg-transparent border-none shadow-[0_0_0_0.888889px_var(--color-text-primary)] rounded-lg px-[0.6rem] py-[0.4rem] flex flex-col items-center text-center gap-[0.15rem]">
              <span className="text-[0.6875rem] font-semibold text-text-primary">Cartões</span>
              <span className="text-[0.8125rem] font-bold text-text-primary">{formatCurrency(cardInTurn)}</span>
            </div>
            <div className="bg-transparent border-none shadow-[0_0_0_0.888889px_var(--color-text-primary)] rounded-lg px-[0.6rem] py-[0.4rem] flex flex-col items-center text-center gap-[0.15rem]">
              <span className="text-[0.6875rem] font-semibold text-text-primary">Dinheiro</span>
              <span className="text-[0.8125rem] font-bold text-text-primary">{formatCurrency(cashInTurn)}</span>
            </div>
          </div>
        </div>

        {/* ─── CONFERÊNCIA FÍSICA DA GAVETA ─── */}
        <div className="bg-transparent border-b border-border px-6 py-4 flex flex-col gap-[0.45rem] shrink-0">
          <div className="flex items-center gap-[0.35rem] text-xs font-bold text-text-primary uppercase tracking-wide mb-1 [&_svg]:stroke-text-primary [&_svg]:text-text-primary">
            <HugeiconsIcon icon={Coins01Icon} size={15} />
            <span>Conferência da gaveta (dinheiro físico)</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-primary font-semibold">Fundo de troco inicial:</span>
            <span className="text-text-primary tabular-nums font-bold">{formatCurrency(initialAmount)}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-primary font-semibold">(+) Entradas em dinheiro (espécie):</span>
            <span className="text-text-primary tabular-nums font-bold text-success">+{formatCurrency(cashInTurn)}</span>
          </div>
          {suprimentos > 0 ? (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-primary font-semibold">(+) Suprimentos (entradas avulsas):</span>
              <span className="text-text-primary tabular-nums font-bold text-success">+{formatCurrency(suprimentos)}</span>
            </div>
          ) : null}
          {sangrias > 0 ? (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-primary font-semibold">(-) Sangrias (retiradas):</span>
              <span className="text-text-primary tabular-nums font-bold text-error">-{formatCurrency(sangrias)}</span>
            </div>
          ) : null}
          {contractRepasses > 0 ? (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-primary font-semibold">(-) Repasses de comissão em dinheiro:</span>
              <span className="text-text-primary tabular-nums font-bold text-error">-{formatCurrency(contractRepasses)}</span>
            </div>
          ) : null}
          {contractVales > 0 ? (
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-primary font-semibold">(-) Vales em dinheiro:</span>
              <span className="text-text-primary tabular-nums font-bold text-error">-{formatCurrency(contractVales)}</span>
            </div>
          ) : null}
          <div className="flex justify-between items-center text-xs border-t border-dashed border-border pt-2 mt-1">
            <span className="text-text-primary font-semibold font-bold">Total em dinheiro esperado na gaveta:</span>
            <span className="text-text-primary tabular-nums font-bold text-brand-primary text-sm">
              {contractExpectedAmount === undefined
                ? (expectedAmountFailed ? 'Indisponível' : 'Calculando…')
                : formatCurrency(expectedAmount)}
            </span>
          </div>
          {expectedAmountFailed ? (
            <div className="flex justify-between items-center text-xs" role="alert">
              <span className="text-error font-semibold">
                Não foi possível apurar o valor esperado da gaveta. A conferência abaixo fica
                indisponível até a apuração ser refeita.
              </span>
              <button
                type="button"
                className="text-error underline-offset-2 hover:underline bg-transparent border-none cursor-pointer p-0"
                onClick={() => session && void fetchExpectedAmount(session)}
              >
                Tentar novamente
              </button>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleConfirm} className="px-6 py-5 flex flex-col gap-[1.15rem] bg-bg-secondary overflow-y-auto">
          <div className="flex flex-col gap-[0.4rem]">
            <label htmlFor="closing-amount-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
              Valor total em dinheiro contado na gaveta *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-[1.15rem] text-text-primary font-extrabold text-lg pointer-events-none">R$</span>
              <input
                id="closing-amount-input"
                type="text"
                className="w-full bg-bg-secondary border-none shadow-[0_0_0_2.11677px_var(--color-text-primary)] rounded-md py-3 pr-4 pl-13 text-text-primary text-[1.35rem] font-extrabold tabular-nums outline-none transition-all duration-200 focus:shadow-[0_0_0_3px_rgba(217,108,0,0.25)]"
                value={closingAmount}
                onChange={handleAmountChange}
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
          </div>

          {contractExpectedAmount === undefined ? (
            <div className="px-4 py-[0.85rem] rounded-md flex items-center gap-[0.65rem]">
              <span className="flex items-center justify-center shrink-0 [&_svg]:h-fit">
                <HugeiconsIcon icon={AlertCircleIcon} size={18} />
              </span>
              <span className="text-xs font-bold leading-snug text-text-primary">
                Conferência indisponível: o valor esperado da gaveta ainda não foi apurado.
              </span>
            </div>
          ) : (
            <div
              className={`px-4 py-[0.85rem] rounded-md flex items-center gap-[0.65rem] ${
                Math.abs(difference) < 0.01
                  ? 'bg-success-bg border border-[rgba(14,159,110,0.3)]'
                  : difference > 0
                  ? 'bg-[rgba(63,131,248,0.1)] border border-[rgba(63,131,248,0.3)]'
                  : 'bg-[rgba(240,82,82,0.1)] border border-[rgba(240,82,82,0.3)]'
              }`}
            >
              <span className="flex items-center justify-center shrink-0 [&_svg]:h-fit [&_svg_path]:stroke-text-primary">
                <HugeiconsIcon
                  icon={
                    Math.abs(difference) < 0.01
                      ? CheckmarkCircle02Icon
                      : AlertCircleIcon
                  }
                  size={18}
                />
              </span>
              <span className="text-xs font-bold leading-snug text-text-primary">
                {Math.abs(difference) < 0.01
                  ? 'Conferência exata. O valor contado bate perfeitamente com o esperado.'
                  : difference > 0
                  ? `Sobra de caixa identificada (+${formatCurrency(difference)}). O valor físico é maior que o registrado.`
                  : `Divergência de caixa identificada (${formatCurrency(difference)}). O valor físico é menor que o esperado.`}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-[0.4rem]">
            <label htmlFor="fechamento-notes-input" className="text-xs font-bold text-text-primary uppercase tracking-wide">
              Observações do fechamento (opcional)
            </label>
            <textarea
              id="fechamento-notes-input"
              className="w-full bg-bg-secondary border-none shadow-[0_0_0_0.888889px_var(--color-text-primary)] rounded-md px-[0.85rem] py-[0.65rem] text-text-primary text-sm outline-none resize-none transition-all duration-200 focus:shadow-[0_0_0_2px_var(--color-brand-primary)]"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Sobra referente a gorjeta ou arredondamento de troco..."
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
              className="px-5 py-[0.65rem] min-h-11 text-text-primary bg-transparent border-none shadow-[0_0_0_0.888889px_var(--color-text-primary)] rounded-md text-sm font-bold cursor-pointer transition-all duration-200 hover:not-disabled:bg-[rgba(45,35,30,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-[1.35rem] py-[0.65rem] min-h-11 text-text-primary bg-transparent border-none shadow-[0_0_0_1.5px_var(--color-error),var(--shadow-sm)] rounded-md text-sm font-bold cursor-pointer flex items-center gap-2 transition-all duration-200 [&_span]:text-text-primary [&_svg_path]:stroke-text-primary hover:not-disabled:bg-error-bg hover:not-disabled:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || contractExpectedAmount === undefined}
              title={
                contractExpectedAmount === undefined
                  ? 'Aguarde a apuração do valor esperado da gaveta para fechar o caixa.'
                  : undefined
              }
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
    </div>
  );
};
