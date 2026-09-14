import React, { useState } from 'react';
import { Input } from '../ui/forms/Input';
import { Textarea } from '../ui/forms/Textarea';
import { Select } from '../ui/forms/Select';
import { Button } from '../ui/forms/Button';
import { Drawer } from '../ui/feedback/Drawer';
import { SegmentedControl } from '../ui/navigation/SegmentedControl';
import { CategoriaDespesaForm } from './CategoriaDespesaForm';
import { FornecedorForm } from './FornecedorForm';
import {
  ContasPagarRepository,
  ContasPagarValidationError,
} from '../../modules/contas-pagar/ContasPagarRepository';
import type { ContaPagar } from '../../modules/contas-pagar/types';
import type { PlanoContasRepository } from '../../modules/plano-contas/PlanoContasRepository';
import type { CategoriaDespesa, Fornecedor } from '../../modules/plano-contas/types';

export interface ContaPagarFormProps {
  /** Repositório injetado (Supabase em produção, simulado nos testes). */
  repository: ContasPagarRepository;
  tenantId: string;
  /** Só categorias ativas: a RPC exige categoria ativa no lançamento. */
  categoriasAtivas: CategoriaDespesa[];
  /** Só fornecedores ativos: a RPC exige fornecedor ativo quando informado. */
  fornecedoresAtivos: Fornecedor[];
  /**
   * Repositório do Plano de Contas (ticket 10/036): presente habilita o
   * cadastro rápido de Categoria de Despesa e Fornecedor sem sair do
   * formulário, reusando os formulários autônomos da 035. Ausente (ex.:
   * algum consumidor futuro sem esse contexto) esconde os atalhos.
   */
  planoContasRepository?: PlanoContasRepository;
  /** Chamado depois de um cadastro rápido bem-sucedido, para a aba recarregar a lista de categorias. */
  onCategoriaCriada?: (categoria: CategoriaDespesa) => void;
  /** Chamado depois de um cadastro rápido bem-sucedido, para a aba recarregar a lista de fornecedores. */
  onFornecedorCriado?: (fornecedor: Fornecedor) => void;
  onSalvar: (conta: ContaPagar) => void;
  onCancelar?: () => void;
}

/**
 * Formulário de Conta a Pagar (ticket 06/036): casca de campos comuns com
 * variante explícita escolhida por controle segmentado, sem flag booleana de
 * modo. Só "Avulsa" existe neste ticket; Parcelamento e Recorrência chegam
 * nos tickets 11 e 12, como novas opções do mesmo controle.
 *
 * Ao escolher o Fornecedor, a categoria padrão dele pré-preenche a Categoria
 * de Despesa só se estiver ativa e só se o gestor ainda não tiver escolhido
 * uma categoria manualmente (história 8) — por isso o componente rastreia se
 * a escolha de categoria foi feita pelo gestor ou pelo preenchimento
 * automático.
 */
