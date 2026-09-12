import React, { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Coins01Icon } from '@hugeicons/core-free-icons';
import { formatCurrency } from '../../lib/currency';
import { ComissaoRepository } from '../../modules/comissoes/ComissaoRepository';
import { SupabaseComissaoAdapter } from '../../modules/comissoes/adapters/SupabaseComissaoAdapter';
import type { ProfessionalAccountStatement, ProfessionalAccountStatementEntry } from '../../modules/comissoes/types';

const comissaoRepository = new ComissaoRepository(new SupabaseComissaoAdapter());

interface ExtratoContaProfissionalModalProps {
  isOpen: boolean;
  professional: { id: string; name: string } | null;
  tenantId?: string;
  onClose: () => void;
}

const KIND_LABELS: Record<string, string> = {
  vale: 'Vale',
  gorjeta: 'Gorjeta',
  quitacao: 'Quitação',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Em aberto',
  partially_paid: 'Parcialmente liquidado',
  settled: 'Liquidado',
  paid: 'Pago',
  reversed: 'Estornado',
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusClass(status: string): string {
  if (status === 'reversed') return 'extrato-conta-status--reversed';
  if (status === 'settled' || status === 'paid') return 'extrato-conta-status--settled';
  if (status === 'partially_paid') return 'extrato-conta-status--partial';
  return 'extrato-conta-status--open';
}

const EntryRow: React.FC<{ entry: ProfessionalAccountStatementEntry }> = ({ entry }) => {
  const isReversed = entry.status === 'reversed' || !!entry.reversed_at;
  const kindLabel = KIND_LABELS[entry.kind] || entry.kind;
  const statusLabel = STATUS_LABELS[entry.status] || entry.status;

  return (
    <li className={`extrato-conta-entry ${isReversed ? 'extrato-conta-entry--reversed' : ''}`}>
      <div className="extrato-conta-entry-main">
        <div className="extrato-conta-entry-kind">
          <span className="extrato-conta-kind-tag">{kindLabel}</span>
          <span className={`extrato-conta-status ${statusClass(entry.status)}`}>{statusLabel}</span>
        </div>
        <span className={`extrato-conta-amount extrato-conta-amount--${entry.direction}`}>
          {entry.direction === 'credit' ? '+' : '−'} {formatCurrency(entry.amount)}
        </span>
      </div>
      <div className="extrato-conta-entry-meta">
        <span>{entry.reason || 'Sem motivo registrado'}</span>
        <span className="extrato-conta-entry-date">{formatDateTime(entry.created_at)}</span>
      </div>
      {entry.kind === 'quitacao' && (entry.advance_amount || entry.credit_amount) ? (
        <div className="extrato-conta-entry-breakdown">
          {!!entry.advance_amount && <span>Abateu {formatCurrency(entry.advance_amount)} de vale</span>}
          {!!entry.credit_amount && <span>Recebeu {formatCurrency(entry.credit_amount)} de gorjeta</span>}
        </div>
      ) : null}
      {isReversed && (
        <div className="extrato-conta-entry-reversal">
          Estornado em {formatDateTime(entry.reversed_at)}
          {entry.reversal_reason ? `: ${entry.reversal_reason}` : ''}
        </div>
      )}
    </li>
  );
};

/**
 * Extrato cronológico da Conta do Profissional (ticket 08 da spec 034).
 *
 * Contrato único para gestor e profissional: a política de acesso do próprio RPC decide o
 * que cada um vê, não duas implementações desta tela.
 */
export const ExtratoContaProfissionalModal: React.FC<ExtratoContaProfissionalModalProps> = ({
  isOpen,
  professional,
  tenantId,
  onClose,
}) => {
  const [statement, setStatement] = useState<ProfessionalAccountStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !professional) {
      setStatement(null);
      setErrorMsg(null);
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMsg(null);

    comissaoRepository
      .getProfessionalStatement({ professional_id: professional.id, tenant_id: tenantId || null })
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
  }, [isOpen, professional, tenantId]);

  if (!isOpen || !professional) return null;

  const balance = statement?.current_balance;

  return (
    <div className="extrato-conta-overlay" role="dialog" aria-modal="true" aria-labelledby="extrato-conta-title">
      <div className="extrato-conta-shell">
        <div className="extrato-conta-header">
          <div>
            <h3 id="extrato-conta-title" className="extrato-conta-title">
              <HugeiconsIcon icon={Coins01Icon} size={18} />
              Extrato da conta
            </h3>
            <p className="extrato-conta-subtitle">
              Vales, gorjetas e quitações de <strong>{professional.name}</strong>, em ordem cronológica.
            </p>
          </div>
          <button type="button" onClick={onClose} className="extrato-conta-close-btn" aria-label="Fechar extrato">
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {loading && (
          <div className="extrato-conta-notice" role="status">
            Carregando extrato...
          </div>
        )}
        {errorMsg && (
          <div className="extrato-conta-notice extrato-conta-notice--error" role="alert">
            {errorMsg}
          </div>
        )}

        {balance && (
          <div className="extrato-conta-balance">
            <div className="extrato-conta-balance-item">
              <span>Vale em aberto</span>
              <strong>{formatCurrency(balance.advances_open_amount || 0)}</strong>
            </div>
            <div className="extrato-conta-balance-item">
              <span>Gorjeta em aberto</span>
              <strong>{formatCurrency(balance.credits_open_amount || 0)}</strong>
            </div>
            <div className="extrato-conta-balance-item extrato-conta-balance-item--highlight">
              <span>Líquido sugerido</span>
              <strong>{formatCurrency(balance.suggested_net_amount ?? balance.current_open_balance)}</strong>
            </div>
          </div>
        )}

        {statement && (
          statement.entries.length === 0 ? (
            <p className="extrato-conta-empty">Nenhum lançamento na conta deste profissional ainda.</p>
          ) : (
            <ul className="extrato-conta-list">
              {statement.entries.map((entry) => (
                <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} />
              ))}
            </ul>
          )
        )}
      </div>

      <style>{`
        .extrato-conta-overlay {
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
        .extrato-conta-shell {
          background: var(--color-bg-secondary, #ffffff);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-lg, 1rem);
          width: 100%;
          max-width: 560px;
          max-height: 88vh;
          overflow-y: auto;
          box-shadow: var(--shadow-xl, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
          padding: 1.25rem 1.5rem 1.5rem;
        }
        .extrato-conta-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .extrato-conta-title {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--color-text-primary, #2D231E);
          margin: 0;
        }
        .extrato-conta-subtitle {
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
          margin-top: 0.25rem;
        }
        .extrato-conta-close-btn {
          color: var(--color-text-secondary, #70625B);
          padding: 0.35rem;
          border-radius: var(--radius-sm, 0.375rem);
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .extrato-conta-close-btn:hover {
          color: var(--color-text-primary, #2D231E);
          background: var(--color-bg-primary, #FFF1E6);
        }
        .extrato-conta-notice {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
          padding: 0.75rem;
          text-align: center;
        }
        .extrato-conta-notice--error {
          color: var(--color-error, #F05252);
        }
        .extrato-conta-balance {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          background: var(--color-bg-primary, #FFF1E6);
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.75rem 1rem;
          margin-bottom: 1rem;
        }
        .extrato-conta-balance-item {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
        }
        .extrato-conta-balance-item strong {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
          font-variant-numeric: tabular-nums;
        }
        .extrato-conta-balance-item--highlight strong {
          color: var(--color-brand-primary, #D96C00);
          font-weight: 800;
        }
        .extrato-conta-empty {
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-secondary, #70625B);
          text-align: center;
          padding: 1.5rem 0;
        }
        .extrato-conta-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .extrato-conta-entry {
          border: 1px solid var(--color-border, #EADED6);
          border-radius: var(--radius-md, 0.5rem);
          padding: 0.65rem 0.85rem;
        }
        .extrato-conta-entry--reversed {
          opacity: 0.75;
          background: var(--color-bg-primary, #FFF1E6);
        }
        .extrato-conta-entry-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .extrato-conta-entry-kind {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .extrato-conta-kind-tag {
          font-size: var(--font-size-xs, 0.75rem);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-text-primary, #2D231E);
        }
        .extrato-conta-status {
          font-size: 0.7rem;
          font-weight: 700;
          padding: 0.1rem 0.5rem;
          border-radius: 999px;
        }
        .extrato-conta-status--open {
          background: rgba(217, 108, 0, 0.12);
          color: var(--color-brand-primary, #D96C00);
        }
        .extrato-conta-status--partial {
          background: rgba(217, 108, 0, 0.12);
          color: var(--color-brand-primary, #D96C00);
        }
        .extrato-conta-status--settled {
          background: rgba(14, 159, 110, 0.12);
          color: var(--color-success, #0E9F6E);
        }
        .extrato-conta-status--reversed {
          background: rgba(240, 82, 82, 0.12);
          color: var(--color-error, #F05252);
        }
        .extrato-conta-amount {
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .extrato-conta-amount--credit {
          color: var(--color-success, #0E9F6E);
        }
        .extrato-conta-amount--debit {
          color: var(--color-error, #F05252);
        }
        .extrato-conta-entry-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-top: 0.35rem;
          font-size: var(--font-size-xs, 0.8125rem);
          color: var(--color-text-secondary, #70625B);
        }
        .extrato-conta-entry-date {
          white-space: nowrap;
        }
        .extrato-conta-entry-breakdown {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.35rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary, #70625B);
        }
        .extrato-conta-entry-reversal {
          margin-top: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-error, #F05252);
        }
      `}</style>
    </div>
  );
};
