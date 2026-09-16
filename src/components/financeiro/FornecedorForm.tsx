import React, { useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Textarea } from '../ui/forms/Textarea';
import { Select } from '../ui/forms/Select';
import { Button } from '../ui/forms/Button';
import {
  PlanoContasConflictError,
  PlanoContasValidationError,
  type PlanoContasRepository,
} from '../../modules/plano-contas/PlanoContasRepository';
import { documentoValido, formatarDocumento, normalizarDocumento } from '../../modules/plano-contas/documento';
import type { CategoriaDespesa, Fornecedor } from '../../modules/plano-contas/types';

export interface FornecedorFormProps {
  /** Repositório injetado (Supabase em produção, em memória nos testes). */
  repository: PlanoContasRepository;
  tenantId: string;
  /** Presente = atualizar este fornecedor; ausente = criar um novo. Sem prop booleana de modo. */
  fornecedor?: Fornecedor | null;
  /** Só categorias ativas: a spec restringe a categoria padrão a uma Categoria de Despesa ativa. */
  categoriasAtivas: CategoriaDespesa[];
  /** Devolve o registro salvo (criado, atualizado ou reativado a partir de um conflito). */
  onSalvar: (fornecedor: Fornecedor) => void;
  onCancelar?: () => void;
}

interface ConflitoState {
  message: string;
  existingId: string;
  existingName: string;
  archived: boolean;
}

/**
 * Formulário de Fornecedor (ticket 06/035): componente autônomo,
 * independente da aba que o compõe. Recebe valores iniciais (o fornecedor a
 * atualizar, quando houver), o repositório e as categorias ativas do tenant
 * (para a categoria padrão), e devolve o registro salvo.
 *
 * Documento: formatado e validado enquanto o gestor digita, com o mesmo
 * algoritmo do banco (`documentoValido`). Conflito de nome ou documento: só
 * na criação oferece reativar o registro arquivado colidido -- na
 * atualização, reativar não tem relação com o que está sendo editado (mesma
 * decisão de `CategoriaDespesaForm`).
 */
export const FornecedorForm: React.FC<FornecedorFormProps> = ({
  repository,
  tenantId,
  fornecedor,
  categoriasAtivas,
  onSalvar,
  onCancelar,
}) => {
  const [name, setName] = useState(fornecedor?.name || '');
  const [documentInput, setDocumentInput] = useState(fornecedor?.document || '');
  const [phone, setPhone] = useState(fornecedor?.phone || '');
  const [email, setEmail] = useState(fornecedor?.email || '');
  const [notes, setNotes] = useState(fornecedor?.notes || '');
  const [defaultCategoryId, setDefaultCategoryId] = useState(fornecedor?.default_category_id || '');
  const [saving, setSaving] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [conflito, setConflito] = useState<ConflitoState | null>(null);

  const isEdicao = Boolean(fornecedor);
  const busy = saving || reactivating;

  const documentoNormalizado = normalizarDocumento(documentInput);
  const documentoCompleto = documentoNormalizado.length === 11 || documentoNormalizado.length === 14;

  const handleDocumentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalizado = normalizarDocumento(event.target.value);
    setDocumentError(null);
    if (normalizado.length === 11 || normalizado.length === 14) {
      setDocumentInput(formatarDocumento(normalizado));
      if (!documentoValido(normalizado)) {
        setDocumentError('CPF ou CNPJ inválido.');
      }
    } else {
      setDocumentInput(normalizado);
    }
  };

  const categoriaOptions = [
    { value: '', label: 'Sem categoria padrão' },
    ...categoriasAtivas.map((categoria) => ({ value: categoria.id, label: categoria.name })),
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setConflito(null);

    if (documentoCompleto && !documentoValido(documentoNormalizado)) {
      setDocumentError('CPF ou CNPJ inválido.');
      return;
    }

    setSaving(true);
    try {
      const dados = {
        name,
        document: documentoNormalizado || null,
        phone,
        email,
        notes,
        defaultCategoryId: defaultCategoryId || null,
      };
      const salvo = isEdicao
        ? await repository.atualizarFornecedor(tenantId, fornecedor!.id, dados)
        : await repository.criarFornecedor(tenantId, dados);
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
        setError('Não foi possível salvar o fornecedor.');
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
      const reativado = await repository.reativarFornecedor(tenantId, conflito.existingId);
      onSalvar(reativado);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reativar o fornecedor.');
    } finally {
      setReactivating(false);
    }
  };

  return (
    <form className="fornecedor-form" onSubmit={handleSubmit}>
      <Input
        label="Nome do fornecedor"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Ex: Distribuidora ABC"
        maxLength={120}
        autoFocus
        disabled={busy}
        error={error || undefined}
      />

      <Input
        label="CPF ou CNPJ (opcional)"
        value={documentInput}
        onChange={handleDocumentChange}
        placeholder="000.000.000-00"
        maxLength={18}
        disabled={busy}
        error={documentError || undefined}
      />

      <Input
        label="Telefone (opcional)"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        placeholder="(11) 98888-7777"
        disabled={busy}
      />

      <Input
        label="E-mail (opcional)"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="contato@fornecedor.com"
        disabled={busy}
      />

      <Select
        label="Categoria de despesa padrão (opcional)"
        value={defaultCategoryId}
        onChange={(event) => setDefaultCategoryId(event.target.value)}
        options={categoriaOptions}
        disabled={busy}
      />

      <Textarea
        label="Observação (opcional)"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={500}
        rows={3}
        disabled={busy}
      />

      {conflito && (
        <div className="fornecedor-form-conflito" role="alert">
          <p>
            {conflito.archived
              ? `Já existe um fornecedor arquivado chamado "${conflito.existingName}".`
              : `Já existe um fornecedor ativo chamado "${conflito.existingName}".`}
          </p>
          {/* Oferecer reativar só na criação: mesma decisão de CategoriaDespesaForm. */}
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

      <div className="fornecedor-form-actions">
        {onCancelar && (
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={busy}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" loading={saving} disabled={reactivating}>
          {isEdicao ? 'Salvar' : 'Cadastrar fornecedor'}
        </Button>
      </div>

      <style>{`
        .fornecedor-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .fornecedor-form-conflito {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          align-items: flex-start;
          background-color: var(--color-brand-lightest, #FFF1E6);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
        }

        .fornecedor-form-conflito p {
          margin: 0;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .fornecedor-form-conflito {
          background-color: rgba(217, 108, 0, 0.15);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #FFF1E6);
        }

        .dark-theme .fornecedor-form-conflito p {
          color: var(--color-text-primary, #FFF1E6);
        }

        .fornecedor-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
      `}</style>
    </form>
  );
};
