import React, { useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Textarea } from '../ui/forms/Textarea';
import { Select } from '../ui/forms/Select';
import { Button } from '../ui/forms/Button';
import { Drawer } from '../ui/feedback/Drawer';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { ContaPagar, ContaPagarDetalhe } from '../../modules/contas-pagar/types';
import type { CategoriaDespesa, Fornecedor } from '../../modules/plano-contas/types';

export interface EditarContaDialogProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  tenantId: string;
  conta: ContaPagarDetalhe;
  categoriasAtivas: CategoriaDespesa[];
  fornecedoresAtivos: Fornecedor[];
  onSalvar: (conta: ContaPagar) => void;
  onCancelar: () => void;
}

/**
 * Diálogo de edição (ticket 08/036): a RPC é a autoridade sobre o que cada
 * estado permite travar (valor a partir de parcialmente paga, vencimento a
 * partir de paga) — este formulário não desabilita campos por estado, só
 * mostra a mensagem que a RPC devolver.
 */
export const EditarContaDialog: React.FC<EditarContaDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  conta,
  categoriasAtivas,
  fornecedoresAtivos,
  onSalvar,
  onCancelar,
}) => {
  const [description, setDescription] = useState(conta.description);
  const [categoryId, setCategoryId] = useState(conta.category_id);
  const [supplierId, setSupplierId] = useState(conta.supplier_id || '');
  const [amount, setAmount] = useState(String(conta.amount).replace('.', ','));
  const [dueDate, setDueDate] = useState(conta.due_date);
  const [competenceDate, setCompetenceDate] = useState(conta.competence_date);
  const [documentNumber, setDocumentNumber] = useState(conta.document_number || '');
  const [notes, setNotes] = useState(conta.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoriaOptions = [
    ...(!categoriasAtivas.some((item) => item.id === conta.category_id)
      ? [{ value: conta.category_id, label: `${conta.category_name} (arquivada)` }]
      : []),
    ...categoriasAtivas.map((categoria) => ({ value: categoria.id, label: categoria.name })),
  ];
  const fornecedorOptions = [
    { value: '', label: 'Sem fornecedor' },
    ...(conta.supplier_id && !fornecedoresAtivos.some((item) => item.id === conta.supplier_id)
      ? [{ value: conta.supplier_id, label: `${conta.supplier_name} (arquivado)` }]
      : []),
    ...fornecedoresAtivos.map((fornecedor) => ({ value: fornecedor.id, label: fornecedor.name })),
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const salva = await repository.editarConta(tenantId, conta.id, {
        description,
        categoryId,
        amount: Number(amount.replace(',', '.')),
        dueDate,
        supplierId: supplierId || null,
        competenceDate,
        documentNumber: documentNumber || null,
        notes: notes || null,
      });
      onSalvar(salva);
    } catch (err) {
      if (err instanceof ContasPagarValidationError) {
        setError(err.message);
      } else {
        setError('Não foi possível salvar as alterações.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onCancelar} title="Editar conta a pagar">
      <form className="conta-pagar-form" onSubmit={handleSubmit}>
        <Input
          label="Descrição"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={200}
          disabled={saving}
          autoFocus
        />

        <Select
          label="Categoria de despesa"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          options={categoriaOptions}
          disabled={saving}
        />

        <Select
          label="Fornecedor (opcional)"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          options={fornecedorOptions}
          disabled={saving}
        />

        <Input
          label="Valor"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          disabled={saving}
        />

        <Input
          label="Vencimento"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          disabled={saving}
        />

        <Input
          label="Competência"
          type="date"
          value={competenceDate}
          onChange={(event) => setCompetenceDate(event.target.value)}
          disabled={saving}
        />

        <Input
          label="Número do documento (opcional)"
          value={documentNumber}
          onChange={(event) => setDocumentNumber(event.target.value)}
          maxLength={60}
          disabled={saving}
        />

        <Textarea
          label="Observação (opcional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
          rows={3}
          disabled={saving}
        />

        {error && (
          <div className="conta-pagar-form-error" role="alert">
            {error}
          </div>
        )}

        <div className="conta-pagar-form-actions">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>

      <style>{`
        .conta-pagar-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .conta-pagar-form-error {
          background-color: var(--color-brand-lightest, #FFF1E6);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #2D231E);
          border-radius: var(--radius-md, 8px);
          padding: 0.85rem;
          font-size: var(--font-size-sm, 0.875rem);
          color: var(--color-text-primary, #2D231E);
        }

        .dark-theme .conta-pagar-form-error {
          background-color: rgba(217, 108, 0, 0.15);
          box-shadow: 0 0 0 0.5px var(--color-text-primary, #FFF1E6);
          color: var(--color-text-primary, #FFF1E6);
        }

        .conta-pagar-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
      `}</style>
    </Drawer>
  );
};
