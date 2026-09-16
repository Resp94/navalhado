import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlanoContasRepository,
  PlanoContasValidationError,
  PlanoContasConflictError,
} from '../PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../adapters/InMemoryPlanoContasAdapter';
import type { CategoriaDespesa, Fornecedor } from '../types';

describe('PlanoContasRepository', () => {
  let adapter: InMemoryPlanoContasAdapter;
  let repo: PlanoContasRepository;
  const tenantId = 'tenant-1';

  const categorias: CategoriaDespesa[] = [
    {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: 'marketing',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    },
    {
      id: 'cat-2',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Água',
      seed_key: 'agua',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    },
    {
      id: 'cat-3',
      tenant_id: 'outro-tenant',
      nature: 'expense',
      name: 'Aluguel e condomínio',
      seed_key: 'aluguel_condominio',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    },
  ];

  beforeEach(() => {
    adapter = new InMemoryPlanoContasAdapter(categorias);
    repo = new PlanoContasRepository(adapter);
  });

  it('lista as Categorias de Despesa do tenant ordenadas alfabeticamente em português', async () => {
    const list = await repo.listarCategoriasDespesa(tenantId);
    expect(list.map((c) => c.name)).toEqual(['Água', 'Marketing']);
  });

  it('não devolve categorias de outro tenant', async () => {
    const list = await repo.listarCategoriasDespesa(tenantId);
    expect(list.find((c) => c.tenant_id === 'outro-tenant')).toBeUndefined();
  });

  it('recusa listar sem tenant informado', async () => {
    await expect(repo.listarCategoriasDespesa('')).rejects.toThrow(PlanoContasValidationError);
  });
});

