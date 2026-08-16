import { describe, expect, it, vi } from 'vitest';
import { BloqueioRepository, BloqueioValidationError } from '../BloqueioRepository';
import type { IBloqueioAdapter } from '../types';

describe('BloqueioRepository', () => {
  const mockAdapter: IBloqueioAdapter = {
    listarPorData: vi.fn(),
    criarBloqueio: vi.fn(),
    removerBloqueio: vi.fn(),
  };

  const repository = new BloqueioRepository(mockAdapter);

  it('cria bloqueio de horário com sucesso quando horários são válidos', async () => {
    const fakeBlock = {
      id: 'b-1',
      tenant_id: 't-1',
      professional_id: 'prof-1',
      start_time: '2026-08-16T12:00:00Z',
      end_time: '2026-08-16T13:00:00Z',
      reason: 'Almoço',
      is_all_day: false,
    };
    vi.mocked(mockAdapter.criarBloqueio).mockResolvedValueOnce(fakeBlock);

    const res = await repository.createBlock({
      tenant_id: 't-1',
      professional_id: 'prof-1',
      start_time: '2026-08-16T12:00:00Z',
      end_time: '2026-08-16T13:00:00Z',
      reason: 'Almoço',
    });

    expect(res).toEqual(fakeBlock);
    expect(mockAdapter.criarBloqueio).toHaveBeenCalled();
  });

  it('lança erro se horário de fim for anterior ao horário de início', async () => {
    await expect(
      repository.createBlock({
        tenant_id: 't-1',
        professional_id: 'prof-1',
        start_time: '2026-08-16T14:00:00Z',
        end_time: '2026-08-16T13:00:00Z',
        reason: 'Almoço',
      })
    ).rejects.toThrow(BloqueioValidationError);
  });
});
