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
import type { ContaPagar, OcorrenciaPreviaSerie, PeriodicidadeSerie } from '../../modules/contas-pagar/types';
import type { PlanoContasRepository } from '../../modules/plano-contas/PlanoContasRepository';
import type { CategoriaDespesa, Fornecedor } from '../../modules/plano-contas/types';

const OPCOES_PERIODICIDADE: { value: PeriodicidadeSerie; label: string }[] = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
];

function formatarMoedaPrevia(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataPrevia(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

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
 * modo. Avulsa (06), Recorrência (11) e Parcelamento (12) são as três
 * variantes desse mesmo controle.
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
  const [variante, setVariante] = useState<'avulsa' | 'recorrencia' | 'parcelamento'>('avulsa');
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

  // Ticket 11/036: campos da variante Recorrência. Data âncora é o vencimento
  // da primeira ocorrência — reusa o mesmo estado `dueDate` do formulário.
  const [periodicity, setPeriodicity] = useState<PeriodicidadeSerie>('monthly');
  const [occurrences, setOccurrences] = useState('1');
  // Ticket 12/036: competência única do Parcelamento (padrão: vencimento da
  // primeira parcela, quando deixada em branco).
  const [competenceDate, setCompetenceDate] = useState('');
  const [previaOcorrencias, setPreviaOcorrencias] = useState<OcorrenciaPreviaSerie[] | null>(null);
  const [previaCarregando, setPreviaCarregando] = useState(false);
  const [previaErro, setPreviaErro] = useState<string | null>(null);

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

  const handleTrocarVariante = (novaVariante: 'avulsa' | 'recorrencia' | 'parcelamento') => {
    setVariante(novaVariante);
    setPreviaOcorrencias(null);
    setPreviaErro(null);
    setError(null);
  };

  const handleVerPrevia = async () => {
    setPreviaErro(null);
    setPreviaCarregando(true);
    try {
      const previa = await repository.visualizarPreviaSerie(tenantId, {
        seriesType: variante === 'parcelamento' ? 'installment' : 'recurring',
        periodicity,
        anchorDate: dueDate,
        occurrences: Number(occurrences),
        amount: Number(amount.replace(',', '.')),
      });
      setPreviaOcorrencias(previa);
    } catch (err) {
      setPreviaOcorrencias(null);
      if (err instanceof ContasPagarValidationError) {
        setPreviaErro(err.message);
      } else {
        setPreviaErro('Não foi possível calcular a prévia.');
      }
    } finally {
      setPreviaCarregando(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const valorNumerico = Number(amount.replace(',', '.'));

    setSaving(true);
    try {
      if (variante === 'recorrencia') {
        const criadas = await repository.criarRecorrencia(tenantId, {
          description,
          categoryId,
          periodicity,
          anchorDate: dueDate,
          occurrences: Number(occurrences),
          amount: valorNumerico,
          supplierId: supplierId || null,
          documentNumber: documentNumber || null,
          notes: notes || null,
        });
        onSalvar(criadas[0]);
        return;
      }

      if (variante === 'parcelamento') {
        const criadas = await repository.criarParcelamento(tenantId, {
          description,
          categoryId,
          periodicity,
          anchorDate: dueDate,
          occurrences: Number(occurrences),
          totalAmount: valorNumerico,
          competenceDate: competenceDate || null,
          supplierId: supplierId || null,
          documentNumber: documentNumber || null,
          notes: notes || null,
        });
        onSalvar(criadas[0]);
        return;
      }

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
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <SegmentedControl
        value={variante}
        onChange={handleTrocarVariante}
        aria-label="Tipo de lançamento"
        options={[
          { id: 'avulsa', label: 'Avulsa' },
          { id: 'recorrencia', label: 'Recorrência' },
          { id: 'parcelamento', label: 'Parcelamento' },
        ]}
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

      <div className="flex items-end gap-3 [&>:first-child]:flex-1">
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

      <div className="flex items-end gap-3 [&>:first-child]:flex-1">
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
        label={variante === 'parcelamento' ? 'Valor total' : 'Valor'}
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="0,00"
        disabled={saving}
      />

      <Input
        label={
          variante === 'recorrencia'
            ? 'Vencimento da primeira ocorrência'
            : variante === 'parcelamento'
              ? 'Vencimento da primeira parcela'
              : 'Vencimento'
        }
        type="date"
        value={dueDate}
        onChange={(event) => {
          setDueDate(event.target.value);
          setPreviaOcorrencias(null);
        }}
        disabled={saving}
      />

      {(variante === 'recorrencia' || variante === 'parcelamento') && (
        <>
          <Select
            label="Periodicidade"
            value={periodicity}
            onChange={(event) => {
              setPeriodicity(event.target.value as PeriodicidadeSerie);
              setPreviaOcorrencias(null);
            }}
            options={OPCOES_PERIODICIDADE}
            disabled={saving}
          />

          <Input
            label={variante === 'parcelamento' ? 'Quantidade de parcelas' : 'Quantidade de ocorrências'}
            type="number"
            inputMode="numeric"
            min={variante === 'parcelamento' ? 2 : 1}
            max={60}
            value={occurrences}
            onChange={(event) => {
              setOccurrences(event.target.value);
              setPreviaOcorrencias(null);
            }}
            disabled={saving}
          />

          {variante === 'parcelamento' && (
            <Input
              label="Competência (opcional, padrão: vencimento da primeira parcela)"
              type="date"
              value={competenceDate}
              onChange={(event) => setCompetenceDate(event.target.value)}
              disabled={saving}
            />
          )}

          <Button type="button" variant="secondary" size="sm" loading={previaCarregando} onClick={handleVerPrevia}>
            {variante === 'parcelamento' ? 'Ver prévia das parcelas' : 'Ver prévia das ocorrências'}
          </Button>

          {previaErro && (
            <div
              className="bg-brand-lightest shadow-[0_0_0_0.5px_var(--color-text-primary)] rounded-md p-[0.85rem] text-sm text-text-primary"
              role="alert"
            >
              {previaErro}
            </div>
          )}

          {previaOcorrencias && previaOcorrencias.length > 0 && (
            <ul
              className="list-none m-0 p-0 max-h-[220px] overflow-y-auto flex flex-col gap-[0.35rem]"
              aria-label="Prévia das ocorrências"
            >
              {previaOcorrencias.map((ocorrencia) => (
                <li
                  key={ocorrencia.position}
                  className="flex justify-between gap-3 text-sm text-text-primary py-2 px-3 rounded-sm shadow-[0_0_0_0.8px_var(--color-text-primary)]"
                >
                  <span>
                    {variante === 'parcelamento'
                      ? `${ocorrencia.position}/${previaOcorrencias.length}`
                      : `${ocorrencia.position}ª ocorrência`}
                  </span>
                  <span>{formatarDataPrevia(ocorrencia.dueDate)}</span>
                  <span>{formatarMoedaPrevia(ocorrencia.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

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
        <div
          className="bg-brand-lightest shadow-[0_0_0_0.5px_var(--color-text-primary)] rounded-md p-[0.85rem] text-sm text-text-primary"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        {onCancelar && (
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" loading={saving}>
          {variante === 'recorrencia'
            ? 'Criar Recorrência'
            : variante === 'parcelamento'
              ? 'Criar Parcelamento'
              : 'Lançar conta'}
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
    </form>
  );
};
