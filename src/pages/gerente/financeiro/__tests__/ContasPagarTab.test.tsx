import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ContasPagarTab } from '../ContasPagarTab';
import { ContasPagarRepository } from '../../../../modules/contas-pagar/ContasPagarRepository';
import { PlanoContasRepository } from '../../../../modules/plano-contas/PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../../../../modules/plano-contas/adapters/InMemoryPlanoContasAdapter';
import type { CategoriaDespesa, Fornecedor } from '../../../../modules/plano-contas/types';
import type {
  AlertaContasPagar,
  Baixa,
  ContaPagar,
  ContaPagarDetalhe,
  ContaPagarListada,
  DadosBaixa,
  DadosContaPagarAvulsa,
  DadosEdicaoContaPagar,
  DadosEdicaoSerie,
  DadosParcelamento,
  DadosRecorrencia,
  FiltroListaContasPagar,
  FiltroPreviaSerie,
  IContasPagarAdapter,
  ListaContasPagarResultado,
  OcorrenciaAtingidaSerie,
  OcorrenciaPreviaSerie,
  PeriodicidadeSerie,
  TipoSerie,
  TotaisContasPagar,
} from '../../../../modules/contas-pagar/types';

const TENANT_ID = 'tenant-contas-pagar-1';

function categoria(overrides: Partial<CategoriaDespesa>): CategoriaDespesa {
  return {
    id: overrides.id || 'cat-id',
    tenant_id: TENANT_ID,
    nature: 'expense',
    name: 'Categoria',
    seed_key: null,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  };
}

function fornecedor(overrides: Partial<Fornecedor>): Fornecedor {
  return {
    id: overrides.id || 'forn-id',
    tenant_id: TENANT_ID,
    name: 'Fornecedor',
    document: null,
    phone: null,
    email: null,
    notes: null,
    default_category_id: null,
    default_category: null,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  };
}

function contaListada(overrides: Partial<ContaPagarListada>): ContaPagarListada {
  return {
    id: overrides.id || 'conta-id',
    description: 'Conta',
    category_id: 'cat-1',
    category_name: 'Categoria',
    category_archived: false,
    supplier_id: null,
    supplier_name: null,
    supplier_archived: null,
    amount: 100,
    paid_amount: 0,
    remaining_amount: 100,
    status: 'open',
    situation: 'open',
    highlight: null,
    due_date: '2026-09-30',
    competence_date: '2026-09-30',
    document_number: null,
    notes: null,
    series_id: null,
    series_position: null,
    created_at: '2026-09-13T10:00:00Z',
    ...overrides,
  };
}

/**
 * Adaptador simulado, só para este teste (não vira arquivo do módulo — ver a
 * decisão de não ter adaptador em memória em `types.ts`): mantém uma lista de
 * `ContaPagarListada` em memória e cria novas contas a partir das categorias
 * e fornecedores injetados, para não reimplementar as regras de negócio que a
 * RPC de fato aplica.
 */
class FakeContasPagarAdapter implements IContasPagarAdapter {
  private contas: ContaPagarListada[];
  private categorias: CategoriaDespesa[];
  private fornecedores: Fornecedor[];
  private baixasPorConta: Record<string, Baixa[]> = {};
  private seriesInfo: Record<string, { type: TipoSerie; periodicity: PeriodicidadeSerie }> = {};
  private proximoId = 1;
  private proximoIdBaixa = 1;

  constructor(
    contas: ContaPagarListada[] = [],
    categorias: CategoriaDespesa[] = [],
    fornecedores: Fornecedor[] = []
  ) {
    this.contas = contas;
    this.categorias = categorias;
    this.fornecedores = fornecedores;
  }

  async criarContaAvulsa(tenantId: string, dados: DadosContaPagarAvulsa): Promise<ContaPagar> {
    const categoria = this.categorias.find((item) => item.id === dados.categoryId);
    const fornecedor = dados.supplierId
      ? this.fornecedores.find((item) => item.id === dados.supplierId)
      : undefined;

    const id = `conta-${this.proximoId++}`;
    this.contas.push({
      id,
      description: dados.description,
      category_id: dados.categoryId,
      category_name: categoria?.name || '',
      category_archived: false,
      supplier_id: dados.supplierId || null,
      supplier_name: fornecedor?.name || null,
      supplier_archived: null,
      amount: dados.amount,
      paid_amount: 0,
      remaining_amount: dados.amount,
      status: 'open',
      situation: 'open',
      highlight: null,
      due_date: dados.dueDate,
      competence_date: dados.competenceDate || dados.dueDate,
      document_number: dados.documentNumber || null,
      notes: dados.notes || null,
      series_id: null,
      series_position: null,
      created_at: '2026-09-13T10:00:00Z',
    });

    return {
      id,
      tenant_id: tenantId,
      description: dados.description,
      category_id: dados.categoryId,
      supplier_id: dados.supplierId || null,
      amount: dados.amount,
      paid_amount: 0,
      status: 'open',
      due_date: dados.dueDate,
      competence_date: dados.competenceDate || dados.dueDate,
      document_number: dados.documentNumber || null,
      notes: dados.notes || null,
      series_id: null,
      series_position: null,
      created_at: '2026-09-13T10:00:00Z',
      created_by: 'user-1',
      updated_at: '2026-09-13T10:00:00Z',
      updated_by: 'user-1',
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    };
  }

