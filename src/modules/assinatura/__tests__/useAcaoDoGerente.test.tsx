import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAcaoDoGerente } from '../useAcaoDoGerente';

// Spec 052, ticket 12 (revisão): as ações do Gerente que falam com a função de cobrança (trocar o cartão, trocar de plano,
// desfazer a descida, cancelar) repetiam a mesma estrutura: andamento, erro e o try/catch/finally. Esta é a única cópia.

const OPCOES = { rotulo: 'Erro ao fazer a ação de teste', mensagemPadrao: 'Não foi possível fazer a ação. Tente de novo.' };

describe('useAcaoDoGerente', () => {
  let erroNoLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    erroNoLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    erroNoLog.mockRestore();
  });

  it('começa parado e sem erro', () => {
    const { result } = renderHook(() => useAcaoDoGerente(async () => 'ok', OPCOES));

    expect(result.current.emAndamento).toBe(false);
    expect(result.current.erro).toBeNull();
  });

  it('devolve o resultado da ação e passa os argumentos', async () => {
    const acao = vi.fn(async (a: string, b: number) => `${a}-${b}`);
    const { result } = renderHook(() => useAcaoDoGerente(acao, OPCOES));

    let devolvido: string | null = null;
    await act(async () => {
      devolvido = await result.current.executar('x', 2);
    });

    expect(devolvido).toBe('x-2');
    expect(acao).toHaveBeenCalledWith('x', 2);
    expect(result.current.erro).toBeNull();
  });

  it('liga o andamento enquanto a ação roda e o desliga no fim', async () => {
    let concluir: (valor: string) => void = () => {};
    const acao = () => new Promise<string>((resolve) => (concluir = resolve));
    const { result } = renderHook(() => useAcaoDoGerente(acao, OPCOES));

    let pendente: Promise<string | null> = Promise.resolve(null);
    act(() => {
      pendente = result.current.executar();
    });
    expect(result.current.emAndamento).toBe(true);

    await act(async () => {
      concluir('pronto');
      await pendente;
    });
    expect(result.current.emAndamento).toBe(false);
  });

  it('se a ação falha, devolve nulo, guarda a mensagem da função para mostrar ao Gerente e registra no log', async () => {
    const acao = async () => {
      throw new Error('O cartão não tem saldo suficiente.');
    };
    const { result } = renderHook(() => useAcaoDoGerente(acao, OPCOES));

    let devolvido: unknown = 'nada';
    await act(async () => {
      devolvido = await result.current.executar();
    });

    expect(devolvido).toBeNull();
    expect(result.current.erro).toBe('O cartão não tem saldo suficiente.');
    expect(result.current.emAndamento).toBe(false);
    expect(erroNoLog).toHaveBeenCalledWith('Erro ao fazer a ação de teste:', 'O cartão não tem saldo suficiente.');
  });

  it('falha que não é um Error usa a mensagem padrão, sem vazar o que foi lançado', async () => {
    const acao = () => Promise.reject('texto solto');
    const { result } = renderHook(() => useAcaoDoGerente(acao, OPCOES));

    await act(async () => {
      await result.current.executar();
    });

    expect(result.current.erro).toBe(OPCOES.mensagemPadrao);
    expect(erroNoLog).toHaveBeenCalledWith('Erro ao fazer a ação de teste:', 'erro');
  });

  it('a próxima execução esquece o erro anterior; "limparErro" também', async () => {
    const acao = vi.fn<() => Promise<string>>();
    acao.mockRejectedValueOnce(new Error('falhou'));
    acao.mockResolvedValueOnce('ok');
    const { result } = renderHook(() => useAcaoDoGerente(acao, OPCOES));
    await act(async () => {
      await result.current.executar();
    });
    expect(result.current.erro).toBe('falhou');

    await act(async () => {
      await result.current.executar();
    });
    expect(result.current.erro).toBeNull();

    acao.mockRejectedValueOnce(new Error('falhou de novo'));
    await act(async () => {
      await result.current.executar();
    });
    expect(result.current.erro).toBe('falhou de novo');
    act(() => result.current.limparErro());
    expect(result.current.erro).toBeNull();
  });

  // As telas usam `executar` em manipuladores e dependências de efeitos: uma função nova a cada render as faria rodar de novo.
  it('"executar" e "limparErro" são os mesmos a cada render enquanto a ação é a mesma', () => {
    const acao = async () => 'ok';
    const { result, rerender } = renderHook(() => useAcaoDoGerente(acao, OPCOES));
    const { executar, limparErro } = result.current;

    rerender();

    expect(result.current.executar).toBe(executar);
    expect(result.current.limparErro).toBe(limparErro);
  });
});
