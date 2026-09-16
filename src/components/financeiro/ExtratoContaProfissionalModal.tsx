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

function statusClasses(status: string): string {
  if (status === 'reversed') return 'bg-[rgba(240,82,82,0.12)] text-error';
  if (status === 'settled' || status === 'paid') return 'bg-[rgba(14,159,110,0.12)] text-success';
  if (status === 'partially_paid') return 'bg-[rgba(217,108,0,0.12)] text-brand-primary';
  return 'bg-[rgba(217,108,0,0.12)] text-brand-primary';
}

const EntryRow: React.FC<{ entry: ProfessionalAccountStatementEntry }> = ({ entry }) => {
  const isReversed = entry.status === 'reversed' || !!entry.reversed_at;
  const kindLabel = KIND_LABELS[entry.kind] || entry.kind;
  const statusLabel = STATUS_LABELS[entry.status] || entry.status;

  return (
    <li className={`border border-border rounded-md px-[0.85rem] py-[0.65rem] ${isReversed ? 'opacity-75 bg-bg-primary' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-text-primary">{kindLabel}</span>
          <span className={`text-[0.7rem] font-bold px-2 py-[0.1rem] rounded-full ${statusClasses(entry.status)}`}>{statusLabel}</span>
        </div>
        <span className={`font-extrabold tabular-nums whitespace-nowrap ${entry.direction === 'credit' ? 'text-success' : 'text-error'}`}>
          {entry.direction === 'credit' ? '+' : '−'} {formatCurrency(entry.amount)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-[0.35rem] text-xs text-text-secondary">
        <span>{entry.reason || 'Sem motivo registrado'}</span>
        <span className="whitespace-nowrap">{formatDateTime(entry.created_at)}</span>
      </div>
      {entry.kind === 'quitacao' && (entry.advance_amount || entry.credit_amount) ? (
        <div className="flex gap-3 mt-[0.35rem] text-xs text-text-secondary">
          {!!entry.advance_amount && <span>Abateu {formatCurrency(entry.advance_amount)} de vale</span>}
          {!!entry.credit_amount && <span>Recebeu {formatCurrency(entry.credit_amount)} de gorjeta</span>}
        </div>
      ) : null}
      {isReversed && (
        <div className="mt-[0.35rem] text-xs font-semibold text-error">
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
    <div
      className="fixed inset-0 z-[9999] bg-[rgba(20,17,15,0.55)] backdrop-blur-[8px] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extrato-conta-title"
    >
      <div className="bg-bg-secondary border border-border rounded-lg w-full max-w-[560px] max-h-[88vh] overflow-y-auto shadow-xl px-6 pt-5 pb-6 animate-dialog-in">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 id="extrato-conta-title" className="flex items-center gap-[0.4rem] text-lg font-extrabold text-text-primary m-0">
              <HugeiconsIcon icon={Coins01Icon} size={18} />
              Extrato da conta
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Vales, gorjetas e quitações de <strong>{professional.name}</strong>, em ordem cronológica.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-text-secondary p-[0.35rem] rounded-sm bg-transparent border-none cursor-pointer flex items-center justify-center shrink-0 hover:text-text-primary hover:bg-bg-primary" aria-label="Fechar extrato">
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </button>
        </div>

        {loading && (
          <div className="text-sm text-text-secondary p-3 text-center" role="status">
            Carregando extrato...
          </div>
        )}
        {errorMsg && (
          <div className="text-sm text-error p-3 text-center" role="alert">
            {errorMsg}
          </div>
        )}

        {balance && (
          <div className="grid grid-cols-3 gap-3 bg-bg-primary border border-border rounded-md px-4 py-3 mb-4">
            <div className="flex flex-col gap-[0.15rem] text-xs text-text-secondary">
              <span>Vale em aberto</span>
              <strong className="text-sm text-text-primary tabular-nums">{formatCurrency(balance.advances_open_amount || 0)}</strong>
            </div>
            <div className="flex flex-col gap-[0.15rem] text-xs text-text-secondary">
              <span>Gorjeta em aberto</span>
              <strong className="text-sm text-text-primary tabular-nums">{formatCurrency(balance.credits_open_amount || 0)}</strong>
            </div>
            <div className="flex flex-col gap-[0.15rem] text-xs text-text-secondary">
              <span>Líquido sugerido</span>
              <strong className="text-sm text-brand-primary font-extrabold tabular-nums">{formatCurrency(balance.suggested_net_amount ?? balance.current_open_balance)}</strong>
            </div>
          </div>
        )}

        {statement && (
          statement.entries.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-6">Nenhum lançamento na conta deste profissional ainda.</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-[0.6rem]">
              {statement.entries.map((entry) => (
                <EntryRow key={`${entry.kind}-${entry.id}`} entry={entry} />
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
};
