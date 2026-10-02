import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AvisoQueFalhou, DetalhesDoTenant } from '../types';

const { mockDetalhes, mockAvisos, mockEstender, mockDarCortesia, mockEncerrarCortesia, mockDesbloquear, mockBloquear } = vi.hoisted(() => ({
  mockDetalhes: vi.fn(),
  mockAvisos: vi.fn(),
  mockEstender: vi.fn(),
  mockDarCortesia: vi.fn(),
  mockEncerrarCortesia: vi.fn(),
  mockDesbloquear: vi.fn(),
  mockBloquear: vi.fn(),
}));

vi.mock('../repositorio', () => ({
  proprietarioRepository: {
    detalhesDoTenant: (...args: unknown[]) => mockDetalhes(...args),
    avisosQueFalharam: (...args: unknown[]) => mockAvisos(...args),
    estenderTeste: (...args: unknown[]) => mockEstender(...args),
    darCortesia: (...args: unknown[]) => mockDarCortesia(...args),
    encerrarCortesia: (...args: unknown[]) => mockEncerrarCortesia(...args),
    desbloquear: (...args: unknown[]) => mockDesbloquear(...args),
    bloquear: (...args: unknown[]) => mockBloquear(...args),
  },
}));

import { useAcoesDoProprietario } from '../useAcoesDoProprietario';
import { useAvisosQueFalharam } from '../useAvisosQueFalharam';
import { useDetalhesDoTenant } from '../useDetalhesDoTenant';

const detalhes = (id: string, nome = 'Alpha'): DetalhesDoTenant => ({
  barbearia: { id, nome, email: 'a@exemplo.com', telefone: '92999990001', fuso: 'America/Manaus', criadaEm: new Date('2026-01-10T15:30:00Z') },
  assinatura: null,
  acesso: { nivel: 'allowed', motivo: 'no_subscription', dataRelevante: null },
  profissionaisAtivos: 0,
  cobrancas: [],
  desbloqueio: null,
  acoes: [],
});

