import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ContasPagarTab } from '../ContasPagarTab';
import { ContasPagarRepository } from '../../../../modules/contas-pagar/ContasPagarRepository';
import { PlanoContasRepository } from '../../../../modules/plano-contas/PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../../../../modules/plano-contas/adapters/InMemoryPlanoContasAdapter';
import type { CategoriaDespesa, Fornecedor } from '../../../../modules/plano-contas/types';
import type {
  Baixa,
  ContaPagar,
  ContaPagarDetalhe,
  ContaPagarListada,
  DadosBaixa,
  DadosContaPagarAvulsa,
  DadosEdicaoContaPagar,
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
  private baixasPorConta: Record<string, Baixa[]> = {};
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
});
