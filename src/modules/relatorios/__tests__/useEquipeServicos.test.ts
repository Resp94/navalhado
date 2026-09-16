import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelatoriosRepository } from '../RelatoriosRepository';
import { useEquipeServicos } from '../useEquipeServicos';
import type { RelatorioEquipeServicos, RelatoriosAdapter } from '../types';

function buildResult(businessToday: string): RelatorioEquipeServicos {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: businessToday,
    period: { start: '2026-06-01', end: businessToday },
    data_quality: { status: 'confirmed', confirmed_comandas: 1, estimated_comandas: 0, legacy_comandas: 0 },
    professionals: [],
    services: [],
    totals: { net: 0, services_net: 0, attendances: 0 },
  };
}

describe('useEquipeServicos', () => {
  it('descarta a resposta de uma chamada antiga que resolve depois da mais nova', async () => {
    const adapter: RelatoriosAdapter = { obterFaturamentoPorPeriodo: vi.fn(), obterEquipeEServicos: vi.fn(), obterAgenda: vi.fn(), obterClientesSemRetorno: vi.fn() };
    const repository = new RelatoriosRepository(adapter);

    let resolveFirst: (value: RelatorioEquipeServicos) => void = () => {};
    let resolveSecond: (value: RelatorioEquipeServicos) => void = () => {};

    vi.mocked(adapter.obterEquipeEServicos)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      (props: { endDate: string }) =>
        useEquipeServicos(repository, {
          tenantId: 'tenant-1',
          startDate: '2026-06-01',
          endDate: props.endDate,
          today: '2026-06-20',
        }),
      { initialProps: { endDate: '2026-06-10' } }
    );

    rerender({ endDate: '2026-06-20' });

    await act(async () => {
      resolveSecond(buildResult('2026-06-20'));
    });
    await waitFor(() => expect(result.current.data?.business_today).toBe('2026-06-20'));

    await act(async () => {
      resolveFirst(buildResult('2026-06-10'));
    });

    expect(result.current.data?.business_today).toBe('2026-06-20');
    expect(adapter.obterEquipeEServicos).toHaveBeenCalledTimes(2);
  });

  it('expõe erro de validação em pt-BR sem quebrar o carregamento', async () => {
    const adapter: RelatoriosAdapter = { obterFaturamentoPorPeriodo: vi.fn(), obterEquipeEServicos: vi.fn(), obterAgenda: vi.fn(), obterClientesSemRetorno: vi.fn() };
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useEquipeServicos(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-20',
        endDate: '2026-06-10',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('A data final não pode ser anterior à data inicial.');
    expect(adapter.obterEquipeEServicos).not.toHaveBeenCalled();
  });

  it('recarrega manualmente por meio de reload', async () => {
    const adapter: RelatoriosAdapter = { obterFaturamentoPorPeriodo: vi.fn(), obterEquipeEServicos: vi.fn(), obterAgenda: vi.fn(), obterClientesSemRetorno: vi.fn() };
    vi.mocked(adapter.obterEquipeEServicos).mockResolvedValue(buildResult('2026-06-20'));
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useEquipeServicos(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-20',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(adapter.obterEquipeEServicos).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(adapter.obterEquipeEServicos).toHaveBeenCalledTimes(2);
  });

  it('refaz a busca quando professionalId muda, filtrando só via parâmetro repassado ao repositório', async () => {
    const adapter: RelatoriosAdapter = { obterFaturamentoPorPeriodo: vi.fn(), obterEquipeEServicos: vi.fn(), obterAgenda: vi.fn(), obterClientesSemRetorno: vi.fn() };
    vi.mocked(adapter.obterEquipeEServicos).mockResolvedValue(buildResult('2026-06-20'));
    const repository = new RelatoriosRepository(adapter);

    const { rerender } = renderHook(
      (props: { professionalId?: string }) =>
        useEquipeServicos(repository, {
          tenantId: 'tenant-1',
          startDate: '2026-06-01',
          endDate: '2026-06-20',
          professionalId: props.professionalId,
          today: '2026-06-20',
        }),
      { initialProps: { professionalId: undefined as string | undefined } }
    );

    await waitFor(() => expect(adapter.obterEquipeEServicos).toHaveBeenCalledTimes(1));

    rerender({ professionalId: 'prof-1' });

    await waitFor(() => expect(adapter.obterEquipeEServicos).toHaveBeenCalledTimes(2));
    expect(adapter.obterEquipeEServicos).toHaveBeenLastCalledWith(
      expect.objectContaining({ professionalId: 'prof-1' })
    );
  });
});
