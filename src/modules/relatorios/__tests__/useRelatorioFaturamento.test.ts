import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelatoriosRepository } from '../RelatoriosRepository';
import { useRelatorioFaturamento } from '../useRelatorioFaturamento';
import type { RelatorioFaturamento, RelatoriosAdapter } from '../types';

function buildResult(businessToday: string): RelatorioFaturamento {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: businessToday,
    period: { start: '2026-06-01', end: businessToday },
    previous_period: { start: '2026-05-01', end: '2026-05-31' },
    data_quality: { status: 'confirmed', confirmed_comandas: 1, estimated_comandas: 0, legacy_comandas: 0 },
    totals: {
      gross: 0,
      discounts: 0,
      net: 0,
      services_net: 0,
      products_net: 0,
      tips: 0,
      closed_comandas: 0,
      received_total: 0,
    },
    previous_totals: {
      gross: 0,
      discounts: 0,
      net: 0,
      services_net: 0,
      products_net: 0,
      tips: 0,
      closed_comandas: 0,
      received_total: 0,
    },
    received_by_method: [],
    buckets: [],
  };
}

describe('useRelatorioFaturamento', () => {
  it('descarta a resposta de uma chamada antiga que resolve depois da mais nova', async () => {
    const adapter: RelatoriosAdapter = { obterFaturamentoPorPeriodo: vi.fn() };
    const repository = new RelatoriosRepository(adapter);

    let resolveFirst: (value: RelatorioFaturamento) => void = () => {};
    let resolveSecond: (value: RelatorioFaturamento) => void = () => {};

    vi.mocked(adapter.obterFaturamentoPorPeriodo)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      (props: { endDate: string }) =>
        useRelatorioFaturamento(repository, {
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
    expect(adapter.obterFaturamentoPorPeriodo).toHaveBeenCalledTimes(2);
  });

  it('expõe erro de validação em pt-BR sem quebrar o carregamento', async () => {
    const adapter: RelatoriosAdapter = { obterFaturamentoPorPeriodo: vi.fn() };
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useRelatorioFaturamento(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-20',
        endDate: '2026-06-10',
        granularity: 'day',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('A data final não pode ser anterior à data inicial.');
    expect(adapter.obterFaturamentoPorPeriodo).not.toHaveBeenCalled();
  });

  it('recarrega manualmente por meio de reload', async () => {
    const adapter: RelatoriosAdapter = { obterFaturamentoPorPeriodo: vi.fn() };
    vi.mocked(adapter.obterFaturamentoPorPeriodo).mockResolvedValue(buildResult('2026-06-20'));
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useRelatorioFaturamento(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-20',
        granularity: 'day',
        today: '2026-06-20',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(adapter.obterFaturamentoPorPeriodo).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(adapter.obterFaturamentoPorPeriodo).toHaveBeenCalledTimes(2);
  });
});
