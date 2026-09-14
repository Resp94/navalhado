import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ContasPagarTab } from '../ContasPagarTab';
import { ContasPagarRepository } from '../../../../modules/contas-pagar/ContasPagarRepository';
import { PlanoContasRepository } from '../../../../modules/plano-contas/PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../../../../modules/plano-contas/adapters/InMemoryPlanoContasAdapter';
import type { CategoriaDespesa, Fornecedor } from '../../../../modules/plano-contas/types';
import type {
  ContaPagar,
  ContaPagarListada,
  DadosContaPagarAvulsa,
  FiltroListaContasPagar,
  IContasPagarAdapter,
  ListaContasPagarResultado,
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
  private proximoId = 1;

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
});
