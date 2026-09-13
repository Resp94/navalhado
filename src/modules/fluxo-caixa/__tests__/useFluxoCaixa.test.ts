import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FluxoCaixaRepository } from '../FluxoCaixaRepository';
import { useFluxoCaixa } from '../useFluxoCaixa';
import type { FluxoCaixaProjetado, IFluxoCaixaAdapter } from '../types';

function buildResult(businessToday: string): FluxoCaixaProjetado {
  return { timezone: 'America/Sao_Paulo', business_today: businessToday, buckets: [] };
}

describe('useFluxoCaixa', () => {
  it('descarta a resposta de uma chamada antiga que resolve depois da mais nova', async () => {
    const adapter: IFluxoCaixaAdapter = { obterFluxoCaixaProjetado: vi.fn() };
    const repository = new FluxoCaixaRepository(adapter);

    let resolveFirst: (value: FluxoCaixaProjetado) => void = () => {};
    let resolveSecond: (value: FluxoCaixaProjetado) => void = () => {};

    vi.mocked(adapter.obterFluxoCaixaProjetado)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      (props: { endDate: string }) =>
        useFluxoCaixa(repository, {
          tenantId: 'tenant-1',
          startDate: '2026-06-01',
          endDate: props.endDate,
          granularity: 'day',
          today: '2026-06-01',
        }),
      { initialProps: { endDate: '2026-06-10' } }
    );

    // Troca o filtro antes da primeira chamada resolver: dispara a segunda.
    rerender({ endDate: '2026-06-20' });

    // A resposta antiga (do período 06-10) chega DEPOIS da nova (06-20).
    await act(async () => {
      resolveSecond(buildResult('2026-06-20'));
    });
    await waitFor(() => expect(result.current.data?.business_today).toBe('2026-06-20'));

    await act(async () => {
      resolveFirst(buildResult('2026-06-10'));
    });

    // A resposta obsoleta não deve sobrescrever o resultado mais recente.
    expect(result.current.data?.business_today).toBe('2026-06-20');
    expect(adapter.obterFluxoCaixaProjetado).toHaveBeenCalledTimes(2);
  });

  it('expõe erro de validação em pt-BR sem quebrar o carregamento', async () => {
    const adapter: IFluxoCaixaAdapter = { obterFluxoCaixaProjetado: vi.fn() };
    const repository = new FluxoCaixaRepository(adapter);

    const { result } = renderHook(() =>
      useFluxoCaixa(repository, {
        tenantId: 'tenant-1',
        startDate: '2026-06-20',
        endDate: '2026-06-10',
        granularity: 'day',
        today: '2026-06-01',
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('A data final não pode ser anterior à data inicial.');
    expect(adapter.obterFluxoCaixaProjetado).not.toHaveBeenCalled();
  });
});
