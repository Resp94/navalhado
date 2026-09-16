import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelatoriosRepository } from '../RelatoriosRepository';
import { useAgenda } from '../useAgenda';
import type { RelatorioAgenda, RelatoriosAdapter } from '../types';

function buildResult(businessToday: string): RelatorioAgenda {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: businessToday,
    period: { start: '2026-06-01', end: businessToday },
    previous_period: { start: '2026-05-01', end: '2026-05-31' },
    status_totals: {
      total: 0,
      completed: 0,
      no_show: 0,
      canceled: 0,
      unresolved: 0,
      future: 0,
      attendance_rate: null,
      cancellation_rate: null,
    },
    previous_status_totals: {
      total: 0,
      completed: 0,
      no_show: 0,
      canceled: 0,
      unresolved: 0,
      future: 0,
      attendance_rate: null,
      cancellation_rate: null,
    },
    by_origin: [],
    by_professional: [],
    cancellation_reasons: [],
  };
}

function buildAdapter(): RelatoriosAdapter {
  return { obterFaturamentoPorPeriodo: vi.fn(), obterEquipeEServicos: vi.fn(), obterAgenda: vi.fn() };
}

describe('useAgenda', () => {
  it('descarta a resposta de uma chamada antiga que resolve depois da mais nova', async () => {
    const adapter = buildAdapter();
    const repository = new RelatoriosRepository(adapter);

    let resolveFirst: (value: RelatorioAgenda) => void = () => {};
    let resolveSecond: (value: RelatorioAgenda) => void = () => {};

    vi.mocked(adapter.obterAgenda)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      (props: { endDate: string }) =>
        useAgenda(repository, {
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
    expect(adapter.obterAgenda).toHaveBeenCalledTimes(2);
  });

  it('expõe erro de validação em pt-BR sem quebrar o carregamento', async () => {
    const adapter = buildAdapter();
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useAgenda(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-20',
        endDate: '2026-06-10',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('A data final não pode ser anterior à data inicial.');
    expect(adapter.obterAgenda).not.toHaveBeenCalled();
  });

  it('recarrega manualmente por meio de reload', async () => {
    const adapter = buildAdapter();
    vi.mocked(adapter.obterAgenda).mockResolvedValue(buildResult('2026-06-20'));
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useAgenda(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-20',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(adapter.obterAgenda).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(adapter.obterAgenda).toHaveBeenCalledTimes(2);
  });

  it('refaz a busca quando professionalId muda, filtrando só via parâmetro repassado ao repositório', async () => {
    const adapter = buildAdapter();
    vi.mocked(adapter.obterAgenda).mockResolvedValue(buildResult('2026-06-20'));
    const repository = new RelatoriosRepository(adapter);

    const { rerender } = renderHook(
      (props: { professionalId?: string }) =>
        useAgenda(repository, {
          tenantId: 'tenant-1',
          startDate: '2026-06-01',
          endDate: '2026-06-20',
          professionalId: props.professionalId,
          today: '2026-06-20',
        }),
      { initialProps: { professionalId: undefined as string | undefined } }
    );

    await waitFor(() => expect(adapter.obterAgenda).toHaveBeenCalledTimes(1));

    rerender({ professionalId: 'prof-1' });

    await waitFor(() => expect(adapter.obterAgenda).toHaveBeenCalledTimes(2));
    expect(adapter.obterAgenda).toHaveBeenLastCalledWith(expect.objectContaining({ professionalId: 'prof-1' }));
  });
});
