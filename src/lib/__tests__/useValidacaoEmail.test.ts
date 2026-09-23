import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useValidacaoEmail } from '../useValidacaoEmail';

const dnsResponse = (status: number, answers: { type: number; data: string }[] = []) => ({
  ok: true,
  json: async () => ({
    Status: status,
    Answer: answers.map((a) => ({ name: 'x', type: a.type, TTL: 300, data: a.data })),
  }),
});

describe('useValidacaoEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validarParaSalvar não bloqueia e-mail vazio (campo opcional)', async () => {
    const { result } = renderHook(() => useValidacaoEmail());
    const msg = await act(() => result.current.validarParaSalvar(''));
    expect(msg).toBe('');
  });

  it('validarParaSalvar bloqueia formato inválido sem consultar DNS', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useValidacaoEmail());
    const msg = await act(() => result.current.validarParaSalvar('joao@x.c'));
    expect(msg).toBe('O formato do e-mail é inválido.');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validarParaSalvar bloqueia domínio sem MX', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(dnsResponse(3) as any);
    const { result } = renderHook(() => useValidacaoEmail());
    const msg = await act(() => result.current.validarParaSalvar('joao@dominio-inventado-hook.example'));
    expect(msg).toBe('Este domínio não recebe e-mails.');
  });

  it('validarParaSalvar libera quando a consulta de domínio falha (indisponível)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fora do ar'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useValidacaoEmail());
    const msg = await act(() => result.current.validarParaSalvar('joao@dominio-indisponivel-hook.example'));
    expect(msg).toBe('');
  });

  it('validarParaSalvar aceita domínio com MX', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      dnsResponse(0, [{ type: 15, data: '10 mail.dominio-valido-hook.example.' }]) as any
    );
    const { result } = renderHook(() => useValidacaoEmail());
    const msg = await act(() => result.current.validarParaSalvar('joao@dominio-valido-hook.example'));
    expect(msg).toBe('');
  });

  it('validarAoSair não faz nada com o campo vazio', () => {
    const { result } = renderHook(() => useValidacaoEmail());
    act(() => result.current.validarAoSair(''));
    expect(result.current.erro).toBe('');
  });

  it('validarAoSair define o erro de formato de forma síncrona', () => {
    const { result } = renderHook(() => useValidacaoEmail());
    act(() => result.current.validarAoSair('joao@x.c'));
    expect(result.current.erro).toBe('O formato do e-mail é inválido.');
  });

  it('validarAoSair define o erro de domínio depois da consulta assíncrona', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(dnsResponse(3) as any);
    const { result } = renderHook(() => useValidacaoEmail());
    act(() => result.current.validarAoSair('joao@dominio-inventado-blur.example'));
    await waitFor(() => expect(result.current.erro).toBe('Este domínio não recebe e-mails.'));
  });

  it('validarAoSair define a sugestão para domínio de provedor comum digitado errado', () => {
    const { result } = renderHook(() => useValidacaoEmail());
    act(() => result.current.validarAoSair('joao@gmial.com'));
    expect(result.current.sugestao).toBe('joao@gmail.com');
  });

  it('validarAoSair não define sugestão quando o domínio já está correto', () => {
    const { result } = renderHook(() => useValidacaoEmail());
    act(() => result.current.validarAoSair('joao@gmail.com'));
    expect(result.current.sugestao).toBeNull();
  });

  it('validarAoSair não define sugestão com o campo vazio', () => {
    const { result } = renderHook(() => useValidacaoEmail());
    act(() => result.current.validarAoSair(''));
    expect(result.current.sugestao).toBeNull();
  });

  it('aplicarSugestao devolve o e-mail corrigido e limpa a sugestão', () => {
    const { result } = renderHook(() => useValidacaoEmail());
    act(() => result.current.validarAoSair('joao@gmial.com'));
    expect(result.current.sugestao).toBe('joao@gmail.com');

    let corrigido = '';
    act(() => {
      corrigido = result.current.aplicarSugestao();
    });

    expect(corrigido).toBe('joao@gmail.com');
    expect(result.current.sugestao).toBeNull();
  });
});
