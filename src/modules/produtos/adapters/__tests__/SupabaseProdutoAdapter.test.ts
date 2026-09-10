import { describe, expect, it, vi } from 'vitest';
import { SupabaseProdutoAdapter } from '../SupabaseProdutoAdapter';
import type { MovementType } from '../../types';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

describe('SupabaseProdutoAdapter - contrato de ajuste de estoque', () => {
  it.each([
    ['entry_manual', 5],
    ['entry_purchase', 5],
    ['exit_manual', -5],
    ['exit_sale_comanda', -5],
    ['exit_internal_use', -5],
    ['adjustment', 5],
  ] as Array<[MovementType, number]>)('encaminha o tipo %s e a quantidade absoluta', async (movementType, quantityChange) => {
    mockRpc.mockResolvedValueOnce({ data: { new_stock: 15 }, error: null });

    const result = await new SupabaseProdutoAdapter().ajustarEstoque(
      'tenant-1',
      'product-1',
      quantityChange,
      movementType,
      'baseline'
    );

    expect(result).toEqual({ new_stock: 15 });
    expect(mockRpc).toHaveBeenLastCalledWith('adjust_product_stock', {
      p_product_id: 'product-1',
      p_movement_type: movementType,
      p_quantity: 5,
      p_reason: 'baseline',
    });
  });

  it('converte erro do contrato remoto em erro do adapter', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Tipo de movimentação inválido' },
    });

    await expect(
      new SupabaseProdutoAdapter().ajustarEstoque(
        'tenant-1',
        'product-1',
        -1,
        'exit_sale_comanda',
        'baseline'
      )
    ).rejects.toThrow('Erro ao ajustar estoque: Tipo de movimentação inválido');
  });
});