export const ContaPagarForm: React.FC<ContaPagarFormProps> = ({
  repository,
  tenantId,
  categoriasAtivas,
  fornecedoresAtivos,
  planoContasRepository,
  onCategoriaCriada,
  onFornecedorCriado,
  onSalvar,
  onCancelar,
}) => {
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoriaEscolhidaManualmente, setCategoriaEscolhidaManualmente] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticket 10/036: registros criados pelo cadastro rápido, para o select
  // mostrar e selecionar o novo registro na hora, sem esperar a aba recarregar
  // a lista de categorias/fornecedores em segundo plano.
  const [categoriasExtras, setCategoriasExtras] = useState<CategoriaDespesa[]>([]);
  const [fornecedoresExtras, setFornecedoresExtras] = useState<Fornecedor[]>([]);
  const [categoriaDrawerAberto, setCategoriaDrawerAberto] = useState(false);
  const [fornecedorDrawerAberto, setFornecedorDrawerAberto] = useState(false);

  const todasCategoriasAtivas = [
    ...categoriasAtivas,
    ...categoriasExtras.filter((extra) => !categoriasAtivas.some((item) => item.id === extra.id)),
  ];
  const todosFornecedoresAtivos = [
    ...fornecedoresAtivos,
    ...fornecedoresExtras.filter((extra) => !fornecedoresAtivos.some((item) => item.id === extra.id)),
  ];

  const categoriaOptions = [
    { value: '', label: 'Selecione uma categoria' },
    ...todasCategoriasAtivas.map((categoria) => ({ value: categoria.id, label: categoria.name })),
  ];
  const fornecedorOptions = [
    { value: '', label: 'Sem fornecedor' },
    ...todosFornecedoresAtivos.map((fornecedor) => ({ value: fornecedor.id, label: fornecedor.name })),
  ];

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryId(event.target.value);
    setCategoriaEscolhidaManualmente(true);
  };

  const handleSupplierChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const novoFornecedorId = event.target.value;
    setSupplierId(novoFornecedorId);

    if (categoriaEscolhidaManualmente) return;

    const fornecedor = todosFornecedoresAtivos.find((item) => item.id === novoFornecedorId);
    if (fornecedor?.default_category && !fornecedor.default_category.archived) {
      setCategoryId(fornecedor.default_category.id);
    }
  };

  const handleCategoriaCriada = (categoria: CategoriaDespesa) => {
    setCategoriasExtras((atual) => [...atual, categoria]);
    setCategoryId(categoria.id);
    setCategoriaEscolhidaManualmente(true);
    setCategoriaDrawerAberto(false);
    onCategoriaCriada?.(categoria);
  };

  const handleFornecedorCriado = (fornecedor: Fornecedor) => {
    setFornecedoresExtras((atual) => [...atual, fornecedor]);
    setSupplierId(fornecedor.id);
    setFornecedorDrawerAberto(false);
    onFornecedorCriado?.(fornecedor);

    if (!categoriaEscolhidaManualmente && fornecedor.default_category && !fornecedor.default_category.archived) {
      setCategoryId(fornecedor.default_category.id);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const valorNumerico = Number(amount.replace(',', '.'));

    setSaving(true);
    try {
      const salva = await repository.criarContaAvulsa(tenantId, {
        description,
        categoryId,
        amount: valorNumerico,
        dueDate,
        supplierId: supplierId || null,
        documentNumber: documentNumber || null,
        notes: notes || null,
      });
      onSalvar(salva);
    } catch (err) {
      if (err instanceof ContasPagarValidationError) {
        setError(err.message);
      } else {
        setError('Não foi possível lançar a conta a pagar.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="conta-pagar-form" onSubmit={handleSubmit}>
      <SegmentedControl
        value="avulsa"
        onChange={() => {}}
        aria-label="Tipo de lançamento"
        options={[{ id: 'avulsa', label: 'Avulsa' }]}
      />

      <Input
        label="Descrição"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Ex: Aluguel de setembro"
        maxLength={200}
        autoFocus
        disabled={saving}
      />

      <div className="conta-pagar-form-campo-com-atalho">
        <Select
          label="Categoria de despesa"
          value={categoryId}
          onChange={handleCategoryChange}
          options={categoriaOptions}
          disabled={saving}
        />
        {planoContasRepository && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCategoriaDrawerAberto(true)}
            disabled={saving}
          >
            Nova categoria
          </Button>
        )}
      </div>

      <div className="conta-pagar-form-campo-com-atalho">
        <Select
          label="Fornecedor (opcional)"
          value={supplierId}
          onChange={handleSupplierChange}
          options={fornecedorOptions}
          disabled={saving}
        />
        {planoContasRepository && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setFornecedorDrawerAberto(true)}
            disabled={saving}
          >
            Novo fornecedor
          </Button>
        )}
      </div>

      <Input
        label="Valor"
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="0,00"
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
        {onCancelar && (
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" loading={saving}>
          Lançar conta
        </Button>
      </div>

      {planoContasRepository && (
        <Drawer
          isOpen={categoriaDrawerAberto}
          onClose={() => setCategoriaDrawerAberto(false)}
          title="Nova categoria de despesa"
        >
          <CategoriaDespesaForm
            repository={planoContasRepository}
            tenantId={tenantId}
            onSalvar={handleCategoriaCriada}
            onCancelar={() => setCategoriaDrawerAberto(false)}
          />
        </Drawer>
      )}

      {planoContasRepository && (
        <Drawer
          isOpen={fornecedorDrawerAberto}
          onClose={() => setFornecedorDrawerAberto(false)}
          title="Novo fornecedor"
        >
          <FornecedorForm
            repository={planoContasRepository}
            tenantId={tenantId}
            categoriasAtivas={todasCategoriasAtivas}
            onSalvar={handleFornecedorCriado}
            onCancelar={() => setFornecedorDrawerAberto(false)}
          />
        </Drawer>
      )}

      <style>{`
        .conta-pagar-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .conta-pagar-form-campo-com-atalho {
          display: flex;
          align-items: flex-end;
          gap: 0.75rem;
        }

        .conta-pagar-form-campo-com-atalho > :first-child {
          flex: 1;
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
    </form>
  );
};
