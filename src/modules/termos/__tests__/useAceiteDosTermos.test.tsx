import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockJaAceitou, mockAceitar } = vi.hoisted(() => ({ mockJaAceitou: vi.fn(), mockAceitar: vi.fn() }));

vi.mock('../repositorio', () => ({
  termosRepository: {
    jaAceitou: (...args: unknown[]) => mockJaAceitou(...args),
    aceitar: (...args: unknown[]) => mockAceitar(...args),
  },
}));

import { VERSAO_ATUAL_DOS_TERMOS } from '../textos';
import { useAceiteDosTermos } from '../useAceiteDosTermos';
import { MENSAGEM_ACEITAR_FALHOU } from '../errors';

// Spec 052, ticket 16: o porteiro do Gerente lê se a versão atual dos termos já foi aceita. Pendente, o painel fica atrás da tela de
// aceite; se a leitura falha, o painel abre (o aceite é do front: travar todo mundo por uma falha de rede seria pior).

describe('useAceiteDosTermos', () => {
  let erroNoLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockJaAceitou.mockReset();
    mockAceitar.mockReset();
    erroNoLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    erroNoLog.mockRestore();
  });

  it('começa carregando e pergunta pela versão atual dos termos', async () => {
    mockJaAceitou.mockResolvedValue(true);

    const { result } = renderHook(() => useAceiteDosTermos());

    expect(result.current.situacao).toBe('carregando');
    await waitFor(() => expect(result.current.situacao).not.toBe('carregando'));
    expect(mockJaAceitou).toHaveBeenCalledWith(VERSAO_ATUAL_DOS_TERMOS);
  });

  it('versão já aceita: situação "aceito"', async () => {
    mockJaAceitou.mockResolvedValue(true);

    const { result } = renderHook(() => useAceiteDosTermos());

    await waitFor(() => expect(result.current.situacao).toBe('aceito'));
  });

  it('versão ainda não aceita: situação "pendente"', async () => {
    mockJaAceitou.mockResolvedValue(false);

    const { result } = renderHook(() => useAceiteDosTermos());

    await waitFor(() => expect(result.current.situacao).toBe('pendente'));
  });

  it('se a leitura falha, a situação é "indisponivel" (o painel abre) e a falha vai para o log', async () => {
    mockJaAceitou.mockRejectedValue(new Error('rede fora do ar'));

    const { result } = renderHook(() => useAceiteDosTermos());

    await waitFor(() => expect(result.current.situacao).toBe('indisponivel'));
    expect(erroNoLog).toHaveBeenCalledWith('Erro ao ler o aceite dos termos:', expect.any(Error));
  });

  it('aceita uma versão passada por quem chama', async () => {
    mockJaAceitou.mockResolvedValue(false);

    const { result } = renderHook(() => useAceiteDosTermos('2027-01-01'));
    await waitFor(() => expect(result.current.situacao).toBe('pendente'));

    expect(mockJaAceitou).toHaveBeenCalledWith('2027-01-01');
    mockAceitar.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.aceitar();
    });
    expect(mockAceitar).toHaveBeenCalledWith('2027-01-01');
  });

  it('aceitar grava o aceite da versão atual e a situação passa a "aceito"', async () => {
    mockJaAceitou.mockResolvedValue(false);
    mockAceitar.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAceiteDosTermos());
    await waitFor(() => expect(result.current.situacao).toBe('pendente'));

    await act(async () => {
      await result.current.aceitar();
    });

    expect(mockAceitar).toHaveBeenCalledWith(VERSAO_ATUAL_DOS_TERMOS);
    expect(result.current.situacao).toBe('aceito');
    expect(result.current.erro).toBeNull();
  });

  it('liga "aceitando" enquanto o aceite é gravado e o desliga no fim', async () => {
    mockJaAceitou.mockResolvedValue(false);
    let concluir: () => void = () => {};
    mockAceitar.mockImplementation(() => new Promise<void>((resolve) => (concluir = resolve)));
    const { result } = renderHook(() => useAceiteDosTermos());
    await waitFor(() => expect(result.current.situacao).toBe('pendente'));

    let pendente: Promise<void> = Promise.resolve();
    act(() => {
      pendente = result.current.aceitar();
    });
    expect(result.current.aceitando).toBe(true);
    expect(result.current.situacao).toBe('pendente');

    await act(async () => {
      concluir();
      await pendente;
    });
    expect(result.current.aceitando).toBe(false);
    expect(result.current.situacao).toBe('aceito');
  });

  it('se gravar o aceite falha, a situação continua "pendente" e a mensagem fica para mostrar ao Gerente', async () => {
    mockJaAceitou.mockResolvedValue(false);
    mockAceitar.mockRejectedValue(new Error(MENSAGEM_ACEITAR_FALHOU));
    const { result } = renderHook(() => useAceiteDosTermos());
    await waitFor(() => expect(result.current.situacao).toBe('pendente'));

    await act(async () => {
      await result.current.aceitar();
    });

    expect(result.current.situacao).toBe('pendente');
    expect(result.current.erro).toBe(MENSAGEM_ACEITAR_FALHOU);
    expect(result.current.aceitando).toBe(false);
  });

  it('depois de uma falha, tentar de novo funciona e esquece o erro', async () => {
    mockJaAceitou.mockResolvedValue(false);
    mockAceitar.mockRejectedValueOnce(new Error(MENSAGEM_ACEITAR_FALHOU)).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useAceiteDosTermos());
    await waitFor(() => expect(result.current.situacao).toBe('pendente'));
    await act(async () => {
      await result.current.aceitar();
    });
    expect(result.current.erro).toBe(MENSAGEM_ACEITAR_FALHOU);

    await act(async () => {
      await result.current.aceitar();
    });

    expect(result.current.situacao).toBe('aceito');
    expect(result.current.erro).toBeNull();
  });
});
