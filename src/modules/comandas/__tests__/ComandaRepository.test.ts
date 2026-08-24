import { describe, expect, it, vi } from 'vitest';
import { ComandaRepository, ComandaValidationError } from '../ComandaRepository';
import type { IComandaAdapter } from '../types';

describe('ComandaRepository', () => {
  const mockAdapter: IComandaAdapter = {
    obterPorId: vi.fn(),
    obterPorAppointmentId: vi.fn(),
    listarAbertas: vi.fn(),
    listarTodas: vi.fn(),
    criarComanda: vi.fn(),
    adicionarItem: vi.fn(),
    removerItem: vi.fn(),
    liquidarComanda: vi.fn(),
    reabrirComanda: vi.fn(),
  };

  const repository = new ComandaRepository(mockAdapter);

  it('calcula totais com subtotal, desconto e gorjeta corretamente', () => {
    const itens = [
      { quantity: 1, unit_price: 35.0 }, // Corte: 35
      { quantity: 2, unit_price: 20.0 }, // 2 Pomadas: 40
    ];

    const result = repository.calculateTotals(itens, 10.0, 5.0);
    // Subtotal: 75, Desconto: 10, Gorjeta: 5 -> Total: 70
    expect(result.subtotal).toBe(75.0);
    expect(result.discount).toBe(10.0);
    expect(result.tip).toBe(5.0);
    expect(result.total).toBe(70.0);
  });

  it('limita o desconto ao valor do subtotal para não gerar total negativo', () => {
    const itens = [{ quantity: 1, unit_price: 50.0 }];
    const result = repository.calculateTotals(itens, 100.0, 0);

    expect(result.subtotal).toBe(50.0);
    expect(result.discount).toBe(50.0);
    expect(result.total).toBe(0.0);
  });

  it('calcula troco em dinheiro com precisão', () => {
    expect(repository.calculateChange(35.0, 50.0)).toBe(15.0);
    expect(repository.calculateChange(35.0, 35.0)).toBe(0.0);
    expect(repository.calculateChange(35.0, 20.0)).toBe(0.0);
  });

  it('lança erro ao criar comanda sem itens', async () => {
    await expect(
      repository.createComanda({
        tenant_id: 't-123',
        itens: [],
      })
    ).rejects.toThrow(ComandaValidationError);
  });

  it('lança erro ao liquidar comanda sem pagamentos', async () => {
    await expect(
      repository.settleComanda({
        comanda_id: 'c-123',
        tenant_id: 't-123',
        pagamentos: [],
      })
    ).rejects.toThrow(ComandaValidationError);
  });

  it('delega criação de comanda para o adapter quando válida', async () => {
    const fakeComanda = {
      id: 'c-1',
      tenant_id: 't-123',
      appointment_id: 'a-1',
      customer_id: 'cust-1',
      status: 'aberta' as const,
      total_amount: 50,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
    };
    vi.mocked(mockAdapter.criarComanda).mockResolvedValueOnce(fakeComanda);

    const res = await repository.createComanda({
      tenant_id: 't-123',
      appointment_id: 'a-1',
      itens: [{ item_type: 'servico', service_id: 's-1', quantity: 1, unit_price: 50 }],
    });

    expect(res).toEqual(fakeComanda);
    expect(mockAdapter.criarComanda).toHaveBeenCalled();
  });

  it('reabre comanda delegando para o adapter', async () => {
    const fakeReaberta = {
      id: 'c-1',
      tenant_id: 't-123',
      appointment_id: null,
      customer_id: null,
      status: 'aberta' as const,
      total_amount: 50,
      discount_amount: 0,
      tip_amount: 0,
      notes: null,
    };
    vi.mocked(mockAdapter.reabrirComanda).mockResolvedValueOnce(fakeReaberta);

    const res = await repository.reopenComanda('c-1', 't-123');
    expect(res).toEqual(fakeReaberta);
    expect(mockAdapter.reabrirComanda).toHaveBeenCalledWith('c-1', 't-123');
  });
});
