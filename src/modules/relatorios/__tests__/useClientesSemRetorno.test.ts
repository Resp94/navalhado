import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RelatoriosRepository } from '../RelatoriosRepository';
import { useClientesSemRetorno } from '../useClientesSemRetorno';
import type { RelatorioClientesSemRetorno, RelatoriosAdapter } from '../types';

function buildResult(overrides: Partial<RelatorioClientesSemRetorno> = {}): RelatorioClientesSemRetorno {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: '2026-06-15',
    totals: { without_return: 0, within_return: 0, no_visit_ever: 0 },
    bands: { up_to_15: 0, d16_30: 0, d31_60: 0, over_60: 0 },
    items: [],
    total_count: 0,
    ...overrides,
  };
}

function buildAdapter(): RelatoriosAdapter {
  return {
    obterFaturamentoPorPeriodo: vi.fn(),
    obterEquipeEServicos: vi.fn(),
    obterAgenda: vi.fn(),
    obterClientesSemRetorno: vi.fn(),
  };
}

describe('useClientesSemRetorno', () => {
  it('converte page/pageSize em limit/offset ao chamar o repositório', async () => {
    const adapter = buildAdapter();
    vi.mocked(adapter.obterClientesSemRetorno).mockResolvedValue(buildResult());
    const repository = new RelatoriosRepository(adapter);

    renderHook(() =>
      useClientesSemRetorno(repository, {
        tenantId: 'tenant-1',
        page: 3,
        pageSize: 20,
      })
    );

    await waitFor(() => expect(adapter.obterClientesSemRetorno).toHaveBeenCalledTimes(1));
    expect(adapter.obterClientesSemRetorno).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      overdueBand: undefined,
      professionalId: undefined,
      limit: 20,
      offset: 40,
    });
  });

  it('descarta a resposta de uma chamada antiga que resolve depois da mais nova', async () => {
    const adapter = buildAdapter();
    const repository = new RelatoriosRepository(adapter);

    let resolveFirst: (value: RelatorioClientesSemRetorno) => void = () => {};
    let resolveSecond: (value: RelatorioClientesSemRetorno) => void = () => {};

    vi.mocked(adapter.obterClientesSemRetorno)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));

    const { result, rerender } = renderHook(
      (props: { page: number }) =>
        useClientesSemRetorno(repository, {
          tenantId: 'tenant-1',
          page: props.page,
          pageSize: 20,
        }),
      { initialProps: { page: 1 } }
    );

    rerender({ page: 2 });

    await act(async () => {
      resolveSecond(buildResult({ business_today: '2026-06-20' }));
    });
    await waitFor(() => expect(result.current.data?.business_today).toBe('2026-06-20'));

    await act(async () => {
      resolveFirst(buildResult({ business_today: '2026-06-01' }));
    });

    expect(result.current.data?.business_today).toBe('2026-06-20');
    expect(adapter.obterClientesSemRetorno).toHaveBeenCalledTimes(2);
  });

  it('expõe erro de validação em pt-BR sem quebrar o carregamento', async () => {
    const adapter = buildAdapter();
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useClientesSemRetorno(repository, {
        tenantId: 'tenant-1',
        page: 1,
        pageSize: 0,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('O limite deve estar entre 1 e 100.');
    expect(adapter.obterClientesSemRetorno).not.toHaveBeenCalled();
  });

  it('recarrega manualmente por meio de reload', async () => {
    const adapter = buildAdapter();
    vi.mocked(adapter.obterClientesSemRetorno).mockResolvedValue(buildResult());
    const repository = new RelatoriosRepository(adapter);

    const { result } = renderHook(() =>
      useClientesSemRetorno(repository, {
        tenantId: 'tenant-1',
        page: 1,
        pageSize: 20,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(adapter.obterClientesSemRetorno).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(adapter.obterClientesSemRetorno).toHaveBeenCalledTimes(2);
  });

  it('refaz a busca quando a faixa de atraso ou o profissional mudam', async () => {
    const adapter = buildAdapter();
    vi.mocked(adapter.obterClientesSemRetorno).mockResolvedValue(buildResult());
    const repository = new RelatoriosRepository(adapter);

    const { rerender } = renderHook(
      (props: { overdueBand?: 'over_60'; professionalId?: string }) =>
        useClientesSemRetorno(repository, {
          tenantId: 'tenant-1',
          overdueBand: props.overdueBand,
          professionalId: props.professionalId,
          page: 1,
          pageSize: 20,
        }),
      { initialProps: {} as { overdueBand?: 'over_60'; professionalId?: string } }
    );

    await waitFor(() => expect(adapter.obterClientesSemRetorno).toHaveBeenCalledTimes(1));

    rerender({ overdueBand: 'over_60', professionalId: 'prof-1' });

    await waitFor(() => expect(adapter.obterClientesSemRetorno).toHaveBeenCalledTimes(2));
    expect(adapter.obterClientesSemRetorno).toHaveBeenLastCalledWith(
      expect.objectContaining({ overdueBand: 'over_60', professionalId: 'prof-1' })
    );
  });
});
