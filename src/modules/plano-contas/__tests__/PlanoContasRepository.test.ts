import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlanoContasRepository,
  PlanoContasValidationError,
  PlanoContasConflictError,
} from '../PlanoContasRepository';
import { InMemoryPlanoContasAdapter } from '../adapters/InMemoryPlanoContasAdapter';
import type { CategoriaDespesa } from '../types';

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
