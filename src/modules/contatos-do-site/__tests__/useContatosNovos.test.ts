import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockContarNovos, assinantes } = vi.hoisted(() => ({
  mockContarNovos: vi.fn(),
  assinantes: new Set<() => void>(),
}));

vi.mock('../repositorio', () => ({
  contatosDoSiteRepository: {
    contarNovos: () => mockContarNovos(),
    aoMudar: (avisar: () => void) => {
      assinantes.add(avisar);
      return () => assinantes.delete(avisar);
    },
  },
}));

import { INTERVALO_DO_CONTADOR, useContatosNovos } from '../useContatosNovos';

let visibilidade: DocumentVisibilityState = 'visible';

const mudarVisibilidade = (nova: DocumentVisibilityState) => {
  visibilidade = nova;
  document.dispatchEvent(new Event('visibilitychange'));
};

/** Deixa as promessas resolvidas chegarem ao estado do hook. */
const assentar = () => act(async () => {});

describe('useContatosNovos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibilidade = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibilidade);
    mockContarNovos.mockReset();
    mockContarNovos.mockResolvedValue(2);
    assinantes.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lê ao montar', async () => {
    const { result } = renderHook(() => useContatosNovos());
    await assentar();
    expect(mockContarNovos).toHaveBeenCalledTimes(1);
    expect(result.current).toBe(2);
  });

  it('lê de novo a cada 60 segundos com a aba visível', async () => {
    const { result } = renderHook(() => useContatosNovos());
    await assentar();
    mockContarNovos.mockResolvedValue(5);

    await act(async () => {
      vi.advanceTimersByTime(INTERVALO_DO_CONTADOR);
    });

    expect(INTERVALO_DO_CONTADOR).toBe(60_000);
    expect(mockContarNovos).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(5);
  });

  it('não consulta com a aba oculta, e lê ao voltar a ela', async () => {
    renderHook(() => useContatosNovos());
    await assentar();
    mudarVisibilidade('hidden');

    await act(async () => {
      vi.advanceTimersByTime(INTERVALO_DO_CONTADOR * 3);
    });
    expect(mockContarNovos).toHaveBeenCalledTimes(1);

    mudarVisibilidade('visible');
    await assentar();
    expect(mockContarNovos).toHaveBeenCalledTimes(2);
  });

  it('montado com a aba oculta, só lê quando ela fica visível', async () => {
    visibilidade = 'hidden';
    renderHook(() => useContatosNovos());
    await assentar();
    expect(mockContarNovos).not.toHaveBeenCalled();

    mudarVisibilidade('visible');
    await assentar();
    expect(mockContarNovos).toHaveBeenCalledTimes(1);
  });

  it('lê na hora quando o repositório avisa uma mudança de status', async () => {
    const { result } = renderHook(() => useContatosNovos());
    await assentar();
    mockContarNovos.mockResolvedValue(1);

    await act(async () => {
      assinantes.forEach((avisar) => avisar());
    });

    expect(mockContarNovos).toHaveBeenCalledTimes(2);
    expect(result.current).toBe(1);
  });

  it('se a contagem falha, mantém o último número', async () => {
    const { result } = renderHook(() => useContatosNovos());
    await assentar();
    mockContarNovos.mockRejectedValue(new Error('fora do ar'));

    await act(async () => {
      vi.advanceTimersByTime(INTERVALO_DO_CONTADOR);
    });

    expect(result.current).toBe(2);
  });

  it('ao desmontar, para de consultar e cancela o aviso', async () => {
    const { unmount } = renderHook(() => useContatosNovos());
    await assentar();
    unmount();

    await act(async () => {
      vi.advanceTimersByTime(INTERVALO_DO_CONTADOR * 2);
    });
    mudarVisibilidade('visible');

    expect(mockContarNovos).toHaveBeenCalledTimes(1);
    expect(assinantes.size).toBe(0);
  });
});