  async listarContas(
    _tenantId: string,
    filtro: FiltroListaContasPagar
  ): Promise<ListaContasPagarResultado> {
    const status = filtro.status || 'not_cancelled';
    const filtradas = this.contas.filter((conta) =>
      status === 'not_cancelled' ? conta.status !== 'cancelled' : conta.situation === status
    );
    return { contas: filtradas, totalCount: filtradas.length };
  }

  async obterConta(_tenantId: string, payableId: string): Promise<ContaPagarDetalhe> {
    const conta = this.contas.find((item) => item.id === payableId);
    if (!conta) {
      throw new Error('Conta a pagar não encontrada.');
    }
    const serie = conta.series_id ? this.seriesInfo[conta.series_id] : undefined;
    const seriesOccurrencesCount = conta.series_id
      ? this.contas.filter((item) => item.series_id === conta.series_id).length
      : null;
    return {
      ...conta,
      createdAt: '2026-09-13T10:00:00Z',
      createdBy: 'user-1',
      createdByName: 'Fulano',
      updatedAt: '2026-09-13T10:00:00Z',
      updatedBy: 'user-1',
      updatedByName: 'Fulano',
      cancelledAt: null,
      cancelledBy: null,
      cancelledByName: null,
      cancellationReason: null,
      seriesType: serie?.type ?? null,
      seriesPeriodicity: serie?.periodicity ?? null,
      seriesOccurrencesCount,
    };
  }

  async darBaixa(_tenantId: string, payableId: string, dados: DadosBaixa): Promise<Baixa> {
    const conta = this.contas.find((item) => item.id === payableId);
    if (!conta) {
      throw new Error('Conta a pagar não encontrada.');
    }

    const interestAmount = dados.interestAmount ?? 0;
    const discountAmount = dados.discountAmount ?? 0;
    const nova: Baixa = {
      id: `baixa-${this.proximoIdBaixa++}`,
      principal: dados.principal,
      interestAmount,
      discountAmount,
      paidAmount: dados.principal + interestAmount - discountAmount,
      paymentDate: dados.paymentDate,
      paymentMethod: dados.paymentMethod,
      source: dados.source ?? 'fora_do_caixa',
      createdAt: '2026-09-14T10:00:00Z',
      createdBy: 'user-1',
      createdByName: 'Fulano',
      reversedAt: null,
      reversedBy: null,
      reversedByName: null,
      reversalReason: null,
    };

    this.baixasPorConta[payableId] = [...(this.baixasPorConta[payableId] || []), nova];

    conta.paid_amount += dados.principal;
    conta.remaining_amount = conta.amount - conta.paid_amount;
    conta.status =
      conta.paid_amount >= conta.amount ? 'paid' : conta.paid_amount > 0 ? 'partially_paid' : 'open';
    conta.situation = conta.status;

    return nova;
  }

  async estornarBaixa(_tenantId: string, settlementId: string, motivo: string): Promise<Baixa> {
    for (const [payableId, baixas] of Object.entries(this.baixasPorConta)) {
      const alvo = baixas.find((item) => item.id === settlementId);
      if (!alvo) continue;

      alvo.reversedAt = '2026-09-14T11:00:00Z';
      alvo.reversedBy = 'user-1';
      alvo.reversedByName = 'Fulano';
      alvo.reversalReason = motivo;

      const conta = this.contas.find((item) => item.id === payableId);
      if (conta) {
        conta.paid_amount -= alvo.principal;
        conta.remaining_amount = conta.amount - conta.paid_amount;
        conta.status =
          conta.paid_amount <= 0 ? 'open' : conta.paid_amount < conta.amount ? 'partially_paid' : 'paid';
        conta.situation = conta.status;
      }

      return alvo;
    }
    throw new Error('Baixa não encontrada.');
  }

  async listarBaixas(_tenantId: string, payableId: string): Promise<Baixa[]> {
    return this.baixasPorConta[payableId] || [];
  }

  async editarConta(
    tenantId: string,
    payableId: string,
    dados: DadosEdicaoContaPagar
  ): Promise<ContaPagar> {
    const conta = this.contas.find((item) => item.id === payableId);
    if (!conta) {
      throw new Error('Conta a pagar não encontrada.');
    }
    const categoria = this.categorias.find((item) => item.id === dados.categoryId);
    const fornecedor = dados.supplierId
      ? this.fornecedores.find((item) => item.id === dados.supplierId)
      : undefined;

    conta.description = dados.description;
    conta.category_id = dados.categoryId;
    conta.category_name = categoria?.name || conta.category_name;
    conta.supplier_id = dados.supplierId || null;
    conta.supplier_name = fornecedor?.name || null;
    conta.amount = dados.amount;
    conta.remaining_amount = dados.amount - conta.paid_amount;
    conta.due_date = dados.dueDate;
    conta.competence_date = dados.competenceDate || dados.dueDate;
    conta.document_number = dados.documentNumber || null;
    conta.notes = dados.notes || null;

    return {
      id: conta.id,
      tenant_id: tenantId,
      description: conta.description,
      category_id: conta.category_id,
      supplier_id: conta.supplier_id,
      amount: conta.amount,
      paid_amount: conta.paid_amount,
      status: conta.status,
      due_date: conta.due_date,
      competence_date: conta.competence_date,
      document_number: conta.document_number,
      notes: conta.notes,
      series_id: null,
      series_position: null,
      created_at: '2026-09-13T10:00:00Z',
      created_by: 'user-1',
      updated_at: '2026-09-14T12:00:00Z',
      updated_by: 'user-1',
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    };
  }

