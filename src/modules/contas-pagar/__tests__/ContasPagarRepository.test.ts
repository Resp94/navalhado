import { describe, expect, it, vi } from 'vitest';
import { ContasPagarRepository, ContasPagarValidationError } from '../ContasPagarRepository';
import type { ContaPagar, ContaPagarListada, IContasPagarAdapter } from '../types';

function contaPagar(overrides: Partial<ContaPagar> = {}): ContaPagar {
  return {
    id: 'conta-1',
    tenant_id: 'tenant-1',
    description: 'Aluguel de setembro',
    category_id: 'cat-1',
    supplier_id: null,
    amount: 1200,
    paid_amount: 0,
    status: 'open',
    due_date: '2026-09-30',
    competence_date: '2026-09-30',
    document_number: null,
    notes: null,
    series_id: null,
    series_position: null,
    created_at: '2026-09-13T10:00:00Z',
    created_by: 'user-1',
    updated_at: '2026-09-13T10:00:00Z',
    updated_by: 'user-1',
    cancelled_at: null,
    cancelled_by: null,
    cancellation_reason: null,
    ...overrides,
  };
}

function contaListada(overrides: Partial<ContaPagarListada> = {}): ContaPagarListada {
  return {
    id: 'conta-1',
    description: 'Aluguel de setembro',
    category_id: 'cat-1',
    category_name: 'Aluguel e condomínio',
    category_archived: false,
    supplier_id: null,
    supplier_name: null,
    supplier_archived: null,
    amount: 1200,
    paid_amount: 0,
    remaining_amount: 1200,
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

function novoAdapter(): IContasPagarAdapter {
  return {
    criarContaAvulsa: vi.fn(),
    listarContas: vi.fn(),
  };
}

describe('ContasPagarRepository — criarContaAvulsa', () => {
  it('normaliza a descrição (pontas aparadas, espaços internos colapsados) e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.criarContaAvulsa).mockResolvedValueOnce(contaPagar());
    const repository = new ContasPagarRepository(adapter);

    await repository.criarContaAvulsa('tenant-1', {
      description: '  Aluguel   de   Setembro  ',
      categoryId: 'cat-1',
      amount: 1200,
      dueDate: '2026-09-30',
    });

    expect(adapter.criarContaAvulsa).toHaveBeenCalledWith('tenant-1', {
      description: 'Aluguel de Setembro',
      categoryId: 'cat-1',
      amount: 1200,
      dueDate: '2026-09-30',
      supplierId: null,
      competenceDate: null,
      documentNumber: null,
      notes: null,
    });
  });

  it('arredonda o valor a duas casas antes de delegar', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.criarContaAvulsa).mockResolvedValueOnce(contaPagar());
    const repository = new ContasPagarRepository(adapter);

    await repository.criarContaAvulsa('tenant-1', {
      description: 'Conta com centavos',
      categoryId: 'cat-1',
      amount: 99.999,
      dueDate: '2026-09-30',
    });

    expect(adapter.criarContaAvulsa).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ amount: 100 })
    );
  });

  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.criarContaAvulsa).not.toHaveBeenCalled();
  });

  it.each([
    ['', 'descrição vazia'],
    ['a', 'descrição com um caractere'],
  ])('recusa descrição inválida: %s (%s)', async (description) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('tenant-1', {
        description,
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.criarContaAvulsa).not.toHaveBeenCalled();
  });

  it('recusa descrição maior que 200 caracteres', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('tenant-1', {
        description: 'a'.repeat(201),
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa categoria ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('tenant-1', {
        description: 'Aluguel',
        categoryId: '',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.criarContaAvulsa).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN])('recusa valor inválido: %s', async (amount) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.criarContaAvulsa).not.toHaveBeenCalled();
  });

  it('recusa vencimento ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.criarContaAvulsa).not.toHaveBeenCalled();
  });

  it('recusa número do documento maior que 60 caracteres', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
        documentNumber: 'x'.repeat(61),
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa observação maior que 500 caracteres', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarContaAvulsa('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
        notes: 'x'.repeat(501),
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('repassa fornecedor, competência, documento e observação opcionais', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.criarContaAvulsa).mockResolvedValueOnce(contaPagar());
    const repository = new ContasPagarRepository(adapter);

    await repository.criarContaAvulsa('tenant-1', {
      description: 'Boleto do distribuidor',
      categoryId: 'cat-1',
      amount: 300,
      dueDate: '2026-10-05',
      supplierId: 'sup-1',
      competenceDate: '2026-09-30',
      documentNumber: 'NF-1234',
      notes: 'Pago em 3x',
    });

    expect(adapter.criarContaAvulsa).toHaveBeenCalledWith('tenant-1', {
      description: 'Boleto do distribuidor',
      categoryId: 'cat-1',
      amount: 300,
      dueDate: '2026-10-05',
      supplierId: 'sup-1',
      competenceDate: '2026-09-30',
      documentNumber: 'NF-1234',
      notes: 'Pago em 3x',
    });
  });

  it('devolve a conta criada pelo adaptador', async () => {
    const adapter = novoAdapter();
    const criada = contaPagar({ id: 'conta-nova' });
    vi.mocked(adapter.criarContaAvulsa).mockResolvedValueOnce(criada);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.criarContaAvulsa('tenant-1', {
      description: 'Aluguel',
      categoryId: 'cat-1',
      amount: 100,
      dueDate: '2026-09-30',
    });

    expect(resultado).toBe(criada);
  });
});

describe('ContasPagarRepository — listarContas', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.listarContas('')).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.listarContas).not.toHaveBeenCalled();
  });

  it('aplica valores padrão de status, página e tamanho de página', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.listarContas).mockResolvedValueOnce({ contas: [], totalCount: 0 });
    const repository = new ContasPagarRepository(adapter);

    await repository.listarContas('tenant-1');

    expect(adapter.listarContas).toHaveBeenCalledWith('tenant-1', {
      dueDateFrom: null,
      dueDateTo: null,
      status: 'not_cancelled',
      page: 1,
      pageSize: 20,
    });
  });

  it('repassa filtro de período e estado informados', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.listarContas).mockResolvedValueOnce({ contas: [], totalCount: 0 });
    const repository = new ContasPagarRepository(adapter);

    await repository.listarContas('tenant-1', {
      dueDateFrom: '2026-09-01',
      dueDateTo: '2026-09-30',
      status: 'overdue',
      page: 2,
      pageSize: 10,
    });

    expect(adapter.listarContas).toHaveBeenCalledWith('tenant-1', {
      dueDateFrom: '2026-09-01',
      dueDateTo: '2026-09-30',
      status: 'overdue',
      page: 2,
      pageSize: 10,
    });
  });

  it('limita o tamanho de página a 100', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.listarContas).mockResolvedValueOnce({ contas: [], totalCount: 0 });
    const repository = new ContasPagarRepository(adapter);

    await repository.listarContas('tenant-1', { pageSize: 500 });

    expect(adapter.listarContas).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ pageSize: 100 })
    );
  });

  it('devolve o resultado do adaptador', async () => {
    const adapter = novoAdapter();
    const resultado = { contas: [contaListada()], totalCount: 1 };
    vi.mocked(adapter.listarContas).mockResolvedValueOnce(resultado);
    const repository = new ContasPagarRepository(adapter);

    const obtido = await repository.listarContas('tenant-1');

    expect(obtido).toBe(resultado);
  });
});
