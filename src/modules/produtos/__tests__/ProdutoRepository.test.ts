import { describe, expect, it, vi } from 'vitest';
import { ProdutoRepository, ProdutoValidationError } from '../ProdutoRepository';
import type { IProdutoAdapter } from '../types';

describe('ProdutoRepository', () => {
  const mockAdapter: IProdutoAdapter = {
    listarAtivos: vi.fn(),
    salvarProduto: vi.fn(),
  };

  const repository = new ProdutoRepository(mockAdapter);

  it('ordena produtos por nome alfabeticamente', async () => {
    vi.mocked(mockAdapter.listarAtivos).mockResolvedValueOnce([
      { id: '1', tenant_id: 't-1', name: 'Pomada Matte', price: 35, cost_price: 15, stock_quantity: 10, is_active: true },
      { id: '2', tenant_id: 't-1', name: 'Balm para Barba', price: 25, cost_price: 10, stock_quantity: 5, is_active: true },
    ]);

    const res = await repository.listActive('t-1');
    expect(res[0].name).toBe('Balm para Barba');
    expect(res[1].name).toBe('Pomada Matte');
  });

  it('lança erro ao cadastrar produto com nome vazio', async () => {
    await expect(
      repository.saveProduct({
        tenant_id: 't-1',
        name: '   ',
        price: 30,
      })
    ).rejects.toThrow(ProdutoValidationError);
  });
});