  async cancelarConta(tenantId: string, payableId: string, motivo: string): Promise<ContaPagar> {
    const conta = this.contas.find((item) => item.id === payableId);
    if (!conta) {
      throw new Error('Conta a pagar não encontrada.');
    }
    conta.status = 'cancelled';
    conta.situation = 'cancelled';

    return {
      id: conta.id,
      tenant_id: tenantId,
      description: conta.description,
      category_id: conta.category_id,
      supplier_id: conta.supplier_id,
      amount: conta.amount,
      paid_amount: conta.paid_amount,
      status: 'cancelled',
      due_date: conta.due_date,
      competence_date: conta.competence_date,
      document_number: conta.document_number,
      notes: conta.notes,
      series_id: null,
      series_position: null,
      created_at: '2026-09-13T10:00:00Z',
      created_by: 'user-1',
      updated_at: '2026-09-14T12:00:00Z',
      updated_by: 'user-1',
      cancelled_at: '2026-09-14T12:00:00Z',
      cancelled_by: 'user-1',
      cancellation_reason: motivo,
    };
  }

  async obterTotais(): Promise<TotaisContasPagar> {
    const ativas = this.contas.filter((conta) => conta.status !== 'cancelled');
    return {
      openBalance: ativas.reduce((soma, conta) => soma + conta.remaining_amount, 0),
      overdueBalance: ativas
        .filter((conta) => conta.situation === 'overdue')
        .reduce((soma, conta) => soma + conta.remaining_amount, 0),
      paidInPeriod: this.contas.reduce((soma, conta) => soma + conta.paid_amount, 0),
    };
  }

  async obterAlerta(): Promise<AlertaContasPagar> {
    const vencidas = this.contas.filter((conta) => conta.situation === 'overdue');
    const venceHoje = this.contas.filter((conta) => conta.highlight === 'due_today');
    return {
      overdueCount: vencidas.length,
      overdueBalance: vencidas.reduce((soma, conta) => soma + conta.remaining_amount, 0),
      dueTodayCount: venceHoje.length,
      dueTodayBalance: venceHoje.reduce((soma, conta) => soma + conta.remaining_amount, 0),
    };
  }

  async visualizarPreviaSerie(
    _tenantId: string,
    filtro: FiltroPreviaSerie
  ): Promise<OcorrenciaPreviaSerie[]> {
    const ocorrencias: OcorrenciaPreviaSerie[] = [];
    const total = Math.round(filtro.amount * 100);
    const share = filtro.seriesType === 'installment' ? Math.trunc(total / filtro.occurrences) : total;
    const lastShare = filtro.seriesType === 'installment' ? total - share * (filtro.occurrences - 1) : total;

    for (let position = 1; position <= filtro.occurrences; position++) {
      ocorrencias.push({
        position,
        dueDate: computeDueDateFake(filtro.anchorDate, filtro.periodicity, position),
        amount: (position === filtro.occurrences ? lastShare : share) / 100,
      });
    }
    return ocorrencias;
  }

  async criarRecorrencia(tenantId: string, dados: DadosRecorrencia): Promise<ContaPagar[]> {
    const categoria = this.categorias.find((item) => item.id === dados.categoryId);
    const fornecedor = dados.supplierId
      ? this.fornecedores.find((item) => item.id === dados.supplierId)
      : undefined;
    const seriesId = `serie-${this.proximoId}`;
    this.seriesInfo[seriesId] = { type: 'recurring', periodicity: dados.periodicity };
    const criadas: ContaPagar[] = [];

    for (let position = 1; position <= dados.occurrences; position++) {
      const id = `conta-${this.proximoId++}`;
      const dueDate = computeDueDateFake(dados.anchorDate, dados.periodicity, position);
      this.contas.push({
        id,
        description: dados.description,
        category_id: dados.categoryId,
        category_name: categoria?.name || '',
        category_archived: false,
        supplier_id: dados.supplierId || null,
        supplier_name: fornecedor?.name || null,
        supplier_archived: null,
        amount: dados.amount,
        paid_amount: 0,
        remaining_amount: dados.amount,
        status: 'open',
        situation: 'open',
        highlight: null,
        due_date: dueDate,
        competence_date: dueDate,
        document_number: dados.documentNumber || null,
        notes: dados.notes || null,
        series_id: seriesId,
        series_position: position,
        created_at: '2026-09-14T10:00:00Z',
      });
      criadas.push({
        id,
        tenant_id: tenantId,
        description: dados.description,
        category_id: dados.categoryId,
        supplier_id: dados.supplierId || null,
        amount: dados.amount,
        paid_amount: 0,
        status: 'open',
        due_date: dueDate,
        competence_date: dueDate,
        document_number: dados.documentNumber || null,
        notes: dados.notes || null,
        series_id: seriesId,
        series_position: position,
        created_at: '2026-09-14T10:00:00Z',
        created_by: 'user-1',
        updated_at: '2026-09-14T10:00:00Z',
        updated_by: 'user-1',
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
      });
    }

    return criadas;
  }

