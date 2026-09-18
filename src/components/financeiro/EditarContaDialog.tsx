import React, { useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Textarea } from '../ui/forms/Textarea';
import { Select } from '../ui/forms/Select';
import { Button } from '../ui/forms/Button';
import { Drawer } from '../ui/feedback/Drawer';
import { SegmentedControl } from '../ui/navigation/SegmentedControl';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type {
  AlcanceOperacaoSerie,
  ContaPagar,
  ContaPagarDetalhe,
  OcorrenciaAtingidaSerie,
} from '../../modules/contas-pagar/types';
import type { CategoriaDespesa, Fornecedor } from '../../modules/plano-contas/types';

export interface EditarContaDialogProps {
  isOpen: boolean;
  repository: ContasPagarRepository;
  tenantId: string;
  conta: ContaPagarDetalhe;
  categoriasAtivas: CategoriaDespesa[];
  fornecedoresAtivos: Fornecedor[];
  onSalvar: (conta: ContaPagar) => void;
  /** Chamado depois que o gestor fecha o resumo de uma edição em Série, para a tela recarregar. */
  onSerieEditada?: () => void;
  onCancelar: () => void;
}

function rotuloIgnorada(status: string): string {
  if (status === 'partially_paid') return 'parcialmente paga';
  if (status === 'paid') return 'paga';
  if (status === 'cancelled') return 'cancelada';
  return status;
}

/**
 * Diálogo de edição (ticket 08/036): a RPC continua sendo a autoridade final
 * sobre o que cada estado permite travar (valor a partir de parcialmente
 * paga, vencimento a partir de paga) -- este formulário espelha essa mesma
 * regra desabilitando os campos correspondentes, para o gestor não preencher
 * uma alteração só para descobrir a recusa ao salvar (bug encontrado na
 * validação da spec 036).
 *
 * Ticket 13/036: quando a conta pertence a uma Série, um controle segmentado
 * escolhe o alcance -- "apenas esta" segue as regras acima; "esta e as
 * seguintes em aberto" esconde vencimento/documento/competência (não se
 * editam em lote) e só mostra valor na Recorrência (Parcelamento recusa
 * valor em lote). O resultado exibe quantas ocorrências foram ignoradas e
 * por quê, antes de fechar.
 */
export const EditarContaDialog: React.FC<EditarContaDialogProps> = ({
  isOpen,
  repository,
  tenantId,
  conta,
  categoriasAtivas,
  fornecedoresAtivos,
  onSalvar,
  onSerieEditada,
  onCancelar,
}) => {
  const [alcance, setAlcance] = useState<AlcanceOperacaoSerie>('apenas_esta');
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
  const [resultadoSerie, setResultadoSerie] = useState<OcorrenciaAtingidaSerie[] | null>(null);

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

  const alcanceLote = alcance === 'esta_e_seguintes';
  const valorEmLoteAceito = conta.seriesType === 'recurring';
  const valorTravado = conta.status === 'partially_paid' || conta.status === 'paid';
  const vencimentoTravado = conta.status === 'paid';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (alcanceLote) {
        const atingidas = await repository.editarSerie(tenantId, conta.id, {
          description,
          categoryId,
          supplierId: supplierId || null,
          notes: notes || null,
          amount: valorEmLoteAceito ? Number(amount.replace(',', '.')) : null,
        });
        setResultadoSerie(atingidas);
        return;
      }

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

  const handleFecharResultado = () => {
    setResultadoSerie(null);
    onSerieEditada?.();
  };

  if (resultadoSerie) {
    const ignoradas = resultadoSerie.filter((item) => item.ignored);
    const atualizadas = resultadoSerie.length - ignoradas.length;
    return (
      <Drawer isOpen={isOpen} onClose={handleFecharResultado} title="Edição em Série concluída">
        <div className="flex flex-col gap-4">
          <p>
            {atualizadas} {atualizadas === 1 ? 'ocorrência atualizada' : 'ocorrências atualizadas'}
            {ignoradas.length > 0 &&
              `, ${ignoradas.length} ${ignoradas.length === 1 ? 'ignorada' : 'ignoradas'}`}
            .
          </p>
          {ignoradas.length > 0 && (
            <ul aria-label="Ocorrências ignoradas" className="list-none m-0 p-0 flex flex-col gap-[0.35rem]">
              {ignoradas.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between gap-3 text-sm text-text-primary py-2 px-3 rounded-sm shadow-[0_0_0_0.8px_var(--color-text-primary)]"
                >
                  <span>{item.seriesPosition}ª ocorrência</span>
                  <span>{item.ignoreReason || `Está ${rotuloIgnorada(item.status)}.`}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="primary" onClick={handleFecharResultado}>
              Concluir
            </Button>
          </div>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer isOpen={isOpen} onClose={onCancelar} title="Editar conta a pagar">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {conta.seriesType && (
          <SegmentedControl
            value={alcance}
            onChange={setAlcance}
            aria-label="Alcance da edição"
            options={[
              { id: 'apenas_esta', label: 'Apenas esta' },
              { id: 'esta_e_seguintes', label: 'Esta e as seguintes em aberto' },
            ]}
          />
        )}

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

        {(!alcanceLote || valorEmLoteAceito) && (
          <Input
            label="Valor"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={saving || (!alcanceLote && valorTravado)}
            helperText={!alcanceLote && valorTravado ? 'Valor travado: conta parcialmente paga ou paga.' : undefined}
          />
        )}

        {!alcanceLote && (
          <>
            <Input
              label="Vencimento"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              disabled={saving || vencimentoTravado}
              helperText={vencimentoTravado ? 'Vencimento travado: conta paga.' : undefined}
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
          </>
        )}

        <Textarea
          label="Observação (opcional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={500}
          rows={3}
          disabled={saving}
        />

        {error && (
          <div
            className="bg-brand-lightest shadow-[0_0_0_0.5px_var(--color-text-primary)] rounded-md p-[0.85rem] text-sm text-text-primary"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Drawer>
  );
};
