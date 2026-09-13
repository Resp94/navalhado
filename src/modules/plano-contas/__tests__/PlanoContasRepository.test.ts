import { describe, it, expect, beforeEach } from 'vitest';
import { PlanoContasRepository, PlanoContasValidationError } from '../PlanoContasRepository';
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