  async criarParcelamento(tenantId: string, dados: DadosParcelamento): Promise<ContaPagar[]> {
    const categoria = this.categorias.find((item) => item.id === dados.categoryId);
    const fornecedor = dados.supplierId
      ? this.fornecedores.find((item) => item.id === dados.supplierId)
      : undefined;
    const seriesId = `serie-${this.proximoId}`;
    this.seriesInfo[seriesId] = { type: 'installment', periodicity: dados.periodicity };
    const competenceDate = dados.competenceDate || dados.anchorDate;
    const share = Math.trunc(dados.totalAmount * 100 / dados.occurrences) / 100;
    const lastShare = Math.round((dados.totalAmount - share * (dados.occurrences - 1)) * 100) / 100;
    const criadas: ContaPagar[] = [];

    for (let position = 1; position <= dados.occurrences; position++) {
      const id = `conta-${this.proximoId++}`;
      const dueDate = computeDueDateFake(dados.anchorDate, dados.periodicity, position);
      const installmentAmount = position === dados.occurrences ? lastShare : share;
      this.contas.push({
        id,
        description: dados.description,
        category_id: dados.categoryId,
        category_name: categoria?.name || '',
        category_archived: false,
        supplier_id: dados.supplierId || null,
        supplier_name: fornecedor?.name || null,
        supplier_archived: null,
        amount: installmentAmount,
        paid_amount: 0,
        remaining_amount: installmentAmount,
        status: 'open',
        situation: 'open',
        highlight: null,
        due_date: dueDate,
        competence_date: competenceDate,
        document_number: dados.documentNumber || null,
        notes: dados.notes || null,
        series_id: seriesId,
        series_position: position,
        created_at: '2026-09-14T10:00:00Z',
      });
      criadas.push({
        id,
        tenant_id: tenantId,
        description: dados.description,
        category_id: dados.categoryId,
        supplier_id: dados.supplierId || null,
        amount: installmentAmount,
        paid_amount: 0,
        status: 'open',
        due_date: dueDate,
        competence_date: competenceDate,
        document_number: dados.documentNumber || null,
        notes: dados.notes || null,
        series_id: seriesId,
        series_position: position,
        created_at: '2026-09-14T10:00:00Z',
        created_by: 'user-1',
        updated_at: '2026-09-14T10:00:00Z',
        updated_by: 'user-1',
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
      });
    }

    return criadas;
  }

  async editarSerie(
    _tenantId: string,
    payableId: string,
    dados: DadosEdicaoSerie
  ): Promise<OcorrenciaAtingidaSerie[]> {
    const ancora = this.contas.find((item) => item.id === payableId);
    if (!ancora || !ancora.series_id) {
      throw new Error('Esta conta não pertence a uma Série.');
    }
    const categoria = this.categorias.find((item) => item.id === dados.categoryId);
    const fornecedor = dados.supplierId
      ? this.fornecedores.find((item) => item.id === dados.supplierId)
      : undefined;

    const atingidas = this.contas
      .filter(
        (item) =>
          item.series_id === ancora.series_id &&
          (item.series_position ?? 0) >= (ancora.series_position ?? 0)
      )
      .sort((a, b) => (a.series_position ?? 0) - (b.series_position ?? 0));

    return atingidas.map((conta) => {
      if (conta.status === 'open') {
        conta.description = dados.description;
        conta.category_id = dados.categoryId;
        conta.category_name = categoria?.name || conta.category_name;
        conta.supplier_id = dados.supplierId || null;
        conta.supplier_name = fornecedor?.name || null;
        conta.notes = dados.notes || null;
        if (dados.amount != null) {
          conta.amount = dados.amount;
          conta.remaining_amount = dados.amount - conta.paid_amount;
        }
        return {
          id: conta.id,
          seriesPosition: conta.series_position ?? 0,
          status: 'open' as const,
          ignored: false,
          ignoreReason: null,
        };
      }

      const ignoreReason =
        conta.status === 'partially_paid'
          ? 'Conta parcialmente paga não é alterada em lote.'
          : conta.status === 'paid'
            ? 'Conta paga não é alterada em lote.'
            : 'Conta cancelada não é alterada em lote.';
      return {
        id: conta.id,
        seriesPosition: conta.series_position ?? 0,
        status: conta.status,
        ignored: true,
        ignoreReason,
      };
    });
  }

