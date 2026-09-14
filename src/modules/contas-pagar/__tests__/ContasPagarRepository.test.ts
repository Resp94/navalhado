import { describe, expect, it, vi } from 'vitest';
import { ContasPagarRepository, ContasPagarValidationError } from '../ContasPagarRepository';
import type { Baixa, ContaPagar, ContaPagarListada, IContasPagarAdapter } from '../types';

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
    obterConta: vi.fn(),
    darBaixa: vi.fn(),
    estornarBaixa: vi.fn(),
    listarBaixas: vi.fn(),
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

function baixa(overrides: Partial<Baixa> = {}): Baixa {
  return {
    id: 'baixa-1',
    principal: 100,
    interestAmount: 0,
    discountAmount: 0,
    paidAmount: 100,
    paymentDate: '2026-09-13',
    paymentMethod: 'pix',
    source: 'fora_do_caixa',
    createdAt: '2026-09-13T10:00:00Z',
    createdBy: 'user-1',
    createdByName: 'Fulano',
    reversedAt: null,
    reversedBy: null,
    reversedByName: null,
    reversalReason: null,
    ...overrides,
  };
}

describe('ContasPagarRepository — obterConta', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.obterConta('', 'conta-1')).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.obterConta).not.toHaveBeenCalled();
  });

  it('recusa conta ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.obterConta('tenant-1', '')).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.obterConta).not.toHaveBeenCalled();
  });

  it('delega ao adaptador e devolve o resultado', async () => {
    const adapter = novoAdapter();
    const detalhe = { ...contaListada(), createdAt: '2026-09-13T10:00:00Z', createdBy: null, createdByName: null, updatedAt: '2026-09-13T10:00:00Z', updatedBy: null, updatedByName: null, cancelledAt: null, cancelledBy: null, cancelledByName: null, cancellationReason: null };
    vi.mocked(adapter.obterConta).mockResolvedValueOnce(detalhe);
    const repository = new ContasPagarRepository(adapter);

    const obtido = await repository.obterConta('tenant-1', 'conta-1');

    expect(adapter.obterConta).toHaveBeenCalledWith('tenant-1', 'conta-1');
    expect(obtido).toBe(detalhe);
  });
});

describe('ContasPagarRepository — darBaixa', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('', 'conta-1', { principal: 100, paymentDate: '2026-09-13', paymentMethod: 'pix' })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.darBaixa).not.toHaveBeenCalled();
  });

  it.each([0, -1, NaN])('recusa principal inválido: %s', async (principal) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', { principal, paymentDate: '2026-09-13', paymentMethod: 'pix' })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.darBaixa).not.toHaveBeenCalled();
  });

  it('recusa juros negativos', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-13',
        paymentMethod: 'pix',
        interestAmount: -1,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa desconto negativo', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-13',
        paymentMethod: 'pix',
        discountAmount: -1,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa desconto maior que principal mais juros', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-13',
        paymentMethod: 'pix',
        interestAmount: 5,
        discountAmount: 106,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa data do pagamento ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', { principal: 100, paymentDate: '', paymentMethod: 'pix' })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa forma de pagamento fora do domínio', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-13',
        // @ts-expect-error forma invalida de propósito
        paymentMethod: 'boleto_falso',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa origem gaveta (ainda não disponível)', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-13',
        paymentMethod: 'cash',
        source: 'gaveta',
      })
    ).rejects.toThrow('Baixa pela gaveta ainda não está disponível.');
    expect(adapter.darBaixa).not.toHaveBeenCalled();
  });

  it('aceita valor pago zero fora do caixa (desconto cobre principal e juros)', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.darBaixa).mockResolvedValueOnce(baixa({ paidAmount: 0 }));
    const repository = new ContasPagarRepository(adapter);

    await repository.darBaixa('tenant-1', 'conta-1', {
      principal: 100,
      paymentDate: '2026-09-13',
      paymentMethod: 'pix',
      discountAmount: 100,
    });

    expect(adapter.darBaixa).toHaveBeenCalledWith('tenant-1', 'conta-1', expect.objectContaining({
      principal: 100,
      discountAmount: 100,
      source: 'fora_do_caixa',
    }));
  });

  it('arredonda principal, juros e desconto a duas casas e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.darBaixa).mockResolvedValueOnce(baixa());
    const repository = new ContasPagarRepository(adapter);

    await repository.darBaixa('tenant-1', 'conta-1', {
      principal: 99.999,
      paymentDate: '2026-09-13',
      paymentMethod: 'pix',
      interestAmount: 1.005,
      discountAmount: 0.001,
    });

    expect(adapter.darBaixa).toHaveBeenCalledWith('tenant-1', 'conta-1', {
      principal: 100,
      paymentDate: '2026-09-13',
      paymentMethod: 'pix',
      interestAmount: 1,
      discountAmount: 0,
      source: 'fora_do_caixa',
      cashSessionId: null,
    });
  });

  it('devolve a Baixa criada pelo adaptador', async () => {
    const adapter = novoAdapter();
    const criada = baixa({ id: 'baixa-nova' });
    vi.mocked(adapter.darBaixa).mockResolvedValueOnce(criada);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.darBaixa('tenant-1', 'conta-1', {
      principal: 100,
      paymentDate: '2026-09-13',
      paymentMethod: 'pix',
    });

    expect(resultado).toBe(criada);
  });
});

describe('ContasPagarRepository — estornarBaixa', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.estornarBaixa('', 'baixa-1', 'motivo valido')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.estornarBaixa).not.toHaveBeenCalled();
  });

  it('recusa baixa ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.estornarBaixa('tenant-1', '', 'motivo valido')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.estornarBaixa).not.toHaveBeenCalled();
  });

  it('recusa motivo com menos de cinco caracteres', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.estornarBaixa('tenant-1', 'baixa-1', 'oi')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.estornarBaixa).not.toHaveBeenCalled();
  });

  it('normaliza o motivo (pontas aparadas) e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.estornarBaixa).mockResolvedValueOnce(baixa({ reversedAt: '2026-09-14T10:00:00Z' }));
    const repository = new ContasPagarRepository(adapter);

    await repository.estornarBaixa('tenant-1', 'baixa-1', '  lançada por engano  ');

    expect(adapter.estornarBaixa).toHaveBeenCalledWith('tenant-1', 'baixa-1', 'lançada por engano');
  });

  it('devolve a Baixa estornada pelo adaptador', async () => {
    const adapter = novoAdapter();
    const estornada = baixa({ reversedAt: '2026-09-14T10:00:00Z', reversalReason: 'engano' });
    vi.mocked(adapter.estornarBaixa).mockResolvedValueOnce(estornada);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.estornarBaixa('tenant-1', 'baixa-1', 'motivo valido');

    expect(resultado).toBe(estornada);
  });
});

describe('ContasPagarRepository — listarBaixas', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.listarBaixas('', 'conta-1')).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.listarBaixas).not.toHaveBeenCalled();
  });

  it('recusa conta ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.listarBaixas('tenant-1', '')).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.listarBaixas).not.toHaveBeenCalled();
  });

  it('delega ao adaptador e devolve o resultado', async () => {
    const adapter = novoAdapter();
    const lista = [baixa(), baixa({ id: 'baixa-2' })];
    vi.mocked(adapter.listarBaixas).mockResolvedValueOnce(lista);
    const repository = new ContasPagarRepository(adapter);

    const obtido = await repository.listarBaixas('tenant-1', 'conta-1');

    expect(adapter.listarBaixas).toHaveBeenCalledWith('tenant-1', 'conta-1');
    expect(obtido).toBe(lista);
  });
});