describe('PlanoContasRepository — escrita de Categoria de Despesa (ticket 04)', () => {
  const tenantId = 'tenant-1';

  // Cada teste usa seu próprio adaptador com fixtures locais (não o array
  // `categorias` compartilhado acima): os métodos de escrita mutam o objeto,
  // e reaproveitar objetos entre testes vazaria mutação de um teste para o
  // outro.
  function novoAdapter(categorias: CategoriaDespesa[] = []) {
    const adapter = new InMemoryPlanoContasAdapter(categorias);
    return { adapter, repo: new PlanoContasRepository(adapter) };
  }

  it('cria categoria normalizando o nome (pontas aparadas, espaços internos colapsados)', async () => {
    const { repo } = novoAdapter();
    const categoria = await repo.criarCategoriaDespesa(tenantId, '  Estacionamento   Coberto  ');
    expect(categoria.name).toBe('Estacionamento Coberto');
    expect(categoria.tenant_id).toBe(tenantId);
    expect(categoria.archived_at).toBeNull();
  });

  it.each(['', ' ', 'A', 'x'.repeat(61)])('recusa criar com nome inválido (%j)', async (nome) => {
    const { repo } = novoAdapter();
    await expect(repo.criarCategoriaDespesa(tenantId, nome)).rejects.toThrow(PlanoContasValidationError);
  });

  it('recusa criar sem tenant informado', async () => {
    const { repo } = novoAdapter();
    await expect(repo.criarCategoriaDespesa('', 'Marketing')).rejects.toThrow(PlanoContasValidationError);
  });

  it('propaga conflito de nome (sem diferenciar maiúsculas) do adaptador como PlanoContasConflictError', async () => {
    const existente: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([existente]);

    const erro = await repo.criarCategoriaDespesa(tenantId, 'marketing').catch((e) => e);
    expect(erro).toBeInstanceOf(PlanoContasConflictError);
    expect((erro as PlanoContasConflictError).existingId).toBe('cat-1');
    expect((erro as PlanoContasConflictError).existingName).toBe('Marketing');
    expect((erro as PlanoContasConflictError).archived).toBe(false);
  });

  it('renomeia categoria normalizando o nome', async () => {
    const categoria: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Energia',
      seed_key: 'energia',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([categoria]);

    const renomeada = await repo.renomearCategoriaDespesa(tenantId, 'cat-1', '  Energia   Elétrica  ');
    expect(renomeada.name).toBe('Energia Elétrica');
  });

  it('recusa renomear categoria arquivada', async () => {
    const arquivada: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: '2026-02-01T00:00:00Z',
      archived_by: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([arquivada]);

    await expect(repo.renomearCategoriaDespesa(tenantId, 'cat-1', 'Novo nome')).rejects.toThrow(
      PlanoContasValidationError
    );
  });

  it('recusa renomear sem categoria informada', async () => {
    const { repo } = novoAdapter();
    await expect(repo.renomearCategoriaDespesa(tenantId, '', 'Novo nome')).rejects.toThrow(
      PlanoContasValidationError
    );
  });

  it('arquiva categoria ativa', async () => {
    const categoria: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([categoria]);

    const arquivada = await repo.arquivarCategoriaDespesa(tenantId, 'cat-1');
    expect(arquivada.archived_at).not.toBeNull();
  });

  it('recusa arquivar categoria já arquivada (dupla operação, nunca em silêncio)', async () => {
    const arquivada: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: '2026-02-01T00:00:00Z',
      archived_by: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([arquivada]);

    await expect(repo.arquivarCategoriaDespesa(tenantId, 'cat-1')).rejects.toThrow(PlanoContasValidationError);
  });

  it('reativa categoria arquivada', async () => {
    const arquivada: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: '2026-02-01T00:00:00Z',
      archived_by: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([arquivada]);

    const reativada = await repo.reativarCategoriaDespesa(tenantId, 'cat-1');
    expect(reativada.archived_at).toBeNull();
  });

  it('recusa reativar categoria já ativa (dupla operação, nunca em silêncio)', async () => {
    const categoria: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([categoria]);

    await expect(repo.reativarCategoriaDespesa(tenantId, 'cat-1')).rejects.toThrow(PlanoContasValidationError);
  });

  it('conflito contra categoria arquivada identifica o registro e informa que está arquivada', async () => {
    const arquivada: CategoriaDespesa = {
      id: 'cat-1',
      tenant_id: tenantId,
      nature: 'expense',
      name: 'Marketing',
      seed_key: null,
      archived_at: '2026-02-01T00:00:00Z',
      archived_by: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: null,
    };
    const { repo } = novoAdapter([arquivada]);

    const erro = await repo.criarCategoriaDespesa(tenantId, 'Marketing').catch((e) => e);
    expect(erro).toBeInstanceOf(PlanoContasConflictError);
    expect((erro as PlanoContasConflictError).archived).toBe(true);
  });
});