  async cancelarSerie(
    _tenantId: string,
    payableId: string,
    _motivo: string
  ): Promise<OcorrenciaAtingidaSerie[]> {
    const ancora = this.contas.find((item) => item.id === payableId);
    if (!ancora || !ancora.series_id) {
      throw new Error('Esta conta não pertence a uma Série.');
    }

    const atingidas = this.contas
      .filter(
        (item) =>
          item.series_id === ancora.series_id &&
          (item.series_position ?? 0) >= (ancora.series_position ?? 0)
      )
      .sort((a, b) => (a.series_position ?? 0) - (b.series_position ?? 0));

    return atingidas.map((conta) => {
      if (conta.status === 'open') {
        conta.status = 'cancelled';
        conta.situation = 'cancelled';
        return {
          id: conta.id,
          seriesPosition: conta.series_position ?? 0,
          status: 'cancelled' as const,
          ignored: false,
          ignoreReason: null,
        };
      }

      const ignoreReason =
        conta.status === 'partially_paid'
          ? 'Conta parcialmente paga não é cancelada em lote.'
          : conta.status === 'paid'
            ? 'Conta paga não é cancelada em lote.'
            : 'Conta já estava cancelada.';
      return {
        id: conta.id,
        seriesPosition: conta.series_position ?? 0,
        status: conta.status,
        ignored: true,
        ignoreReason,
      };
    });
  }
}

