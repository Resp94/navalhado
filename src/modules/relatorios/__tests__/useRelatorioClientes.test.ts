import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelatoriosRepository } from '../RelatoriosRepository';
import { useRelatorioClientes } from '../useRelatorioClientes';
import type { RelatorioClientes, RelatoriosAdapter } from '../types';

function buildAdapter(): RelatoriosAdapter {
  return {
    obterFaturamentoPorPeriodo: vi.fn(),
    obterEquipeEServicos: vi.fn(),
    obterAgenda: vi.fn(),
    obterClientesSemRetorno: vi.fn(),
    obterClientes: vi.fn(),
  };
}

function buildResult(businessToday: string): RelatorioClientes {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: businessToday,
    period: { start: '2026-06-01', end: businessToday },
    previous_period: { start: '2026-05-01', end: '2026-05-31' },
    visitors: { unique_customers: 0, new_customers: 0, returning_customers: 0, new_single_visit: 0, unidentified_attendances: 0 },
    previous_visitors: { unique_customers: 0, new_customers: 0, returning_customers: 0, unidentified_attendances: 0 },
    buckets: [],
    single_visit_customers: [],
    registrations: {
      total: 0,
      provisional: 0,
      by_registration_origin: [],
      by_acquisition_channel: [],
      acquisition_channel_filled_share: null,
    },
  };
}

describe('useRelatorioClientes', () => {
  it('descarta a resposta de uma chamada antiga que resolve depois da mais nova', async () => {
    const adapter = buildAdapter();
    const repository = new RelatoriosRepository(adapter);

    let resolveFirst: (value: RelatorioClientes) => void = () => {};
    let resolveSecond: (value: RelatorioClientes) => void = () => {};

    vi.mocked(adapter.obterClientes)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      (props: { endDate: string }) =>
        useRelatorioClientes(repository, {
          tenantId: 'tenant-1',
          startDate: '2026-06-01',
          endDate: props.endDate,
          granularity: 'day',
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
    expect(adapter.obterClientes).toHaveBeenCalledTimes(2);
  });

  it('expõe erro de validação em pt-BR sem quebrar o carregamento', async () => {
    const adapter = buildAdapter();
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useRelatorioClientes(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-20',
        endDate: '2026-06-10',
        granularity: 'day',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('A data final não pode ser anterior à data inicial.');
    expect(adapter.obterClientes).not.toHaveBeenCalled();
  });

  it('recarrega manualmente por meio de reload', async () => {
    const adapter = buildAdapter();
    vi.mocked(adapter.obterClientes).mockResolvedValue(buildResult('2026-06-20'));
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useRelatorioClientes(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-20',
        granularity: 'day',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(adapter.obterClientes).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(adapter.obterClientes).toHaveBeenCalledTimes(2);
  });
});
