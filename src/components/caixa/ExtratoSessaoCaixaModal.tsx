import React, { useEffect, useMemo, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Invoice01Icon } from '@hugeicons/core-free-icons';
import { CaixaRepository } from '../../modules/caixa/CaixaRepository';
import { SupabaseCaixaAdapter } from '../../modules/caixa/adapters/SupabaseCaixaAdapter';
import type { CashSession, CashSessionStatement } from '../../modules/caixa/types';
import { formatCurrency } from '../../lib/currency';

interface ExtratoSessaoCaixaModalProps {
  isOpen: boolean;
  session: CashSession | null;
  tenantId: string;
  tenantName?: string;
  onClose: () => void;
  caixaRepo?: CaixaRepository;
}

interface MovementSection {
  type: string;
  label: string;
  title: string;
  emptyLabel: string;
}

// Única fonte de verdade dos tipos com seção própria no extrato impresso: rótulo
// e apresentação nascem do mesmo item, então um tipo não pode ganhar rótulo sem
// ganhar seção (ou vice-versa) por engano. Um tipo fora desta lista (hoje ou no
// futuro) não some da folha: cai na seção "Outras movimentações" com um rótulo
// genérico pelo sentido (ticket 05 da spec 036).
const MOVEMENT_SECTIONS: MovementSection[] = [
  { type: 'suprimento', label: 'Suprimento', title: 'Suprimentos', emptyLabel: 'Nenhum suprimento no turno.' },
  { type: 'sangria', label: 'Sangria', title: 'Sangrias', emptyLabel: 'Nenhuma sangria no turno.' },
  {
    type: 'repasse_comissao',
    label: 'Repasse de comissão',
    title: 'Repasses de comissão',
    emptyLabel: 'Nenhum repasse no turno.',
  },
  {
    type: 'vale_profissional',
    label: 'Vale de profissional',
    title: 'Vales de profissional',
    emptyLabel: 'Nenhum vale no turno.',
  },
  {
    type: 'baixa_conta_pagar',
    label: 'Pagamento de conta',
    title: 'Pagamentos de conta',
    emptyLabel: 'Nenhum pagamento de conta no turno.',
  },
];

const MOVEMENT_LABELS: Record<string, string> = Object.fromEntries(
  MOVEMENT_SECTIONS.map((section) => [section.type, section.label])
);

const KNOWN_MOVEMENT_TYPES = new Set(MOVEMENT_SECTIONS.map((section) => section.type));

// Única consumidora restante de `.table-empty-notice` fora de CaixaTab/ComissoesTab (ticket 08/039).
const TABLE_EMPTY_NOTICE_CLASSES = 'px-4 py-10 text-center text-xs text-text-secondary';

