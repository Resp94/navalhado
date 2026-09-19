import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EsperaRepository } from '../EsperaRepository';
import type { IEsperaAdapter, WaitingListEntry } from '../types';

describe('EsperaRepository', () => {
  const mockAdapter: IEsperaAdapter = {
    listarPorData: vi.fn(),
    adicionar: vi.fn(),
    atualizarStatus: vi.fn(),
    remover: vi.fn(),
  };

  const repo = new EsperaRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista entradas por data', async () => {
    const fakeList: WaitingListEntry[] = [
      {
        id: 'w-1',
        tenant_id: 't-1',
        customer_name: 'Paulo Vieira',
        customer_phone: '11999998888',
        status: 'aguardando',
      },
    ];
    vi.mocked(mockAdapter.listarPorData).mockResolvedValueOnce(fakeList);

    const res = await repo.listByDate('t-1', '2026-08-16');
    expect(res).toEqual(fakeList);
    expect(mockAdapter.listarPorData).toHaveBeenCalledWith('t-1', '2026-08-16');
  });

  it('adiciona entrada validando nome', async () => {
    await expect(
      repo.addEntry({
        tenant_id: 't-1',
        customer_name: '',
        customer_phone: '11999998888',
        status: 'aguardando',
      })
    ).rejects.toThrow('Nome do cliente é obrigatório');
  });

  it('sugere profissional correto no rodízio de balcão (menor número de atendimentos)', () => {
    const profs = [
      { id: 'p1', name: 'Alisson' },
      { id: 'p2', name: 'Diego' },
      { id: 'p3', name: 'Carlos' },
    ];

    const counts = {
      p1: 5,
      p2: 2,
      p3: 4,
    };

    const suggested = repo.suggestRotationProfessional(profs, counts);
    expect(suggested).toEqual({ id: 'p2', name: 'Diego' });
  });

  describe('suggestRotationFromAppointments (spec 040)', () => {
    const profs = [
      { id: 'p1', name: 'Carlos' },
      { id: 'p2', name: 'Diego' },
    ];

    it('conta os agendamentos do dia por profissional e sugere quem tem menos', () => {
      const suggested = repo.suggestRotationFromAppointments(profs, [
        { professional_id: 'p1' },
        { professional_id: 'p1' },
        { professional_id: 'p2' },
      ]);

      expect(suggested).toEqual({ id: 'p2', name: 'Diego' });
    });

    it('ignora agendamentos cancelados e com falta na contagem', () => {
      const suggested = repo.suggestRotationFromAppointments(profs, [
        { professional_id: 'p2', status: 'canceled' },
        { professional_id: 'p2', status: 'no_show' },
        { professional_id: 'p1', status: 'confirmed' },
      ]);

      expect(suggested).toEqual({ id: 'p2', name: 'Diego' });
    });

    it('mantém o primeiro da lista em caso de empate e devolve nulo sem profissionais', () => {
      expect(repo.suggestRotationFromAppointments(profs, [])).toEqual({ id: 'p1', name: 'Carlos' });
      expect(repo.suggestRotationFromAppointments([], [{ professional_id: 'p1' }])).toBeNull();
    });
  });
});
