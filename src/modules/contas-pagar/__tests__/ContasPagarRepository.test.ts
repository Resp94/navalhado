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
    editarConta: vi.fn(),
    cancelarConta: vi.fn(),
    obterTotais: vi.fn(),
    obterAlerta: vi.fn(),
    visualizarPreviaSerie: vi.fn(),
    criarRecorrencia: vi.fn(),
    criarParcelamento: vi.fn(),
    editarSerie: vi.fn(),
    cancelarSerie: vi.fn(),
    visualizarPreviaExtensaoSerie: vi.fn(),
    estenderRecorrencia: vi.fn(),
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
      categoryId: null,
      supplierId: null,
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
      categoryId: null,
      supplierId: null,
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
    const detalhe = { ...contaListada(), createdAt: '2026-09-13T10:00:00Z', createdBy: null, createdByName: null, updatedAt: '2026-09-13T10:00:00Z', updatedBy: null, updatedByName: null, cancelledAt: null, cancelledBy: null, cancelledByName: null, cancellationReason: null, seriesType: null, seriesPeriodicity: null, seriesOccurrencesCount: null, seriesEndingSoon: null, seriesLastDueDate: null };
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

  it('recusa origem gaveta sem sessão de caixa informada (ticket 15/036)', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-13',
        paymentMethod: 'cash',
        source: 'gaveta',
      })
    ).rejects.toThrow('Sessão de caixa é obrigatória para Baixa pela gaveta.');
    expect(adapter.darBaixa).not.toHaveBeenCalled();
  });

  it('recusa origem gaveta com forma diferente de dinheiro (ticket 15/036)', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.darBaixa('tenant-1', 'conta-1', {
        principal: 100,
        paymentDate: '2026-09-13',
        paymentMethod: 'pix',
        source: 'gaveta',
        cashSessionId: 'sessao-1',
      })
    ).rejects.toThrow('Baixa pela gaveta só aceita a forma de pagamento dinheiro.');
    expect(adapter.darBaixa).not.toHaveBeenCalled();
  });

  it('delega Baixa pela gaveta ao adaptador com a sessão de caixa (ticket 15/036)', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.darBaixa).mockResolvedValueOnce(baixa({ source: 'gaveta' }));
    const repository = new ContasPagarRepository(adapter);

    await repository.darBaixa('tenant-1', 'conta-1', {
      principal: 60,
      paymentDate: '',
      paymentMethod: 'cash',
      source: 'gaveta',
      cashSessionId: 'sessao-1',
    });

    expect(adapter.darBaixa).toHaveBeenCalledWith(
      'tenant-1',
      'conta-1',
      expect.objectContaining({
        principal: 60,
        paymentMethod: 'cash',
        source: 'gaveta',
        cashSessionId: 'sessao-1',
      })
    );
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

describe('ContasPagarRepository — editarConta', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarConta('', 'conta-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.editarConta).not.toHaveBeenCalled();
  });

  it('recusa conta ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarConta('tenant-1', '', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.editarConta).not.toHaveBeenCalled();
  });

  it('recusa descrição inválida', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarConta('tenant-1', 'conta-1', {
        description: 'a',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.editarConta).not.toHaveBeenCalled();
  });

  it('recusa categoria ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarConta('tenant-1', 'conta-1', {
        description: 'Aluguel',
        categoryId: '',
        amount: 100,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa valor inválido', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarConta('tenant-1', 'conta-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 0,
        dueDate: '2026-09-30',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa vencimento ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarConta('tenant-1', 'conta-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        amount: 100,
        dueDate: '',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('normaliza a descrição, arredonda o valor e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.editarConta).mockResolvedValueOnce(contaPagar());
    const repository = new ContasPagarRepository(adapter);

    await repository.editarConta('tenant-1', 'conta-1', {
      description: '  Aluguel   de   Outubro  ',
      categoryId: 'cat-1',
      amount: 99.999,
      dueDate: '2026-10-30',
      supplierId: 'sup-1',
      competenceDate: '2026-10-30',
      documentNumber: 'NF-2',
      notes: 'obs',
    });

    expect(adapter.editarConta).toHaveBeenCalledWith('tenant-1', 'conta-1', {
      description: 'Aluguel de Outubro',
      categoryId: 'cat-1',
      amount: 100,
      dueDate: '2026-10-30',
      supplierId: 'sup-1',
      competenceDate: '2026-10-30',
      documentNumber: 'NF-2',
      notes: 'obs',
    });
  });

  it('devolve a conta editada pelo adaptador', async () => {
    const adapter = novoAdapter();
    const editada = contaPagar({ description: 'Editada' });
    vi.mocked(adapter.editarConta).mockResolvedValueOnce(editada);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.editarConta('tenant-1', 'conta-1', {
      description: 'Editada',
      categoryId: 'cat-1',
      amount: 100,
      dueDate: '2026-09-30',
    });

    expect(resultado).toBe(editada);
  });
});

