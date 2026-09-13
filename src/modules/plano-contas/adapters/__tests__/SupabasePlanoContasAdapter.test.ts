import { describe, expect, it, vi } from 'vitest';
import { SupabasePlanoContasAdapter } from '../SupabasePlanoContasAdapter';

function buildSupabaseMock(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eqNature = vi.fn().mockReturnValue({ order });
  const eqTenant = vi.fn().mockReturnValue({ eq: eqNature });
  const select = vi.fn().mockReturnValue({ eq: eqTenant });
  const from = vi.fn().mockReturnValue({ select });
  return { supabase: { from } as any, from, select, eqTenant, eqNature, order };
}

describe('SupabasePlanoContasAdapter', () => {
  it('lista Categorias de Despesa do tenant filtrando por nature=expense', async () => {
    const categoriaRow = {
      id: 'cat-1',
      tenant_id: 'tenant-1',
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
    const { supabase, from, select, eqTenant, eqNature, order } = buildSupabaseMock({
      data: [categoriaRow],
      error: null,
    });

    const adapter = new SupabasePlanoContasAdapter(supabase);
    const result = await adapter.listarCategoriasDespesa('tenant-1');

    expect(from).toHaveBeenCalledWith('financial_categories');
    expect(select).toHaveBeenCalledWith('*');
    expect(eqTenant).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(eqNature).toHaveBeenCalledWith('nature', 'expense');
    expect(order).toHaveBeenCalledWith('name');
    expect(result).toEqual([categoriaRow]);
  });

  it('devolve lista vazia quando o Supabase não retorna dados', async () => {
    const { supabase } = buildSupabaseMock({ data: null, error: null });
    const adapter = new SupabasePlanoContasAdapter(supabase);
    const result = await adapter.listarCategoriasDespesa('tenant-1');
    expect(result).toEqual([]);
  });

  it('propaga o erro do Supabase', async () => {
    const { supabase } = buildSupabaseMock({
      data: null,
      error: { message: 'Falha de rede' },
    });
    const adapter = new SupabasePlanoContasAdapter(supabase);
    await expect(adapter.listarCategoriasDespesa('tenant-1')).rejects.toEqual({ message: 'Falha de rede' });
  });
});
