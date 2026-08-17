import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProdutoRepository, ProdutoValidationError } from '../ProdutoRepository';
import type { IProdutoAdapter } from '../types';

describe('ProdutoRepository', () => {
  const mockAdapter: IProdutoAdapter = {
    listar: vi.fn(),
    salvarProduto: vi.fn(),
    ajustarEstoque: vi.fn(),
    buscarMovimentacoes: vi.fn(),
  };

  const repository = new ProdutoRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ordena produtos por nome alfabeticamente', async () => {
    vi.mocked(mockAdapter.listar).mockResolvedValueOnce([
      {
        id: '1',
        tenant_id: 't-1',
        name: 'Pomada Matte',
        product_type: 'retail',
        unit_type: 'unidade',
        min_stock_alert: 5,
        price: 35,
        cost_price: 15,
        stock_quantity: 10,
        is_active: true,
      },
      {
        id: '2',
        tenant_id: 't-1',
        name: 'Balm para Barba',
        product_type: 'retail',
        unit_type: 'unidade',
        min_stock_alert: 5,
        price: 25,
        cost_price: 10,
        stock_quantity: 5,
        is_active: true,
      },
    ]);

    const res = await repository.listActive('t-1');
    expect(res[0].name).toBe('Balm para Barba');
    expect(res[1].name).toBe('Pomada Matte');
  });

  it('lança erro ao cadastrar produto com nome vazio ou preço negativo', async () => {
    await expect(
      repository.saveProduct('t-1', {
        name: '   ',
        price: 30,
      })
    ).rejects.toThrow(ProdutoValidationError);

    await expect(
      repository.saveProduct('t-1', {
        name: 'Shampoo',
        price: -10,
      })
    ).rejects.toThrow(ProdutoValidationError);
  });

  it('salva produto de venda balcão e insumo de bancada corretamente', async () => {
    vi.mocked(mockAdapter.salvarProduto).mockResolvedValueOnce({
      id: 'p-new',
      tenant_id: 't-1',
      name: 'Lâmina descartável',
      brand: 'Wilkinson',
      category: 'Insumos',
      product_type: 'internal_use',
      unit_type: 'pacote',
      price: 0,
      cost_price: 12,
      stock_quantity: 50,
      min_stock_alert: 10,
      is_active: true,
    });

    const saved = await repository.saveProduct('t-1', {
      name: 'Lâmina descartável',
      brand: 'Wilkinson',
      category: 'Insumos',
      product_type: 'internal_use',
      unit_type: 'pacote',
      price: 0,
      cost_price: 12,
      stock_quantity: 50,
      min_stock_alert: 10,
    });

    expect(saved.product_type).toBe('internal_use');
    expect(saved.unit_type).toBe('pacote');
  });

  it('valida e delega ajuste de estoque com atomicidade', async () => {
    vi.mocked(mockAdapter.ajustarEstoque).mockResolvedValueOnce({ new_stock: 25 });

    await expect(repository.adjustStock('t-1', 'p-1', 0, 'entry_manual')).rejects.toThrow(
      ProdutoValidationError
    );

    const result = await repository.adjustStock('t-1', 'p-1', 5, 'entry_purchase', 'NF 123');
    expect(result.new_stock).toBe(25);
    expect(mockAdapter.ajustarEstoque).toHaveBeenCalledWith(
      't-1',
      'p-1',
      5,
      'entry_purchase',
      'NF 123'
    );
  });
});
