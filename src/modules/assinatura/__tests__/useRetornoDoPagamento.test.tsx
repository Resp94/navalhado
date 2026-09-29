import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INTERVALO_DA_CONFIRMACAO_MS,
  LIMITE_DE_TENTATIVAS,
  useRetornoDoPagamento,
} from '../useRetornoDoPagamento';

// Spec 052, ticket 05: o Gerente volta do Mercado Pago em /configuracoes?assinatura=retorno, mas o
// webhook pode chegar depois. Enquanto a barbearia continua bloqueada, o estado é relido de tempos
// em tempos, por um tempo limitado.

describe('useRetornoDoPagamento', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('só está aguardando quando a URL traz assinatura=retorno', () => {
    expect(renderHook(() => useRetornoDoPagamento('?assinatura=retorno', false, vi.fn())).result.current).toBe(true);
    expect(renderHook(() => useRetornoDoPagamento('', false, vi.fn())).result.current).toBe(false);
    expect(renderHook(() => useRetornoDoPagamento('?assinatura=outra', false, vi.fn())).result.current).toBe(false);
  });

  it('relê o estado a cada intervalo enquanto a barbearia segue bloqueada', () => {
    const recarregar = vi.fn();
    renderHook(() => useRetornoDoPagamento('?assinatura=retorno', true, recarregar));

    expect(recarregar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * 3);

    expect(recarregar).toHaveBeenCalledTimes(3);
  });

  it('para de reler depois do limite de tentativas', () => {
    const recarregar = vi.fn();
    renderHook(() => useRetornoDoPagamento('?assinatura=retorno', true, recarregar));

    vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * (LIMITE_DE_TENTATIVAS + 10));

    expect(recarregar).toHaveBeenCalledTimes(LIMITE_DE_TENTATIVAS);
  });

  it('não relê quando o acesso já voltou', () => {
    const recarregar = vi.fn();
    renderHook(() => useRetornoDoPagamento('?assinatura=retorno', false, recarregar));

    vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * 5);

    expect(recarregar).not.toHaveBeenCalled();
  });

  it('sem assinatura=retorno na URL, nunca relê', () => {
    const recarregar = vi.fn();
    renderHook(() => useRetornoDoPagamento('', true, recarregar));

    vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * 5);

    expect(recarregar).not.toHaveBeenCalled();
  });

  it('para de reler quando o layout desmonta', () => {
    const recarregar = vi.fn();
    const { unmount } = renderHook(() => useRetornoDoPagamento('?assinatura=retorno', true, recarregar));

    unmount();
    vi.advanceTimersByTime(INTERVALO_DA_CONFIRMACAO_MS * 5);

    expect(recarregar).not.toHaveBeenCalled();
  });
});
