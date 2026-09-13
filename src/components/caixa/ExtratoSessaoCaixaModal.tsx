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
];

const MOVEMENT_LABELS: Record<string, string> = Object.fromEntries(
  MOVEMENT_SECTIONS.map((section) => [section.type, section.label])
);

const KNOWN_MOVEMENT_TYPES = new Set(MOVEMENT_SECTIONS.map((section) => section.type));

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
    <div className="extrato-caixa-overlay" role="dialog" aria-modal="true" aria-labelledby="extrato-caixa-title">
      <div className="extrato-caixa-shell">
        <div className="extrato-caixa-header no-print">
          <h3 id="extrato-caixa-title" className="extrato-caixa-title">
            <HugeiconsIcon icon={Invoice01Icon} size={18} />
            Extrato da Sessão de Caixa
          </h3>
          <div className="extrato-caixa-header-actions">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !!errorMsg || !statement}
              className="extrato-caixa-print-btn"
            >
              Imprimir
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar extrato" className="extrato-caixa-close-btn">
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="table-empty-notice no-print" role="status">
            Carregando extrato...
          </div>
        )}
        {errorMsg && (
          <div className="table-empty-notice no-print" role="alert">
            {errorMsg}
          </div>
        )}

        {statement && (
          <div className="extrato-caixa-print-area">
            <header className="extrato-caixa-print-header">
              <strong>{tenantName || 'Barbearia'}</strong>
              <span>Extrato de Sessão de Caixa</span>
            </header>

            <section className="extrato-caixa-section">
              <p>Abertura: {formatDateTime(session.opened_at)}</p>
              <p>Fechamento: {formatDateTime(session.closed_at)}</p>
              <p>Operador: {session.closed_by_name || session.opened_by_name || '-'}</p>
              {hasAdjustment && (
                <p className="extrato-caixa-adjustment-flag" role="note">
                  Sessão ajustada após o fechamento — valores abaixo já refletem o ajuste
                </p>
              )}
            </section>

            <section className="extrato-caixa-section">
              <h4>Recebido por forma de pagamento</h4>
              <ul className="extrato-caixa-list">
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
                <section className="extrato-caixa-section" key={section.type}>
                  <h4>{section.title}</h4>
                  {items.length === 0 ? (
                    <p className="extrato-caixa-empty">{section.emptyLabel}</p>
                  ) : (
                    <ul className="extrato-caixa-list">
                      {items.map((m) => (
                        <li key={m.id}>
                          <span>{m.reason || section.label}</span>
                          <span>{formatCurrency(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}

            {outrasMovimentacoes.length > 0 && (
              <section className="extrato-caixa-section">
                <h4>Outras movimentações</h4>
                <ul className="extrato-caixa-list">
                  {outrasMovimentacoes.map((m) => (
                    <li key={m.id}>
                      <span>{m.reason || MOVEMENT_LABELS[m.type] || genericLabelByDirection(m.direction)}</span>
                      <span>{formatCurrency(m.amount)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="extrato-caixa-section">
              <h4>Fechamento</h4>
              <ul className="extrato-caixa-list">
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
                    ? 'extrato-caixa-quebra'
                    : differenceAmount > 0
                      ? 'extrato-caixa-sobra'
                      : 'extrato-caixa-sem-diferenca'
                }
              >
                {differenceAmount < 0 ? 'Quebra de caixa' : differenceAmount > 0 ? 'Sobra de caixa' : 'Sem diferença'}:{' '}
                {formatCurrency(Math.abs(differenceAmount))}
              </p>
            </section>
          </div>
        )}
      </div>

      <style>{`
        .extrato-caixa-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 15, 20, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .extrato-caixa-shell {
          background: var(--color-surface, #fff);
          border-radius: 12px;
          width: 100%;
          max-width: 420px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 1rem 1.25rem 1.5rem;
        }
        .extrato-caixa-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }
        .extrato-caixa-title {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 1rem;
          margin: 0;
        }
        .extrato-caixa-header-actions {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .extrato-caixa-print-btn {
          border: 1px solid var(--color-brand-primary, #333);
          background: var(--color-brand-primary, #333);
          color: #fff;
          border-radius: 8px;
          padding: 0.4rem 0.9rem;
          cursor: pointer;
          font-weight: 600;
        }
        .extrato-caixa-print-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .extrato-caixa-close-btn {
          border: none;
          background: transparent;
          cursor: pointer;
          display: inline-flex;
        }
        .extrato-caixa-section {
          margin-bottom: 0.85rem;
        }
        .extrato-caixa-section h4 {
          margin: 0 0 0.35rem;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: var(--color-text-secondary, #666);
        }
        .extrato-caixa-list {
          list-style: none;
          margin: 0;
          padding: 0;
          font-size: 0.9rem;
        }
        .extrato-caixa-list li {
          display: flex;
          justify-content: space-between;
          padding: 0.15rem 0;
        }
        .extrato-caixa-empty {
          font-size: 0.85rem;
          color: var(--color-text-secondary, #666);
          margin: 0;
        }
        .extrato-caixa-adjustment-flag {
          font-size: 0.8rem;
          font-weight: 600;
          color: #a15c00;
        }
        .extrato-caixa-quebra {
          font-weight: 700;
          color: #c0392b;
        }
        .extrato-caixa-sobra {
          font-weight: 700;
          color: #1e7e34;
        }
        .extrato-caixa-sem-diferenca {
          font-weight: 700;
        }
        .extrato-caixa-print-header {
          display: flex;
          flex-direction: column;
          margin-bottom: 0.5rem;
          text-align: center;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .extrato-caixa-print-area,
          .extrato-caixa-print-area * {
            visibility: visible;
          }
          .no-print {
            display: none !important;
          }
          .extrato-caixa-overlay {
            position: static;
            background: none;
            padding: 0;
          }
          .extrato-caixa-shell {
            max-width: none;
            max-height: none;
            overflow: visible;
            border-radius: 0;
            box-shadow: none;
            padding: 0;
          }
          .extrato-caixa-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 80mm;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
};