function genericLabelByDirection(direction: string | undefined): string {
  return direction === 'entrada' ? 'Outra entrada' : 'Outra saída';
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Extrato imprimível de uma Sessão de Caixa (ticket 02 da spec 034).
 *
 * Consome o contrato get_cash_session_statement, que já existe no banco com privilégios
 * corretos e não era consumido por nenhuma superfície. Nenhuma escrita, nenhuma RPC nova.
 *
 * Movimentações estornadas são excluídas do extrato: um repasse de comissão estornado não
 * representa mais uma saída real da gaveta, seguindo a mesma regra que a validação de saldo
 * de gaveta na quitação já aplica no banco.
 */
export const ExtratoSessaoCaixaModal: React.FC<ExtratoSessaoCaixaModalProps> = ({
  isOpen,
  session,
  tenantId,
  tenantName,
  onClose,
  caixaRepo,
}) => {
  const [statement, setStatement] = useState<CashSessionStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaultRepo = useMemo(() => new CaixaRepository(new SupabaseCaixaAdapter()), []);
  const repo = caixaRepo || defaultRepo;

  useEffect(() => {
    if (!isOpen || !session) {
      setStatement(null);
      setErrorMsg(null);
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMsg(null);

    repo
      .getSessionStatement(session.id, tenantId)
      .then((data) => {
        if (active) setStatement(data);
      })
      .catch((err: unknown) => {
        if (active) {
          setErrorMsg(err instanceof Error ? err.message : 'Não foi possível carregar o extrato.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, session, tenantId, repo]);

  if (!isOpen || !session) return null;

  const activeMovements = (statement?.movements ?? []).filter((m) => !m.reversed_at);
  // Nenhum tipo futuro sem rótulo próprio some do papel em silêncio: cai aqui.
  const outrasMovimentacoes = activeMovements.filter((m) => !KNOWN_MOVEMENT_TYPES.has(m.type));

  const hasAdjustment = (statement?.adjustments.length ?? 0) > 0;
  const adjustmentsSum = (statement?.adjustments ?? []).reduce((sum, a) => sum + a.adjustment_amount, 0);
  const differenceAmount = hasAdjustment
    ? statement!.adjusted_difference_amount
    : session.difference_amount ?? 0;
  const closingAmount = hasAdjustment && session.closing_amount !== null
    ? session.closing_amount + adjustmentsSum
    : session.closing_amount;

  const handlePrint = () => window.print();

  return (
    <div
      className="fixed inset-0 bg-[rgba(15,15,20,0.55)] flex items-center justify-center z-[1000] p-4 print:static print:bg-none print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extrato-caixa-title"
    >
      <div className="bg-bg-secondary rounded-xl w-full max-w-[420px] max-h-[90vh] overflow-y-auto p-[1rem_1.25rem_1.5rem] print:max-w-none print:max-h-none print:overflow-visible print:rounded-none print:shadow-none print:p-0">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <h3 id="extrato-caixa-title" className="flex items-center gap-[0.4rem] text-base m-0">
            <HugeiconsIcon icon={Invoice01Icon} size={18} />
            Extrato da Sessão de Caixa
          </h3>
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !!errorMsg || !statement}
              className="border border-brand-primary bg-brand-primary text-white rounded-lg px-[0.9rem] py-[0.4rem] cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Imprimir
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar extrato" className="border-none bg-transparent cursor-pointer inline-flex">
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>
        </div>

        {loading && (
          <div className={`${TABLE_EMPTY_NOTICE_CLASSES} print:hidden`} role="status">
            Carregando extrato...
          </div>
        )}
        {errorMsg && (
          <div className={`${TABLE_EMPTY_NOTICE_CLASSES} print:hidden`} role="alert">
            {errorMsg}
          </div>
        )}

        {statement && (
          <div className="extrato-caixa-print-area print:absolute print:top-0 print:left-0 print:w-[80mm] print:text-[11px]">
            <header className="flex flex-col mb-2 text-center">
              <strong>{tenantName || 'Barbearia'}</strong>
              <span>Extrato de Sessão de Caixa</span>
            </header>

            <section className="mb-[0.85rem]">
              <p>Abertura: {formatDateTime(session.opened_at)}</p>
              <p>Fechamento: {formatDateTime(session.closed_at)}</p>
              <p>Operador: {session.closed_by_name || session.opened_by_name || '-'}</p>
              {hasAdjustment && (
                <p className="text-[0.8rem] font-semibold text-[#a15c00]" role="note">
                  Sessão ajustada após o fechamento — valores abaixo já refletem o ajuste
                </p>
              )}
            </section>

            <section className="mb-[0.85rem]">
              <h4 className="m-0 mb-[0.35rem] text-[0.85rem] uppercase tracking-wide text-text-secondary">Recebido por forma de pagamento</h4>
              <ul className="list-none m-0 p-0 text-[0.9rem] [&>li]:flex [&>li]:justify-between [&>li]:py-[0.15rem]">
                <li>
                  <span>Dinheiro</span>
                  <span>{formatCurrency(session.cash_received_amount || 0)}</span>
                </li>
                <li>
                  <span>PIX</span>
                  <span>{formatCurrency(session.pix_received_amount || 0)}</span>
                </li>
                <li>
                  <span>Cartão</span>
                  <span>{formatCurrency(session.card_received_amount || 0)}</span>
                </li>
                <li>
                  <span>Outros</span>
                  <span>{formatCurrency(session.other_received_amount || 0)}</span>
                </li>
              </ul>
            </section>

            {MOVEMENT_SECTIONS.map((section) => {
              const items = activeMovements.filter((m) => m.type === section.type);
              return (
                <section className="mb-[0.85rem]" key={section.type}>
                  <h4 className="m-0 mb-[0.35rem] text-[0.85rem] uppercase tracking-wide text-text-secondary">{section.title}</h4>
                  {items.length === 0 ? (
                    <p className="text-[0.85rem] text-text-secondary m-0">{section.emptyLabel}</p>
                  ) : (
                    <ul className="list-none m-0 p-0 text-[0.9rem] [&>li]:flex [&>li]:justify-between [&>li]:py-[0.15rem]">
                      {items.map((m) => (
                        <li key={m.id}>
                          <span>
                            {section.type === 'baixa_conta_pagar' && m.payable_description
                              ? `${section.label}: ${m.payable_description}`
                              : m.reason || section.label}
                          </span>
                          <span>{formatCurrency(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}

            {outrasMovimentacoes.length > 0 && (
              <section className="mb-[0.85rem]">
                <h4 className="m-0 mb-[0.35rem] text-[0.85rem] uppercase tracking-wide text-text-secondary">Outras movimentações</h4>
                <ul className="list-none m-0 p-0 text-[0.9rem] [&>li]:flex [&>li]:justify-between [&>li]:py-[0.15rem]">
                  {outrasMovimentacoes.map((m) => (
                    <li key={m.id}>
                      <span>{m.reason || MOVEMENT_LABELS[m.type] || genericLabelByDirection(m.direction)}</span>
                      <span>{formatCurrency(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mb-[0.85rem]">
              <h4 className="m-0 mb-[0.35rem] text-[0.85rem] uppercase tracking-wide text-text-secondary">Fechamento</h4>
              <ul className="list-none m-0 p-0 text-[0.9rem] [&>li]:flex [&>li]:justify-between [&>li]:py-[0.15rem]">
                <li>
                  <span>Fundo de troco inicial</span>
                  <span>{formatCurrency(session.initial_amount)}</span>
                </li>
                <li>
                  <span>Valor esperado</span>
                  <span>{session.expected_amount !== null ? formatCurrency(session.expected_amount) : '-'}</span>
                </li>
                <li>
                  <span>Valor contado na gaveta{hasAdjustment ? ' (ajustado)' : ''}</span>
                  <span>{closingAmount !== null ? formatCurrency(closingAmount) : '-'}</span>
                </li>
              </ul>
              <p
                className={
                  differenceAmount < 0
                    ? 'font-bold text-[#c0392b]'
                    : differenceAmount > 0
                      ? 'font-bold text-[#1e7e34]'
                      : 'font-bold'
                }
              >
                {differenceAmount < 0 ? 'Quebra de caixa' : differenceAmount > 0 ? 'Sobra de caixa' : 'Sem diferença'}:{' '}
                {formatCurrency(Math.abs(differenceAmount))}
              </p>
            </section>
          </div>
        )}
      </div>

      {/* Isolamento de impressão: esconder tudo no `body` fora da área imprimível é uma regra de
          documento inteiro (seletor `body *`), sem equivalente em utilitário Tailwind aplicado
          nesta árvore. Único `<style>` mantido neste modal, por essa razão. */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .extrato-caixa-print-area,
          .extrato-caixa-print-area * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
};