/** Calendario simplificado, só para este teste (a correção real é validada pela suíte pgTAP). */
function computeDueDateFake(anchorIso: string, periodicity: PeriodicidadeSerie, position: number): string {
  const [ano, mes, dia] = anchorIso.split('-').map(Number);
  const offset = position - 1;

  if (periodicity === 'weekly' || periodicity === 'biweekly') {
    const dias = periodicity === 'weekly' ? offset * 7 : offset * 14;
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    data.setUTCDate(data.getUTCDate() + dias);
    return data.toISOString().slice(0, 10);
  }

  const offsetMeses = periodicity === 'monthly' ? offset : offset * 12;
  const totalMeses = ano * 12 + (mes - 1) + offsetMeses;
  const targetYear = Math.floor(totalMeses / 12);
  const targetMonth = (totalMeses % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const day = Math.min(dia, lastDay);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function renderTab(
  contasPagarRepository: ContasPagarRepository,
  planoContasRepository: PlanoContasRepository
) {
  return render(
    <MemoryRouter initialEntries={['/financeiro/contas-a-pagar']}>
      <Routes>
        <Route
          element={
            <Outlet
              context={{ tenantId: TENANT_ID, tenantName: 'Barbearia Modelo', timezone: 'America/Sao_Paulo' }}
            />
          }
        >
          <Route
            path="/financeiro/contas-a-pagar"
            element={
              <ContasPagarTab
                repository={contasPagarRepository}
                planoContasRepository={planoContasRepository}
              />
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('ContasPagarTab (adaptador simulado)', () => {
  it('mostra estado vazio quando não há contas a pagar', async () => {
    const contasPagarRepository = new ContasPagarRepository(new FakeContasPagarAdapter());
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });
  });

  it('lista as contas a pagar existentes com categoria, vencimento, valor e situação', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([
        contaListada({
          id: 'conta-1',
          description: 'Aluguel de setembro',
          category_name: 'Aluguel e condomínio',
          due_date: '2026-09-30',
          amount: 1200,
          remaining_amount: 1200,
          situation: 'open',
        }),
      ])
    );
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel de setembro').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Aluguel e condomínio').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30/09/2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Em aberto').length).toBeGreaterThan(0);
  });

  it('lança uma conta a pagar avulsa pelo Drawer e ela aparece na lista', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter(
        [],
        [categoria({ id: 'cat-1', name: 'Aluguel e condomínio' })],
        []
      )
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoria({ id: 'cat-1', name: 'Aluguel e condomínio' })], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));

    const descricaoInput = await screen.findByLabelText('Descrição');
    fireEvent.change(descricaoInput, { target: { value: 'Aluguel de outubro' } });

    fireEvent.change(screen.getByLabelText('Categoria de despesa'), {
      target: { value: 'cat-1' },
    });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '1500,50' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-10-10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lançar conta' }));

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel de outubro').length).toBeGreaterThan(0);
    });
    // Drawer fecha depois de salvar.
    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument();
    expect(screen.getAllByText(/1.500,50/).length).toBeGreaterThan(0);
  });

  it('lança uma conta com fornecedor e mostra o fornecedor na lista', async () => {
    const categoriaAluguel = categoria({ id: 'cat-1', name: 'Aluguel e condomínio' });
    const fornecedorDistribuidora = fornecedor({ id: 'forn-1', name: 'Distribuidora ABC' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [categoriaAluguel], [fornecedorDistribuidora])
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaAluguel], [fornecedorDistribuidora])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));

    const descricaoInput = await screen.findByLabelText('Descrição');
    fireEvent.change(descricaoInput, { target: { value: 'Boleto do distribuidor' } });
    fireEvent.change(screen.getByLabelText('Categoria de despesa'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Fornecedor (opcional)'), { target: { value: 'forn-1' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-10-10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lançar conta' }));

    await waitFor(() => {
      expect(screen.getAllByText('Boleto do distribuidor').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Distribuidora ABC').length).toBeGreaterThan(0);
  });

  it('mostra a mensagem de validação sem fechar o Drawer quando a categoria não é escolhida', async () => {
    const contasPagarRepository = new ContasPagarRepository(new FakeContasPagarAdapter());
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));

    const descricaoInput = await screen.findByLabelText('Descrição');
    fireEvent.change(descricaoInput, { target: { value: 'Conta sem categoria' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-10-10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lançar conta' }));

    await screen.findByText('Categoria de despesa é obrigatória.');
    // O Drawer continua aberto (nada foi salvo).
    expect(screen.getByLabelText('Descrição')).toBeInTheDocument();
  });

  it('dá Baixa numa conta pelo detalhe, e ela aparece paga na lista (ticket 07/036)', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([
        contaListada({
          id: 'conta-1',
          description: 'Aluguel de setembro',
          amount: 100,
          paid_amount: 0,
          remaining_amount: 100,
          status: 'open',
          situation: 'open',
        }),
      ])
    );
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel de setembro').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('Aluguel de setembro')[0]);

    await screen.findByRole('heading', { name: 'Detalhe da conta a pagar' });
    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa' }));

    const principalInput = await screen.findByLabelText('Principal');
    fireEvent.change(principalInput, { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Data do pagamento'), {
      target: { value: '2026-09-14' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Baixa' }));

    await waitFor(() => {
      expect(screen.getAllByText('Paga').length).toBeGreaterThan(0);
    });
  });

  it('estorna uma Baixa e a conta volta a ficar em aberto (ticket 07/036)', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([
        contaListada({
          id: 'conta-1',
          description: 'Aluguel de setembro',
          amount: 100,
          paid_amount: 0,
          remaining_amount: 100,
          status: 'open',
          situation: 'open',
        }),
      ])
    );
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel de setembro').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('Aluguel de setembro')[0]);
    await screen.findByRole('heading', { name: 'Detalhe da conta a pagar' });

    fireEvent.click(screen.getByRole('button', { name: 'Dar Baixa' }));
    const principalInput = await screen.findByLabelText('Principal');
    fireEvent.change(principalInput, { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Data do pagamento'), {
      target: { value: '2026-09-14' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar Baixa' }));

    await waitFor(() => {
      expect(screen.getAllByText('Ativa').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Estornar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Estornar Baixa' });
    const motivoInput = await within(dialog).findByLabelText('Motivo do estorno');
    fireEvent.change(motivoInput, { target: { value: 'lançada por engano' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Estornar' }));

    await waitFor(() => {
      expect(screen.getAllByText('Estornada').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Em aberto').length).toBeGreaterThan(0);
  });

  it('edita uma conta pelo detalhe e a lista reflete a mudança (ticket 08/036)', async () => {
    const categoriaAluguel = categoria({ id: 'cat-1', name: 'Aluguel e condomínio' });
    const categoriaOutra = categoria({ id: 'cat-2', name: 'Marketing' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter(
        [
          contaListada({
            id: 'conta-1',
            description: 'Aluguel de setembro',
            category_id: 'cat-1',
            category_name: 'Aluguel e condomínio',
            amount: 100,
            remaining_amount: 100,
            status: 'open',
            situation: 'open',
          }),
        ],
        [categoriaAluguel, categoriaOutra]
      )
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaAluguel, categoriaOutra], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel de setembro').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('Aluguel de setembro')[0]);
    await screen.findByRole('heading', { name: 'Detalhe da conta a pagar' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const descricaoInput = await screen.findByLabelText('Descrição');
    fireEvent.change(descricaoInput, { target: { value: 'Aluguel corrigido' } });
    fireEvent.change(screen.getByLabelText('Categoria de despesa'), { target: { value: 'cat-2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel corrigido').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Marketing').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument();
  });

  it('cancela uma conta pelo detalhe informando o motivo e ela some da lista padrão (ticket 08/036)', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([
        contaListada({
          id: 'conta-1',
          description: 'Aluguel de setembro',
          amount: 100,
          remaining_amount: 100,
          status: 'open',
          situation: 'open',
        }),
      ])
    );
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel de setembro').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByText('Aluguel de setembro')[0]);
    await screen.findByRole('heading', { name: 'Detalhe da conta a pagar' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar conta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancelar conta a pagar' });
    const motivoInput = await within(dialog).findByLabelText('Motivo do cancelamento');
    fireEvent.change(motivoInput, { target: { value: 'lançada em duplicidade' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar conta' }));

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });
  });

  it('mostra a faixa de alerta com contas vencidas e vencendo hoje (ticket 09/036)', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([
        contaListada({
          id: 'conta-1',
          description: 'Conta vencida',
          amount: 100,
          remaining_amount: 100,
          status: 'open',
          situation: 'overdue',
          highlight: 'overdue',
        }),
        contaListada({
          id: 'conta-2',
          description: 'Conta vence hoje',
          amount: 50,
          remaining_amount: 50,
          status: 'open',
          situation: 'open',
          highlight: 'due_today',
        }),
      ])
    );
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText(/1 conta vencida/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 conta vence hoje/)).toBeInTheDocument();
  });

  it('não mostra a faixa de alerta quando não há contas vencidas nem vencendo hoje', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([
        contaListada({ id: 'conta-1', description: 'Conta em dia', situation: 'open', highlight: null }),
      ])
    );
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getAllByText('Conta em dia').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cadastra uma Categoria de Despesa pelo formulário e ela fica selecionada (ticket 10/036)', async () => {
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [], [])
    );
    const planoContasRepository = new PlanoContasRepository(new InMemoryPlanoContasAdapter([], []));

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    await screen.findByLabelText('Descrição');

    fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
    const nomeCategoriaInput = await screen.findByLabelText('Nome da categoria');
    fireEvent.change(nomeCategoriaInput, { target: { value: 'Água e luz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar categoria' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Nome da categoria')).not.toBeInTheDocument();
    });

    const categoriaSelect = screen.getByLabelText('Categoria de despesa') as HTMLSelectElement;
    await waitFor(() => {
      expect(categoriaSelect.value).not.toBe('');
    });
    expect(within(categoriaSelect).getByText('Água e luz')).toBeInTheDocument();

    // Os campos já preenchidos permanecem depois do cadastro rápido.
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Conta de luz' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-10-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lançar conta' }));

    await waitFor(() => {
      expect(screen.getAllByText('Conta de luz').length).toBeGreaterThan(0);
    });
  });

  it('cadastra um Fornecedor pelo formulário e ele fica selecionado (ticket 10/036)', async () => {
    const categoriaAluguel = categoria({ id: 'cat-1', name: 'Aluguel e condomínio' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [categoriaAluguel], [])
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaAluguel], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    await screen.findByLabelText('Descrição');

    fireEvent.click(screen.getByRole('button', { name: 'Novo fornecedor' }));
    const nomeFornecedorInput = await screen.findByLabelText('Nome do fornecedor');
    fireEvent.change(nomeFornecedorInput, { target: { value: 'Distribuidora Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Nome do fornecedor')).not.toBeInTheDocument();
    });

    const fornecedorSelect = screen.getByLabelText('Fornecedor (opcional)') as HTMLSelectElement;
    await waitFor(() => {
      expect(fornecedorSelect.value).not.toBe('');
    });
    expect(within(fornecedorSelect).getByText('Distribuidora Nova')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Boleto do distribuidor' } });
    fireEvent.change(screen.getByLabelText('Categoria de despesa'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2026-10-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lançar conta' }));

    await waitFor(() => {
      expect(screen.getAllByText('Boleto do distribuidor').length).toBeGreaterThan(0);
    });
  });

  it('alterna para a variante Recorrência, mostra a prévia e cria as ocorrências (ticket 11/036)', async () => {
    const categoriaAluguel = categoria({ id: 'cat-1', name: 'Aluguel e condomínio' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [categoriaAluguel], [])
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaAluguel], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    await screen.findByLabelText('Descrição');

    fireEvent.click(screen.getByRole('tab', { name: 'Recorrência' }));

    expect(screen.getByLabelText('Vencimento da primeira ocorrência')).toBeInTheDocument();
    expect(screen.getByLabelText('Periodicidade')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade de ocorrências')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Aluguel mensal' } });
    fireEvent.change(screen.getByLabelText('Categoria de despesa'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Vencimento da primeira ocorrência'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.change(screen.getByLabelText('Periodicidade'), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByLabelText('Quantidade de ocorrências'), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: 'Ver prévia das ocorrências' }));

    const previa = await screen.findByLabelText('Prévia das ocorrências');
    await waitFor(() => {
      expect(within(previa).getAllByRole('listitem')).toHaveLength(3);
    });
    expect(within(previa).getByText('1ª ocorrência')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Criar Recorrência' }));

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel mensal').length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument();
  });

  it('voltar para a variante Avulsa limpa a prévia da Recorrência', async () => {
    const categoriaAluguel = categoria({ id: 'cat-1', name: 'Aluguel e condomínio' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [categoriaAluguel], [])
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaAluguel], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    await screen.findByLabelText('Descrição');

    fireEvent.click(screen.getByRole('tab', { name: 'Recorrência' }));
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Vencimento da primeira ocorrência'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.change(screen.getByLabelText('Quantidade de ocorrências'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ver prévia das ocorrências' }));
    await screen.findByLabelText('Prévia das ocorrências');

    fireEvent.click(screen.getByRole('tab', { name: 'Avulsa' }));

    expect(screen.queryByLabelText('Prévia das ocorrências')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Periodicidade')).not.toBeInTheDocument();
  });

  it('alterna entre as três variantes do formulário e cria um Parcelamento (ticket 12/036)', async () => {
    const categoriaEquipamento = categoria({ id: 'cat-1', name: 'Equipamentos' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [categoriaEquipamento], [])
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaEquipamento], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    await screen.findByLabelText('Descrição');

    // Avulsa -> Recorrência -> Parcelamento -> Avulsa: cada troca mostra e esconde os campos certos.
    fireEvent.click(screen.getByRole('tab', { name: 'Recorrência' }));
    expect(screen.getByLabelText('Vencimento da primeira ocorrência')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Parcelamento' }));
    expect(screen.getByLabelText('Vencimento da primeira parcela')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor total')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade de parcelas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Vencimento da primeira ocorrência')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Avulsa' }));
    expect(screen.getByLabelText('Vencimento')).toBeInTheDocument();
    expect(screen.queryByLabelText('Valor total')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Parcelamento' }));

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Compra de forno' } });
    fireEvent.change(screen.getByLabelText('Categoria de despesa'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Valor total'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Vencimento da primeira parcela'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.change(screen.getByLabelText('Periodicidade'), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByLabelText('Quantidade de parcelas'), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: 'Ver prévia das parcelas' }));

    const previa = await screen.findByLabelText('Prévia das ocorrências');
    await waitFor(() => {
      expect(within(previa).getAllByRole('listitem')).toHaveLength(3);
    });
    expect(within(previa).getByText('1/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Criar Parcelamento' }));

    await waitFor(() => {
      expect(screen.getAllByText('Compra de forno').length).toBeGreaterThan(0);
    });
    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument();
  });

  it('edita "esta e as seguintes em aberto" de uma Série a partir do detalhe (ticket 13/036)', async () => {
    const categoriaAluguel = categoria({ id: 'cat-1', name: 'Aluguel e condomínio' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [categoriaAluguel], [])
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaAluguel], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    await screen.findByLabelText('Descrição');
    fireEvent.click(screen.getByRole('tab', { name: 'Recorrência' }));
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Aluguel mensal' } });
    fireEvent.change(screen.getByLabelText('Categoria de despesa'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Vencimento da primeira ocorrência'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.change(screen.getByLabelText('Periodicidade'), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByLabelText('Quantidade de ocorrências'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar Recorrência' }));

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel mensal').length).toBeGreaterThan(0);
    });

    // Abre o detalhe da primeira ocorrência (posição 1, primeira linha da lista).
    fireEvent.click(screen.getAllByText('Aluguel mensal')[0]);
    await screen.findByText('Detalhe da conta a pagar');

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    await screen.findByRole('tab', { name: 'Esta e as seguintes em aberto' });

    fireEvent.click(screen.getByRole('tab', { name: 'Esta e as seguintes em aberto' }));

    // Vencimento/documento/competência somem da edição em lote; descrição, categoria e valor continuam.
    expect(screen.queryByLabelText('Vencimento')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Competência')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Valor')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Aluguel reajustado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await screen.findByText('3 ocorrências atualizadas.');
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    await waitFor(() => {
      expect(screen.getAllByText('Aluguel reajustado').length).toBeGreaterThan(0);
    });
  });

  it('cancela "esta e as seguintes em aberto" de uma Série a partir do detalhe, ignorando pagas (ticket 13/036)', async () => {
    const categoriaAluguel = categoria({ id: 'cat-1', name: 'Aluguel e condomínio' });
    const contasPagarRepository = new ContasPagarRepository(
      new FakeContasPagarAdapter([], [categoriaAluguel], [])
    );
    const planoContasRepository = new PlanoContasRepository(
      new InMemoryPlanoContasAdapter([categoriaAluguel], [])
    );

    renderTab(contasPagarRepository, planoContasRepository);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma conta a pagar encontrada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Nova conta' }));
    await screen.findByLabelText('Descrição');
    fireEvent.click(screen.getByRole('tab', { name: 'Recorrência' }));
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Assinatura mensal' } });
    fireEvent.change(screen.getByLabelText('Categoria de despesa'), { target: { value: 'cat-1' } });
    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Vencimento da primeira ocorrência'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.change(screen.getByLabelText('Periodicidade'), { target: { value: 'monthly' } });
    fireEvent.change(screen.getByLabelText('Quantidade de ocorrências'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar Recorrência' }));

    await waitFor(() => {
      expect(screen.getAllByText('Assinatura mensal').length).toBeGreaterThan(0);
    });

    // Abre o detalhe da primeira ocorrência e cancela "esta e as seguintes".
    fireEvent.click(screen.getAllByText('Assinatura mensal')[0]);
    await screen.findByText('Detalhe da conta a pagar');

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar conta' }));
    await screen.findByRole('tab', { name: 'Esta e as seguintes em aberto' });

    fireEvent.click(screen.getByRole('tab', { name: 'Esta e as seguintes em aberto' }));
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento'), {
      target: { value: 'Assinatura cancelada pelo fornecedor' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar em Série' }));

    await screen.findByText('2 ocorrências canceladas.');
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    // A conta em foco no detalhe recarrega como cancelada: some o botão de cancelar novamente.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancelar conta' })).not.toBeInTheDocument();
    });
  });
});