describe('PlanoContasRepository — Fornecedor (ticket 06)', () => {
  const tenantId = 'tenant-1';

  const categoriaAtiva: CategoriaDespesa = {
    id: 'cat-ativa',
    tenant_id: tenantId,
    nature: 'expense',
    name: 'Produtos para revenda',
    seed_key: 'produtos_revenda',
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
  };

  const categoriaArquivada: CategoriaDespesa = {
    id: 'cat-arquivada',
    tenant_id: tenantId,
    nature: 'expense',
    name: 'Descontinuada',
    seed_key: null,
    archived_at: '2026-02-01T00:00:00Z',
    archived_by: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    created_by: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
  };

  function fornecedor(overrides: Partial<Fornecedor>): Fornecedor {
    return {
      id: overrides.id || 'forn-1',
      tenant_id: tenantId,
      name: 'Distribuidora ABC',
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

  function novoAdapter(categorias: CategoriaDespesa[] = [], fornecedores: Fornecedor[] = []) {
    const adapter = new InMemoryPlanoContasAdapter(categorias, fornecedores);
    return { adapter, repo: new PlanoContasRepository(adapter) };
  }

  it('lista fornecedores do tenant ordenados alfabeticamente em português', async () => {
    const { repo } = novoAdapter(
      [],
      [fornecedor({ id: 'f1', name: 'Zebra Materiais' }), fornecedor({ id: 'f2', name: 'Água Mineral SA' })]
    );
    const lista = await repo.listarFornecedores(tenantId);
    expect(lista.map((f) => f.name)).toEqual(['Água Mineral SA', 'Zebra Materiais']);
  });

  it('cria fornecedor normalizando nome, documento, telefone e e-mail', async () => {
    const { repo } = novoAdapter();
    const criado = await repo.criarFornecedor(tenantId, {
      name: '  Distribuidora   ABC  ',
      document: '123.456.789-09',
      phone: '(11) 98888-7777',
      email: 'Contato@Fornecedor.COM',
      notes: '  Entrega às terças  ',
    });
    expect(criado.name).toBe('Distribuidora ABC');
    expect(criado.document).toBe('12345678909');
    expect(criado.phone).toBe('11988887777');
    expect(criado.email).toBe('contato@fornecedor.com');
    expect(criado.notes).toBe('Entrega às terças');
  });

  it('cria fornecedor sem documento, telefone, e-mail ou observação (todos opcionais)', async () => {
    const { repo } = novoAdapter();
    const criado = await repo.criarFornecedor(tenantId, { name: 'Fornecedor Simples' });
    expect(criado.document).toBeNull();
    expect(criado.phone).toBeNull();
    expect(criado.email).toBeNull();
    expect(criado.notes).toBeNull();
  });

  it.each(['', ' ', 'A', 'x'.repeat(121)])('recusa criar fornecedor com nome inválido (%j)', async (nome) => {
    const { repo } = novoAdapter();
    await expect(repo.criarFornecedor(tenantId, { name: nome })).rejects.toThrow(PlanoContasValidationError);
  });

  it('recusa documento inválido', async () => {
    const { repo } = novoAdapter();
    await expect(
      repo.criarFornecedor(tenantId, { name: 'Fornecedor X', document: '111.111.111-11' })
    ).rejects.toThrow(PlanoContasValidationError);
  });

  it.each(['123456789', '123456789012'])(
    'recusa telefone com quantidade de dígitos inválida (%j)',
    async (telefone) => {
      const { repo } = novoAdapter();
      await expect(
        repo.criarFornecedor(tenantId, { name: 'Fornecedor X', phone: telefone })
      ).rejects.toThrow(PlanoContasValidationError);
    }
  );

  it.each(['sememail', 'a@b', '@dominio.com'])('recusa e-mail inválido (%j)', async (email) => {
    const { repo } = novoAdapter();
    await expect(repo.criarFornecedor(tenantId, { name: 'Fornecedor X', email })).rejects.toThrow(
      PlanoContasValidationError
    );
  });

  it('recusa observação com mais de 500 caracteres', async () => {
    const { repo } = novoAdapter();
    await expect(
      repo.criarFornecedor(tenantId, { name: 'Fornecedor X', notes: 'x'.repeat(501) })
    ).rejects.toThrow(PlanoContasValidationError);
  });

  it('cria fornecedor com categoria padrão ativa', async () => {
    const { repo } = novoAdapter([categoriaAtiva]);
    const criado = await repo.criarFornecedor(tenantId, {
      name: 'Fornecedor X',
      defaultCategoryId: 'cat-ativa',
    });
    expect(criado.default_category_id).toBe('cat-ativa');
    expect(criado.default_category).toEqual({ id: 'cat-ativa', name: 'Produtos para revenda', archived: false });
  });

  it('recusa criar com categoria padrão arquivada', async () => {
    const { repo } = novoAdapter([categoriaArquivada]);
    await expect(
      repo.criarFornecedor(tenantId, { name: 'Fornecedor X', defaultCategoryId: 'cat-arquivada' })
    ).rejects.toThrow(PlanoContasValidationError);
  });

  it('propaga conflito de nome (sem diferenciar maiúsculas) como PlanoContasConflictError', async () => {
    const { repo } = novoAdapter([], [fornecedor({ id: 'forn-1', name: 'Distribuidora ABC' })]);
    const erro = await repo.criarFornecedor(tenantId, { name: 'distribuidora abc' }).catch((e) => e);
    expect(erro).toBeInstanceOf(PlanoContasConflictError);
    expect((erro as PlanoContasConflictError).existingId).toBe('forn-1');
    expect((erro as PlanoContasConflictError).archived).toBe(false);
  });

  it('propaga conflito de documento como PlanoContasConflictError', async () => {
    const { repo } = novoAdapter(
      [],
      [fornecedor({ id: 'forn-1', name: 'Distribuidora ABC', document: '12345678909' })]
    );
    const erro = await repo
      .criarFornecedor(tenantId, { name: 'Outro Nome', document: '123.456.789-09' })
      .catch((e) => e);
    expect(erro).toBeInstanceOf(PlanoContasConflictError);
    expect((erro as PlanoContasConflictError).existingId).toBe('forn-1');
  });

  it('atualiza fornecedor ativo', async () => {
    const { repo } = novoAdapter([], [fornecedor({ id: 'forn-1' })]);
    const atualizado = await repo.atualizarFornecedor(tenantId, 'forn-1', {
      name: 'Novo Nome',
      email: 'novo@fornecedor.com',
    });
    expect(atualizado.name).toBe('Novo Nome');
    expect(atualizado.email).toBe('novo@fornecedor.com');
  });

  it('recusa atualizar fornecedor arquivado', async () => {
    const { repo } = novoAdapter(
      [],
      [fornecedor({ id: 'forn-1', archived_at: '2026-02-01T00:00:00Z', archived_by: 'user-1' })]
    );
    await expect(repo.atualizarFornecedor(tenantId, 'forn-1', { name: 'Novo Nome' })).rejects.toThrow(
      PlanoContasValidationError
    );
  });

  it('aceita atualizar mantendo a categoria padrão já arquivada, quando não mudou', async () => {
    const { repo } = novoAdapter(
      [categoriaArquivada],
      [fornecedor({ id: 'forn-1', default_category_id: 'cat-arquivada' })]
    );
    const atualizado = await repo.atualizarFornecedor(tenantId, 'forn-1', {
      name: 'Distribuidora ABC',
      defaultCategoryId: 'cat-arquivada',
    });
    expect(atualizado.default_category_id).toBe('cat-arquivada');
  });

  it('recusa trocar para uma NOVA categoria padrão arquivada', async () => {
    const { repo } = novoAdapter([categoriaAtiva, categoriaArquivada], [fornecedor({ id: 'forn-1' })]);
    await expect(
      repo.atualizarFornecedor(tenantId, 'forn-1', {
        name: 'Distribuidora ABC',
        defaultCategoryId: 'cat-arquivada',
      })
    ).rejects.toThrow(PlanoContasValidationError);
  });

  it('arquiva e reativa fornecedor', async () => {
    const { repo } = novoAdapter([], [fornecedor({ id: 'forn-1' })]);
    const arquivado = await repo.arquivarFornecedor(tenantId, 'forn-1');
    expect(arquivado.archived_at).not.toBeNull();

    const reativado = await repo.reativarFornecedor(tenantId, 'forn-1');
    expect(reativado.archived_at).toBeNull();
  });

  it('recusa arquivar fornecedor já arquivado e reativar fornecedor já ativo (dupla operação)', async () => {
    const { repo: repoArquivar } = novoAdapter([], [fornecedor({ id: 'forn-1' })]);
    await repoArquivar.arquivarFornecedor(tenantId, 'forn-1');
    await expect(repoArquivar.arquivarFornecedor(tenantId, 'forn-1')).rejects.toThrow(
      PlanoContasValidationError
    );

    const { repo: repoReativar } = novoAdapter([], [fornecedor({ id: 'forn-1' })]);
    await expect(repoReativar.reativarFornecedor(tenantId, 'forn-1')).rejects.toThrow(
      PlanoContasValidationError
    );
  });
});
