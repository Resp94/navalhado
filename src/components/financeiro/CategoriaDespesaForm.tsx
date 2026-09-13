import React, { useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Button } from '../ui/forms/Button';
import {
  PlanoContasConflictError,
  PlanoContasValidationError,
  type PlanoContasRepository,
} from '../../modules/plano-contas/PlanoContasRepository';
import type { CategoriaDespesa } from '../../modules/plano-contas/types';

export interface CategoriaDespesaFormProps {
  /** Repositório injetado (Supabase em produção, em memória nos testes). */
  repository: PlanoContasRepository;
  tenantId: string;
  /** Presente = renomear esta categoria; ausente = criar uma nova. Sem prop booleana de modo. */
  categoria?: CategoriaDespesa | null;
  /** Devolve o registro salvo (criado, renomeado ou reativado a partir de um conflito). */
  onSalvar: (categoria: CategoriaDespesa) => void;
  onCancelar?: () => void;
}

interface ConflitoState {
  message: string;
  existingId: string;
  existingName: string;
  archived: boolean;
}

/**
 * Formulário de Categoria de Despesa (ticket 04/035): componente autônomo,
 * independente da aba que o compõe. Recebe valores iniciais (a categoria a
 * renomear, quando houver) e o repositório, e devolve o registro salvo.
 *
 * Quando a gravação esbarra num nome já existente, o formulário resolve o
 * conflito "ali mesmo" — só na criação: se a categoria existente está
 * arquivada, oferece reativá-la (o que também devolve o registro salvo via
 * onSalvar); se está ativa, apenas informa que já existe e qual é. Ao
 * renomear, a oferta de reativar fica fora: reativar a categoria colidida
 * não tem relação com a que está sendo renomeada, e o formulário trataria
 * isso como se a renomeação tivesse sido salva — a tela só informa o
 * conflito, arquivada ou ativa.
 */
export const CategoriaDespesaForm: React.FC<CategoriaDespesaFormProps> = ({
  repository,
  tenantId,
  categoria,
  onSalvar,
  onCancelar,
}) => {
  const [name, setName] = useState(categoria?.name || '');
  const [saving, setSaving] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflito, setConflito] = useState<ConflitoState | null>(null);

  const isEdicao = Boolean(categoria);
  const busy = saving || reactivating;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setConflito(null);
    setSaving(true);
    try {
      const salvo = isEdicao
        ? await repository.renomearCategoriaDespesa(tenantId, categoria!.id, name)
        : await repository.criarCategoriaDespesa(tenantId, name);
      onSalvar(salvo);
    } catch (err) {
      if (err instanceof PlanoContasConflictError) {
        setConflito({
          message: err.message,
          existingId: err.existingId,
          existingName: err.existingName,
          archived: err.archived,
        });
      } else if (err instanceof PlanoContasValidationError) {
        setError(err.message);
      } else {
        setError('Não foi possível salvar a categoria de despesa.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReativar = async () => {
    if (!conflito) return;
    setReactivating(true);
    setError(null);
    try {
      const reativada = await repository.reativarCategoriaDespesa(tenantId, conflito.existingId);
      onSalvar(reativada);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reativar a categoria.');
    } finally {
      setReactivating(false);
    }
  };

  return (
    <form className="categoria-despesa-form" onSubmit={handleSubmit}>
      <Input
        label="Nome da categoria"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ex: Marketing"
        maxLength={60}
        autoFocus
        disabled={busy}
        error={error || undefined}
      />

      {conflito && (
        <div className="categoria-despesa-form-conflito" role="alert">
          <p>
            {conflito.archived
              ? `Já existe uma categoria arquivada chamada "${conflito.existingName}".`
              : `Já existe uma categoria ativa chamada "${conflito.existingName}".`}
          </p>
          {/* Oferecer reativar só na criação: reativar aqui reativaria um registro sem relação
              com o que está sendo editado, e o formulário trataria isso como se a renomeação
              tivesse sido salva (spec 035: "Conflito na criação... oferece reativá-la ali
              mesmo" — escopo explícito de criação, não de renomeação). */}
          {!isEdicao && conflito.archived && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={reactivating}
              disabled={saving}
              onClick={handleReativar}
            >
              Reativar &ldquo;{conflito.existingName}&rdquo;
            </Button>
          )}
        </div>
      )}

      <div className="categoria-despesa-form-actions">
        {onCancelar && (
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={busy}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" loading={saving} disabled={reactivating}>
          {isEdicao ? 'Salvar' : 'Criar categoria'}
        </Button>
      </div>

      <style>{`
        .categoria-despesa-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .categoria-despesa-form-conflito {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          align-items: flex-start;
          background-color: var(--color-brand-lightest, #FFF1E6);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
        }

        .categoria-despesa-form-conflito p {
          margin: 0;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .categoria-despesa-form-conflito {
          background-color: rgba(217, 108, 0, 0.15);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #FFF1E6);
        }

        .dark-theme .categoria-despesa-form-conflito p {
          color: var(--color-text-primary, #FFF1E6);
        }

        .categoria-despesa-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
      `}</style>
    </form>
  );
};
