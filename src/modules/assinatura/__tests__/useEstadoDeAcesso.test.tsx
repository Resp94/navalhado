import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssinaturaRepository } from '../AssinaturaRepository';
import { InMemoryAssinaturaAdapter } from '../adapters/InMemoryAssinaturaAdapter';
import type { EstadoDeAcesso } from '../types';

const { mockObter } = vi.hoisted(() => ({ mockObter: vi.fn() }));

vi.mock('../repositorio', () => ({
  assinaturaRepository: {
    obterEstadoDeAcesso: (...args: unknown[]) => mockObter(...args),
    // A contagem de dias é regra do repositório de verdade, não do mock.
    diasRestantes: (...args: Parameters<AssinaturaRepository['diasRestantes']>) =>
      new AssinaturaRepository(new InMemoryAssinaturaAdapter()).diasRestantes(...args),
  },
}));

import { ATRASO_DA_NOVA_TENTATIVA_MS, useEstadoDeAcesso } from '../useEstadoDeAcesso';

const bloqueado: EstadoDeAcesso = { acesso: 'bloqueado', motivo: 'trial_expired', dataRelevante: new Date('2026-09-29T12:00:00Z') };
const liberado: EstadoDeAcesso = { acesso: 'liberado', motivo: 'active', dataRelevante: null };

/**
 * Segura só o agendamento da nova tentativa (o setTimeout do atraso de 30 s), sem timer
 * falso: o waitFor do Testing Library espera um setTimeout(0) que um timer falso engole.
 * Os demais setTimeout passam direto. Quem chama dispara a nova tentativa à mão.
 */
const interceptarNovaTentativa = () => {
  const setTimeoutReal = globalThis.setTimeout;
  const clearTimeoutReal = globalThis.clearTimeout;
  const agendadas = new Map<number, () => void>();
  let proximoId = 9000;

  const espiaSet = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, atraso?: number, ...resto: unknown[]) => {
    if (atraso !== ATRASO_DA_NOVA_TENTATIVA_MS) return setTimeoutReal(callback, atraso, ...resto);
    const id = proximoId++;
    agendadas.set(id, callback);
    return id;
  }) as unknown as typeof setTimeout);

  const espiaClear = vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((id?: number) => {
    if (typeof id === 'number' && agendadas.has(id)) {
      agendadas.delete(id);
      return;
    }
    return clearTimeoutReal(id as never);
  }) as unknown as typeof clearTimeout);

  return {
    agendadas,
    dispararTodas: async () => {
      const pendentes = [...agendadas.values()];
      agendadas.clear();
      await act(async () => pendentes.forEach((callback) => callback()));
    },
    restaurar: () => {
      espiaSet.mockRestore();
      espiaClear.mockRestore();
    },
  };
};

describe('useEstadoDeAcesso', () => {
  let intercepcao: ReturnType<typeof interceptarNovaTentativa> | null = null;

  beforeEach(() => {
    mockObter.mockReset();
    intercepcao = null;
  });

  afterEach(() => {
    intercepcao?.restaurar();
  });

  // O banco resolve a barbearia pelo login, então a leitura não precisa esperar os dados
  // da barbearia chegarem: ela sai junto com eles, sem uma ida ao banco a mais em série.
  it('lê o estado assim que monta, sem esperar dado nenhum da barbearia', () => {
    mockObter.mockReturnValue(new Promise(() => {}));

    renderHook(() => useEstadoDeAcesso());

    expect(mockObter).toHaveBeenCalledTimes(1);
  });

  it('começa carregando e entrega o estado lido', async () => {
    mockObter.mockResolvedValue(bloqueado);

    const { result } = renderHook(() => useEstadoDeAcesso());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.estado).toEqual(bloqueado);
  });

  it('usuário sem barbearia termina de carregar sem estado', async () => {
    mockObter.mockResolvedValue(null);

    const { result } = renderHook(() => useEstadoDeAcesso());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.estado).toBeNull();
  });

  it('falha na leitura termina em erro sem estado: o painel abre, o banco protege o resto', async () => {
    mockObter.mockRejectedValue(new Error('sem rede'));
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useEstadoDeAcesso());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.estado).toBeNull();
    erro.mockRestore();
  });

  // Sem isso, uma barbearia bloqueada que abriu o painel por uma falha de rede no login
  // ficaria aberta até a pessoa trocar de aba.
  it('se a primeira leitura falha, agenda nova tentativa e passa a mostrar o bloqueio quando ela lê', async () => {
    intercepcao = interceptarNovaTentativa();
    mockObter.mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce(bloqueado);
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useEstadoDeAcesso());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(intercepcao.agendadas.size).toBe(1);
    expect(mockObter).toHaveBeenCalledTimes(1);

    await intercepcao.dispararTodas();

    await waitFor(() => expect(result.current.estado).toEqual(bloqueado));
    expect(result.current.status).toBe('ready');
    expect(mockObter).toHaveBeenCalledTimes(2);
    erro.mockRestore();
  });

  it('a nova tentativa é cancelada ao desmontar', async () => {
    intercepcao = interceptarNovaTentativa();
    mockObter.mockRejectedValue(new Error('sem rede'));
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useEstadoDeAcesso());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(intercepcao.agendadas.size).toBe(1);

    unmount();

    expect(intercepcao.agendadas.size).toBe(0);
    erro.mockRestore();
  });

  it('ao voltar para a aba, lê de novo e o bloqueio novo aparece', async () => {
    mockObter.mockResolvedValueOnce(liberado).mockResolvedValueOnce(bloqueado);

    const { result } = renderHook(() => useEstadoDeAcesso());
    await waitFor(() => expect(result.current.estado).toEqual(liberado));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(result.current.estado).toEqual(bloqueado));
    expect(mockObter).toHaveBeenCalledTimes(2);
  });

  it('se a releitura falha, mantém o último estado em vez de abrir o painel, sem agendar nova tentativa', async () => {
    mockObter.mockResolvedValueOnce(bloqueado).mockRejectedValueOnce(new Error('sem rede'));
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useEstadoDeAcesso());
    await waitFor(() => expect(result.current.estado).toEqual(bloqueado));
    intercepcao = interceptarNovaTentativa();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(mockObter).toHaveBeenCalledTimes(2));
    await act(async () => {});

    expect(intercepcao.agendadas.size).toBe(0);
    expect(result.current.estado).toEqual(bloqueado);
    expect(result.current.status).toBe('ready');
    erro.mockRestore();
  });

  it('a contagem de dias sai do estado lido', async () => {
    const fim = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 60_000);
    mockObter.mockResolvedValue({ acesso: 'aviso', motivo: 'trial', dataRelevante: fim });

    const { result } = renderHook(() => useEstadoDeAcesso());

    await waitFor(() => expect(result.current.diasRestantes).toBe(2));
  });
});