describe('ContasPagarRepository — cancelarConta', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.cancelarConta('', 'conta-1', 'motivo valido')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.cancelarConta).not.toHaveBeenCalled();
  });

  it('recusa conta ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.cancelarConta('tenant-1', '', 'motivo valido')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.cancelarConta).not.toHaveBeenCalled();
  });

  it('recusa motivo com menos de cinco caracteres', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.cancelarConta('tenant-1', 'conta-1', 'oi')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.cancelarConta).not.toHaveBeenCalled();
  });

  it('normaliza o motivo e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.cancelarConta).mockResolvedValueOnce(contaPagar({ status: 'cancelled' }));
    const repository = new ContasPagarRepository(adapter);

    await repository.cancelarConta('tenant-1', 'conta-1', '  lançada em duplicidade  ');

    expect(adapter.cancelarConta).toHaveBeenCalledWith('tenant-1', 'conta-1', 'lançada em duplicidade');
  });

  it('devolve a conta cancelada pelo adaptador', async () => {
    const adapter = novoAdapter();
    const cancelada = contaPagar({ status: 'cancelled' });
    vi.mocked(adapter.cancelarConta).mockResolvedValueOnce(cancelada);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.cancelarConta('tenant-1', 'conta-1', 'motivo valido');

    expect(resultado).toBe(cancelada);
  });
});

describe('ContasPagarRepository — listarContas (filtro de categoria e fornecedor)', () => {
  it('repassa categoria e fornecedor do filtro', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.listarContas).mockResolvedValueOnce({ contas: [], totalCount: 0 });
    const repository = new ContasPagarRepository(adapter);

    await repository.listarContas('tenant-1', { categoryId: 'cat-1', supplierId: 'sup-1' });

    expect(adapter.listarContas).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ categoryId: 'cat-1', supplierId: 'sup-1' })
    );
  });

  it('categoria e fornecedor ausentes viram null', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.listarContas).mockResolvedValueOnce({ contas: [], totalCount: 0 });
    const repository = new ContasPagarRepository(adapter);

    await repository.listarContas('tenant-1');

    expect(adapter.listarContas).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ categoryId: null, supplierId: null })
    );
  });
});

describe('ContasPagarRepository — obterTotais', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.obterTotais('')).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.obterTotais).not.toHaveBeenCalled();
  });

  it('aplica valores padrão nulos ao filtro', async () => {
    const adapter = novoAdapter();
    const totais = { openBalance: 100, overdueBalance: 40, paidInPeriod: 60 };
    vi.mocked(adapter.obterTotais).mockResolvedValueOnce(totais);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.obterTotais('tenant-1');

    expect(adapter.obterTotais).toHaveBeenCalledWith('tenant-1', {
      dueDateFrom: null,
      dueDateTo: null,
      categoryId: null,
      supplierId: null,
    });
    expect(resultado).toBe(totais);
  });

  it('repassa período, categoria e fornecedor informados', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.obterTotais).mockResolvedValueOnce({
      openBalance: 0,
      overdueBalance: 0,
      paidInPeriod: 0,
    });
    const repository = new ContasPagarRepository(adapter);

    await repository.obterTotais('tenant-1', {
      dueDateFrom: '2026-09-01',
      dueDateTo: '2026-09-30',
      categoryId: 'cat-1',
      supplierId: 'sup-1',
    });

    expect(adapter.obterTotais).toHaveBeenCalledWith('tenant-1', {
      dueDateFrom: '2026-09-01',
      dueDateTo: '2026-09-30',
      categoryId: 'cat-1',
      supplierId: 'sup-1',
    });
  });
});

describe('ContasPagarRepository — obterAlerta', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.obterAlerta('')).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.obterAlerta).not.toHaveBeenCalled();
  });

  it('delega ao adaptador e devolve o resultado', async () => {
    const adapter = novoAdapter();
    const alerta = { overdueCount: 2, overdueBalance: 300, dueTodayCount: 1, dueTodayBalance: 50 };
    vi.mocked(adapter.obterAlerta).mockResolvedValueOnce(alerta);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.obterAlerta('tenant-1');

    expect(adapter.obterAlerta).toHaveBeenCalledWith('tenant-1');
    expect(resultado).toBe(alerta);
  });
});