const aviso: AvisoQueFalhou = {
  id: 'aviso-1',
  tenantId: 't1',
  barbearia: 'Alpha',
  tipo: 'trial_ending',
  referenciaEm: new Date('2026-09-20T12:00:00Z'),
  tentativas: 3,
  motivo: 'Resend 401: chave inválida',
  criadoEm: new Date('2026-09-29T12:00:00Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('useDetalhesDoTenant', () => {
  it('sem barbearia escolhida não lê nada', () => {
    const { result } = renderHook(() => useDetalhesDoTenant(null));

    expect(result.current.status).toBe('idle');
    expect(result.current.detalhes).toBeNull();
    expect(mockDetalhes).not.toHaveBeenCalled();
  });

  it('lê os detalhes da barbearia escolhida', async () => {
    mockDetalhes.mockResolvedValue(detalhes('t1'));
    const { result } = renderHook(() => useDetalhesDoTenant('t1'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockDetalhes).toHaveBeenCalledWith('t1');
    expect(result.current.detalhes?.barbearia.nome).toBe('Alpha');
  });

  it('a falha vira uma mensagem, e recarregar tenta de novo', async () => {
    mockDetalhes.mockRejectedValueOnce(new Error('Barbearia não encontrada.')).mockResolvedValueOnce(detalhes('t1'));
    const { result } = renderHook(() => useDetalhesDoTenant('t1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.erro).toBe('Barbearia não encontrada.');

    act(() => result.current.recarregar());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.erro).toBeNull();
  });

  it('recarregar mantém os detalhes na tela enquanto lê de novo', async () => {
    mockDetalhes.mockResolvedValueOnce(detalhes('t1', 'Alpha')).mockResolvedValueOnce(detalhes('t1', 'Alpha renomeada'));
    const { result } = renderHook(() => useDetalhesDoTenant('t1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => result.current.recarregar());
    expect(result.current.detalhes?.barbearia.nome).toBe('Alpha');
    await waitFor(() => expect(result.current.detalhes?.barbearia.nome).toBe('Alpha renomeada'));
  });

  it('trocar de barbearia esquece a anterior e lê a nova', async () => {
    mockDetalhes.mockImplementation((id: string) => Promise.resolve(detalhes(id, `Barbearia ${id}`)));
    const { result, rerender } = renderHook(({ id }: { id: string | null }) => useDetalhesDoTenant(id), { initialProps: { id: 't1' as string | null } });
    await waitFor(() => expect(result.current.detalhes?.barbearia.nome).toBe('Barbearia t1'));

    rerender({ id: 't2' });
    await waitFor(() => expect(result.current.detalhes?.barbearia.nome).toBe('Barbearia t2'));

    rerender({ id: null });
    expect(result.current.detalhes).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('a resposta que chega depois de trocar de barbearia não aparece', async () => {
    let terminarA: (d: DetalhesDoTenant) => void = () => {};
    mockDetalhes.mockImplementation((id: string) => (id === 'a' ? new Promise((resolve) => (terminarA = resolve)) : Promise.resolve(detalhes(id, 'Barbearia B'))));
    const { result, rerender } = renderHook(({ id }: { id: string }) => useDetalhesDoTenant(id), { initialProps: { id: 'a' } });

    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.detalhes?.barbearia.nome).toBe('Barbearia B'));
    await act(async () => {
      terminarA(detalhes('a', 'Barbearia A'));
    });

    expect(result.current.detalhes?.barbearia.nome).toBe('Barbearia B');
  });
});

describe('useAvisosQueFalharam', () => {
  it('lê os avisos que falharam', async () => {
    mockAvisos.mockResolvedValue([aviso]);
    const { result } = renderHook(() => useAvisosQueFalharam());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.avisos).toEqual([aviso]);
  });

  it('a falha deixa a lista vazia e diz que não leu', async () => {
    mockAvisos.mockRejectedValue(new Error('Só o Proprietário pode fazer isso.'));
    const { result } = renderHook(() => useAvisosQueFalharam());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.avisos).toEqual([]);
  });
});

describe('useAcoesDoProprietario', () => {
  it.each([
    ['estenderTeste', { tipo: 'estenderTeste', ate: '2040-03-10' } as const, mockEstender, ['t1', '2040-03-10']],
    ['darCortesia', { tipo: 'darCortesia', ate: null } as const, mockDarCortesia, ['t1', null]],
    ['encerrarCortesia', { tipo: 'encerrarCortesia' } as const, mockEncerrarCortesia, ['t1']],
    ['desbloquear', { tipo: 'desbloquear', ate: '2040-03-10', motivo: 'motivo' } as const, mockDesbloquear, ['t1', '2040-03-10', 'motivo']],
    ['bloquear', { tipo: 'bloquear', motivo: 'motivo' } as const, mockBloquear, ['t1', 'motivo']],
  ])('%s chama o repositório e devolve verdadeiro', async (_nome, pedido, mock, argumentos) => {
    mock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAcoesDoProprietario());

    let resultado: unknown;
    await act(async () => {
      resultado = await result.current.executar('t1', pedido);
    });

    expect(mock).toHaveBeenCalledWith(...argumentos);
    expect(resultado).toBe(true);
    expect(result.current.erro).toBeNull();
  });

  it('a recusa do banco fica em `erro`, pronta para mostrar, e a ação devolve nulo', async () => {
    mockDesbloquear.mockRejectedValue(new Error('Esta barbearia não está bloqueada.'));
    const { result } = renderHook(() => useAcoesDoProprietario());

    let resultado: unknown;
    await act(async () => {
      resultado = await result.current.executar('t1', { tipo: 'desbloquear', ate: '2040-03-10', motivo: 'motivo' });
    });

    expect(resultado).toBeNull();
    expect(result.current.erro).toBe('Esta barbearia não está bloqueada.');

    act(() => result.current.limparErro());
    expect(result.current.erro).toBeNull();
  });
});
