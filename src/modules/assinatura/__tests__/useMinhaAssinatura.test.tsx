import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AssinaturaRepository } from '../AssinaturaRepository';
import { InMemoryAssinaturaAdapter } from '../adapters/InMemoryAssinaturaAdapter';
import type { Cobranca, DetalhesDaAssinatura } from '../types';

const { mockObterAssinatura, mockListarCobrancas } = vi.hoisted(() => ({
  mockObterAssinatura: vi.fn(),
  mockListarCobrancas: vi.fn(),
}));

vi.mock('../repositorio', () => ({
  assinaturaRepository: {
    obterAssinatura: (...args: unknown[]) => mockObterAssinatura(...args),
    listarCobrancas: (...args: unknown[]) => mockListarCobrancas(...args),
    // A contagem de dias é regra do repositório de verdade, não do mock.
    diasRestantes: (...args: Parameters<AssinaturaRepository['diasRestantes']>) =>
      new AssinaturaRepository(new InMemoryAssinaturaAdapter()).diasRestantes(...args),
  },
}));

import { useMinhaAssinatura } from '../useMinhaAssinatura';

// Spec 052, ticket 06: o hook da tela Assinatura lê a assinatura e o histórico da barbearia.

const emTeste = (testeAte: Date | null): DetalhesDaAssinatura => ({
  situacao: 'trialing',
  plano: { id: 'plano-tesoura', nome: 'Tesoura', preco: 59.9 },
  planoAgendado: null,
  testeAte,
  periodoAte: null,
  cortesiaAte: null,
  cartao: null,
});

const cobranca: Cobranca = {
  id: '1352660205',
  valor: 59.9,
  cobradaEm: new Date('2026-09-29T23:26:22Z'),
  situacao: 'approved',
  tipo: 'recurring',
  cartao: { bandeira: 'visa', final: '5682' },
};

describe('useMinhaAssinatura', () => {
  beforeEach(() => {
    mockObterAssinatura.mockReset();
    mockListarCobrancas.mockReset();
    mockListarCobrancas.mockResolvedValue([]);
  });

  it('lê a assinatura e o histórico da barbearia', async () => {
    mockObterAssinatura.mockResolvedValue(emTeste(null));
    mockListarCobrancas.mockResolvedValue([cobranca]);

    const { result } = renderHook(() => useMinhaAssinatura('tenant-a'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockObterAssinatura).toHaveBeenCalledWith('tenant-a');
    expect(mockListarCobrancas).toHaveBeenCalledWith('tenant-a');
    expect(result.current.assinatura?.plano.nome).toBe('Tesoura');
    expect(result.current.cobrancas).toEqual([cobranca]);
    expect(result.current.historicoIndisponivel).toBe(false);
  });

  it('em teste, conta os dias que faltam para o fim do teste', async () => {
    const daqui10Dias = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 - 60_000);
    mockObterAssinatura.mockResolvedValue(emTeste(daqui10Dias));

    const { result } = renderHook(() => useMinhaAssinatura('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.diasRestantes).toBe(10);
  });

  it('barbearia sem assinatura: pronto, sem assinatura', async () => {
    mockObterAssinatura.mockResolvedValue(null);

    const { result } = renderHook(() => useMinhaAssinatura('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.assinatura).toBeNull();
    expect(result.current.diasRestantes).toBeNull();
  });

  it('falha ao ler a assinatura vira erro, sem assinatura', async () => {
    mockObterAssinatura.mockRejectedValue(new Error('sem rede'));

    const { result } = renderHook(() => useMinhaAssinatura('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.assinatura).toBeNull();
  });

  it('falha só no histórico não esconde a assinatura: avisa que o histórico não veio', async () => {
    mockObterAssinatura.mockResolvedValue(emTeste(null));
    mockListarCobrancas.mockRejectedValue(new Error('sem rede'));

    const { result } = renderHook(() => useMinhaAssinatura('tenant-a'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.assinatura?.plano.nome).toBe('Tesoura');
    expect(result.current.cobrancas).toEqual([]);
    expect(result.current.historicoIndisponivel).toBe(true);
  });

  it('sem id da barbearia, não lê nada', () => {
    const { result } = renderHook(() => useMinhaAssinatura(''));

    expect(result.current.status).toBe('loading');
    expect(mockObterAssinatura).not.toHaveBeenCalled();
  });

  it('recarregar relê a assinatura e o histórico', async () => {
    mockObterAssinatura.mockResolvedValueOnce(emTeste(null));
    const { result } = renderHook(() => useMinhaAssinatura('tenant-a'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    mockObterAssinatura.mockResolvedValueOnce({ ...emTeste(null), situacao: 'active' });
    mockListarCobrancas.mockResolvedValueOnce([cobranca]);
    act(() => result.current.recarregar());

    await waitFor(() => expect(result.current.assinatura?.situacao).toBe('active'));
    expect(result.current.cobrancas).toEqual([cobranca]);
    expect(mockObterAssinatura).toHaveBeenCalledTimes(2);
  });

  it('se a releitura falha, mantém o que já estava na tela', async () => {
    mockObterAssinatura.mockResolvedValueOnce(emTeste(null));
    const { result } = renderHook(() => useMinhaAssinatura('tenant-a'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    mockObterAssinatura.mockRejectedValueOnce(new Error('sem rede'));
    act(() => result.current.recarregar());

    await waitFor(() => expect(mockObterAssinatura).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('ready');
    expect(result.current.assinatura?.plano.nome).toBe('Tesoura');
  });
});