describe('ContasPagarRepository — visualizarPreviaSerie', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.visualizarPreviaSerie('', {
        seriesType: 'recurring',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.visualizarPreviaSerie).not.toHaveBeenCalled();
  });

  it('recusa periodicidade inválida', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.visualizarPreviaSerie('tenant-1', {
        seriesType: 'recurring',
        // @ts-expect-error periodicidade invalida de proposito
        periodicity: 'daily',
        anchorDate: '2026-09-30',
        occurrences: 3,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa data âncora ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.visualizarPreviaSerie('tenant-1', {
        seriesType: 'recurring',
        periodicity: 'monthly',
        anchorDate: '',
        occurrences: 3,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it.each([0, 61])('recusa quantidade fora de 1 a 60 para Recorrência: %s', async (occurrences) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.visualizarPreviaSerie('tenant-1', {
        seriesType: 'recurring',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa quantidade 1 para Parcelamento (mínimo é 2)', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.visualizarPreviaSerie('tenant-1', {
        seriesType: 'installment',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 1,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa valor inválido', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.visualizarPreviaSerie('tenant-1', {
        seriesType: 'recurring',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        amount: 0,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('delega ao adaptador com o valor arredondado', async () => {
    const adapter = novoAdapter();
    const previa = [{ position: 1, dueDate: '2026-09-30', amount: 100 }];
    vi.mocked(adapter.visualizarPreviaSerie).mockResolvedValueOnce(previa);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.visualizarPreviaSerie('tenant-1', {
      seriesType: 'recurring',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 3,
      amount: 99.999,
    });

    expect(adapter.visualizarPreviaSerie).toHaveBeenCalledWith('tenant-1', {
      seriesType: 'recurring',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 3,
      amount: 100,
    });
    expect(resultado).toBe(previa);
  });
});

describe('ContasPagarRepository — criarRecorrencia', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarRecorrencia('', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.criarRecorrencia).not.toHaveBeenCalled();
  });

  it('recusa descrição inválida', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarRecorrencia('tenant-1', {
        description: 'a',
        categoryId: 'cat-1',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa categoria ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarRecorrencia('tenant-1', {
        description: 'Aluguel',
        categoryId: '',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it.each([0, 61])('recusa quantidade fora de 1 a 60: %s', async (occurrences) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarRecorrencia('tenant-1', {
        description: 'Aluguel',
        categoryId: 'cat-1',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences,
        amount: 100,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('normaliza a descrição, arredonda o valor e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.criarRecorrencia).mockResolvedValueOnce([contaPagar()]);
    const repository = new ContasPagarRepository(adapter);

    await repository.criarRecorrencia('tenant-1', {
      description: '  Aluguel   Mensal  ',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 3,
      amount: 99.999,
      supplierId: 'sup-1',
      documentNumber: 'NF-1',
      notes: 'obs',
    });

    expect(adapter.criarRecorrencia).toHaveBeenCalledWith('tenant-1', {
      description: 'Aluguel Mensal',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 3,
      amount: 100,
      supplierId: 'sup-1',
      documentNumber: 'NF-1',
      notes: 'obs',
    });
  });

  it('devolve as contas criadas pelo adaptador', async () => {
    const adapter = novoAdapter();
    const criadas = [contaPagar({ id: 'conta-1' }), contaPagar({ id: 'conta-2' })];
    vi.mocked(adapter.criarRecorrencia).mockResolvedValueOnce(criadas);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.criarRecorrencia('tenant-1', {
      description: 'Aluguel',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 2,
      amount: 100,
    });

    expect(resultado).toBe(criadas);
  });
});

describe('ContasPagarRepository — criarParcelamento', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarParcelamento('', {
        description: 'Compra de equipamento',
        categoryId: 'cat-1',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        totalAmount: 300,
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.criarParcelamento).not.toHaveBeenCalled();
  });

  it('recusa descrição inválida', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarParcelamento('tenant-1', {
        description: 'a',
        categoryId: 'cat-1',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        totalAmount: 300,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa categoria ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarParcelamento('tenant-1', {
        description: 'Compra de equipamento',
        categoryId: '',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences: 3,
        totalAmount: 300,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it.each([1, 61])('recusa quantidade fora de 2 a 60: %s', async (occurrences) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.criarParcelamento('tenant-1', {
        description: 'Compra de equipamento',
        categoryId: 'cat-1',
        periodicity: 'monthly',
        anchorDate: '2026-09-30',
        occurrences,
        totalAmount: 300,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('normaliza a descrição, arredonda o valor e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.criarParcelamento).mockResolvedValueOnce([contaPagar()]);
    const repository = new ContasPagarRepository(adapter);

    await repository.criarParcelamento('tenant-1', {
      description: '  Compra   de   equipamento  ',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 3,
      totalAmount: 99.999,
      competenceDate: '2026-09-30',
      supplierId: 'sup-1',
      documentNumber: 'NF-1',
      notes: 'obs',
    });

    expect(adapter.criarParcelamento).toHaveBeenCalledWith('tenant-1', {
      description: 'Compra de equipamento',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 3,
      totalAmount: 100,
      competenceDate: '2026-09-30',
      supplierId: 'sup-1',
      documentNumber: 'NF-1',
      notes: 'obs',
    });
  });

  it('devolve as contas criadas pelo adaptador', async () => {
    const adapter = novoAdapter();
    const criadas = [contaPagar({ id: 'conta-1' }), contaPagar({ id: 'conta-2' })];
    vi.mocked(adapter.criarParcelamento).mockResolvedValueOnce(criadas);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.criarParcelamento('tenant-1', {
      description: 'Compra de equipamento',
      categoryId: 'cat-1',
      periodicity: 'monthly',
      anchorDate: '2026-09-30',
      occurrences: 2,
      totalAmount: 300,
    });

    expect(resultado).toBe(criadas);
  });
});

describe('ContasPagarRepository — editarSerie', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarSerie('', 'conta-1', {
        description: 'Aluguel reajustado',
        categoryId: 'cat-1',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.editarSerie).not.toHaveBeenCalled();
  });

  it('recusa conta ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarSerie('tenant-1', '', {
        description: 'Aluguel reajustado',
        categoryId: 'cat-1',
      })
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.editarSerie).not.toHaveBeenCalled();
  });

  it('recusa descrição inválida', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarSerie('tenant-1', 'conta-1', {
        description: 'a',
        categoryId: 'cat-1',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa categoria ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarSerie('tenant-1', 'conta-1', {
        description: 'Aluguel reajustado',
        categoryId: '',
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('recusa valor zero ou negativo quando informado', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.editarSerie('tenant-1', 'conta-1', {
        description: 'Aluguel reajustado',
        categoryId: 'cat-1',
        amount: 0,
      })
    ).rejects.toThrow(ContasPagarValidationError);
  });

  it('normaliza a descrição, arredonda o valor e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.editarSerie).mockResolvedValueOnce([]);
    const repository = new ContasPagarRepository(adapter);

    await repository.editarSerie('tenant-1', 'conta-1', {
      description: '  Aluguel   reajustado  ',
      categoryId: 'cat-1',
      supplierId: 'sup-1',
      notes: 'obs',
      amount: 599.999,
    });

    expect(adapter.editarSerie).toHaveBeenCalledWith('tenant-1', 'conta-1', {
      description: 'Aluguel reajustado',
      categoryId: 'cat-1',
      supplierId: 'sup-1',
      notes: 'obs',
      amount: 600,
    });
  });

  it('delega valor nulo quando não informado (Parcelamento não aceita valor em lote)', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.editarSerie).mockResolvedValueOnce([]);
    const repository = new ContasPagarRepository(adapter);

    await repository.editarSerie('tenant-1', 'conta-1', {
      description: 'Parcela renomeada',
      categoryId: 'cat-1',
    });

    expect(adapter.editarSerie).toHaveBeenCalledWith('tenant-1', 'conta-1', {
      description: 'Parcela renomeada',
      categoryId: 'cat-1',
      supplierId: null,
      notes: null,
      amount: null,
    });
  });

  it('devolve as ocorrências atingidas pelo adaptador', async () => {
    const adapter = novoAdapter();
    const atingidas = [
      { id: 'conta-1', seriesPosition: 1, status: 'open' as const, ignored: false, ignoreReason: null },
      {
        id: 'conta-2',
        seriesPosition: 2,
        status: 'paid' as const,
        ignored: true,
        ignoreReason: 'Conta paga não é alterada em lote.',
      },
    ];
    vi.mocked(adapter.editarSerie).mockResolvedValueOnce(atingidas);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.editarSerie('tenant-1', 'conta-1', {
      description: 'Aluguel reajustado',
      categoryId: 'cat-1',
    });

    expect(resultado).toBe(atingidas);
  });
});

describe('ContasPagarRepository — cancelarSerie', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.cancelarSerie('', 'conta-1', 'motivo valido')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.cancelarSerie).not.toHaveBeenCalled();
  });

  it('recusa conta ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.cancelarSerie('tenant-1', '', 'motivo valido')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.cancelarSerie).not.toHaveBeenCalled();
  });

  it('recusa motivo com menos de cinco caracteres', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.cancelarSerie('tenant-1', 'conta-1', 'oi')).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.cancelarSerie).not.toHaveBeenCalled();
  });

  it('normaliza o motivo e delega ao adaptador', async () => {
    const adapter = novoAdapter();
    vi.mocked(adapter.cancelarSerie).mockResolvedValueOnce([]);
    const repository = new ContasPagarRepository(adapter);

    await repository.cancelarSerie('tenant-1', 'conta-1', '  contrato encerrado  ');

    expect(adapter.cancelarSerie).toHaveBeenCalledWith('tenant-1', 'conta-1', 'contrato encerrado');
  });

  it('devolve as ocorrências atingidas pelo adaptador', async () => {
    const adapter = novoAdapter();
    const atingidas = [
      { id: 'conta-4', seriesPosition: 4, status: 'cancelled' as const, ignored: false, ignoreReason: null },
      {
        id: 'conta-2',
        seriesPosition: 2,
        status: 'partially_paid' as const,
        ignored: true,
        ignoreReason: 'Conta parcialmente paga não é cancelada em lote.',
      },
    ];
    vi.mocked(adapter.cancelarSerie).mockResolvedValueOnce(atingidas);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.cancelarSerie('tenant-1', 'conta-4', 'contrato encerrado');

    expect(resultado).toBe(atingidas);
  });
});

describe('ContasPagarRepository — visualizarPreviaExtensaoSerie', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.visualizarPreviaExtensaoSerie('', 'serie-1', 3)).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.visualizarPreviaExtensaoSerie).not.toHaveBeenCalled();
  });

  it('recusa série ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.visualizarPreviaExtensaoSerie('tenant-1', '', 3)).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.visualizarPreviaExtensaoSerie).not.toHaveBeenCalled();
  });

  it.each([0, 61])('recusa quantidade fora de 1 a 60: %s', async (occurrences) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(
      repository.visualizarPreviaExtensaoSerie('tenant-1', 'serie-1', occurrences)
    ).rejects.toThrow(ContasPagarValidationError);
    expect(adapter.visualizarPreviaExtensaoSerie).not.toHaveBeenCalled();
  });

  it('delega ao adaptador', async () => {
    const adapter = novoAdapter();
    const previa = [{ seriesPosition: 3, dueDate: '2026-11-30', amount: 500 }];
    vi.mocked(adapter.visualizarPreviaExtensaoSerie).mockResolvedValueOnce(previa);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.visualizarPreviaExtensaoSerie('tenant-1', 'serie-1', 3);

    expect(adapter.visualizarPreviaExtensaoSerie).toHaveBeenCalledWith('tenant-1', 'serie-1', 3);
    expect(resultado).toBe(previa);
  });
});

