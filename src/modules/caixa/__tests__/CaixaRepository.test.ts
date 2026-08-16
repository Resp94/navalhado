import { describe, expect, it, vi } from 'vitest';
import { CaixaRepository, CaixaValidationError } from '../CaixaRepository';
import type { ICaixaAdapter } from '../types';

describe('CaixaRepository', () => {
  const mockAdapter: ICaixaAdapter = {
    obterSessaoAtiva: vi.fn(),
    abrirCaixa: vi.fn(),
    fecharCaixa: vi.fn(),
  };

  const repository = new CaixaRepository(mockAdapter);

  it('verifica se o caixa está aberto com sucesso', async () => {
    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce({
      id: 'sess-1',
      tenant_id: 't-1',
      opened_by: 'user-1',
      closed_by: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      initial_amount: 50.0,
      closing_amount: null,
      status: 'open',
      notes: null,
    });

    const isOpen = await repository.isCashierOpen('t-1');
    expect(isOpen).toBe(true);
  });

  it('retorna false quando não há caixa aberto', async () => {
    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce(null);
    const isOpen = await repository.isCashierOpen('t-1');
    expect(isOpen).toBe(false);
  });

  it('impede abertura de novo caixa se já houver um aberto', async () => {
    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce({
      id: 'sess-1',
      tenant_id: 't-1',
      opened_by: 'user-1',
      closed_by: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      initial_amount: 50.0,
      closing_amount: null,
      status: 'open',
      notes: null,
    });

    await expect(
      repository.openSession({
        tenant_id: 't-1',
        initial_amount: 100.0,
      })
    ).rejects.toThrow(CaixaValidationError);
  });

  it('lança erro ao informar fundo de troco negativo', async () => {
    await expect(
      repository.openSession({
        tenant_id: 't-1',
        initial_amount: -20.0,
      })
    ).rejects.toThrow(CaixaValidationError);
  });
});
