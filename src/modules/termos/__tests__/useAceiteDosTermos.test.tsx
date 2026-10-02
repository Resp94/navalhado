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

  // A leitura que falhou (rede, ou a migration ainda não aplicada no ambiente) não deixa a aba aberta sem a tela de aceite para sempre:
  // quando o Gerente volta à aba, o hook lê de novo (como o useEstadoDeAcesso).
  describe('depois de uma leitura que falhou', () => {
    const voltarParaAAba = () =>
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

    it('relê quando a aba volta a ficar visível e, com o aceite pendente, passa a "pendente"', async () => {
      mockJaAceitou.mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce(false);
      const { result } = renderHook(() => useAceiteDosTermos());
      await waitFor(() => expect(result.current.situacao).toBe('indisponivel'));

      voltarParaAAba();

      await waitFor(() => expect(result.current.situacao).toBe('pendente'));
      expect(mockJaAceitou).toHaveBeenCalledTimes(2);
    });

    it('com o aceite já gravado, a releitura passa a "aceito"', async () => {
      mockJaAceitou.mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce(true);
      const { result } = renderHook(() => useAceiteDosTermos());
      await waitFor(() => expect(result.current.situacao).toBe('indisponivel'));

      voltarParaAAba();

      await waitFor(() => expect(result.current.situacao).toBe('aceito'));
    });

    it('se a releitura também falha, segue "indisponivel" e a próxima volta à aba tenta de novo', async () => {
      mockJaAceitou
        .mockRejectedValueOnce(new Error('sem rede'))
        .mockRejectedValueOnce(new Error('sem rede de novo'))
        .mockResolvedValueOnce(false);
      const { result } = renderHook(() => useAceiteDosTermos());
      await waitFor(() => expect(result.current.situacao).toBe('indisponivel'));

      voltarParaAAba();
      await waitFor(() => expect(mockJaAceitou).toHaveBeenCalledTimes(2));
      await act(async () => {});
      expect(result.current.situacao).toBe('indisponivel');

      voltarParaAAba();
      await waitFor(() => expect(result.current.situacao).toBe('pendente'));
      expect(mockJaAceitou).toHaveBeenCalledTimes(3);
    });

    it('só relê quando a aba está visível: com ela escondida, não lê', async () => {
      mockJaAceitou.mockRejectedValue(new Error('sem rede'));
      const { result } = renderHook(() => useAceiteDosTermos());
      await waitFor(() => expect(result.current.situacao).toBe('indisponivel'));
      const visibilidade = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      voltarParaAAba();
      await act(async () => {});

      expect(mockJaAceitou).toHaveBeenCalledTimes(1);
      visibilidade.mockRestore();
    });
  });

  it('com o aceite lido ("aceito" ou "pendente"), voltar à aba não relê: a situação só muda quando o Gerente aceita', async () => {
    mockJaAceitou.mockResolvedValue(false);
    const { result } = renderHook(() => useAceiteDosTermos());
    await waitFor(() => expect(result.current.situacao).toBe('pendente'));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => {});

    expect(mockJaAceitou).toHaveBeenCalledTimes(1);
    expect(result.current.situacao).toBe('pendente');
  });

  it('desmontar tira o ouvinte da aba', async () => {
    mockJaAceitou.mockRejectedValue(new Error('sem rede'));
    const { result, unmount } = renderHook(() => useAceiteDosTermos());
    await waitFor(() => expect(result.current.situacao).toBe('indisponivel'));

    unmount();
    document.dispatchEvent(new Event('visibilitychange'));
    await act(async () => {});

    expect(mockJaAceitou).toHaveBeenCalledTimes(1);
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

  // `executar` devolve nulo quando a ação falha: o sucesso do aceite não pode depender de o repositório devolver (ou não) um valor.
  it('aceitar vale como gravado mesmo que o repositório devolva um valor nulo', async () => {
    mockJaAceitou.mockResolvedValue(false);
    mockAceitar.mockResolvedValue(null);
    const { result } = renderHook(() => useAceiteDosTermos());
    await waitFor(() => expect(result.current.situacao).toBe('pendente'));

    await act(async () => {
      await result.current.aceitar();
    });

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