describe('ContasPagarRepository — estenderRecorrencia', () => {
  it('recusa unidade ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.estenderRecorrencia('', 'serie-1', 3)).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.estenderRecorrencia).not.toHaveBeenCalled();
  });

  it('recusa série ausente', async () => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.estenderRecorrencia('tenant-1', '', 3)).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.estenderRecorrencia).not.toHaveBeenCalled();
  });

  it.each([0, 61])('recusa quantidade fora de 1 a 60: %s', async (occurrences) => {
    const adapter = novoAdapter();
    const repository = new ContasPagarRepository(adapter);

    await expect(repository.estenderRecorrencia('tenant-1', 'serie-1', occurrences)).rejects.toThrow(
      ContasPagarValidationError
    );
    expect(adapter.estenderRecorrencia).not.toHaveBeenCalled();
  });

  it('delega ao adaptador e devolve as contas criadas', async () => {
    const adapter = novoAdapter();
    const criadas = [contaPagar({ id: 'conta-3' })];
    vi.mocked(adapter.estenderRecorrencia).mockResolvedValueOnce(criadas);
    const repository = new ContasPagarRepository(adapter);

    const resultado = await repository.estenderRecorrencia('tenant-1', 'serie-1', 3);

    expect(adapter.estenderRecorrencia).toHaveBeenCalledWith('tenant-1', 'serie-1', 3);
    expect(resultado).toBe(criadas);
  });
});
