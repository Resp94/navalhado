import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGerarArquivos, mockBaixarCsv } = vi.hoisted(() => ({ mockGerarArquivos: vi.fn(), mockBaixarCsv: vi.fn() }));

vi.mock('../repositorio', () => ({
  exportacaoRepository: { gerarArquivos: (...args: unknown[]) => mockGerarArquivos(...args) },
}));
vi.mock('../../relatorios/csv', () => ({ baixarCsv: (...args: unknown[]) => mockBaixarCsv(...args) }));

import { ExportacaoError } from '../ExportacaoRepository';
import { useExportarDados } from '../useExportarDados';

const ARQUIVOS = [
  { nome: 'clientes_2026-10-01.csv', conteudo: 'a' },
  { nome: 'agendamentos_2026-10-01.csv', conteudo: 'b' },
  { nome: 'comandas_2026-10-01.csv', conteudo: 'c' },
];

describe('useExportarDados', () => {
  beforeEach(() => {
    mockGerarArquivos.mockReset();
    mockBaixarCsv.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('gera os arquivos da barbearia no fuso dela e baixa os três, na ordem', async () => {
    mockGerarArquivos.mockResolvedValue(ARQUIVOS);
    const { result } = renderHook(() => useExportarDados('tenant-1', 'America/Manaus', 0));

    await act(async () => {
      await result.current.exportar();
    });

    expect(mockGerarArquivos).toHaveBeenCalledWith('tenant-1', 'America/Manaus');
    expect(mockBaixarCsv.mock.calls).toEqual([
      ['clientes_2026-10-01.csv', 'a'],
      ['agendamentos_2026-10-01.csv', 'b'],
      ['comandas_2026-10-01.csv', 'c'],
    ]);
    expect(result.current.erro).toBeNull();
  });

  it('o fuso padrão é o de Brasília', async () => {
    mockGerarArquivos.mockResolvedValue([]);
    const { result } = renderHook(() => useExportarDados('tenant-1', undefined, 0));

    await act(async () => {
      await result.current.exportar();
    });

    expect(mockGerarArquivos).toHaveBeenCalledWith('tenant-1', 'America/Sao_Paulo');
  });

  it('fica exportando enquanto lê os dados e volta ao normal depois', async () => {
    let terminar: (arquivos: typeof ARQUIVOS) => void = () => {};
    mockGerarArquivos.mockReturnValue(new Promise((resolve) => (terminar = resolve)));
    const { result } = renderHook(() => useExportarDados('tenant-1', 'America/Manaus', 0));

    act(() => {
      void result.current.exportar();
    });
    await waitFor(() => expect(result.current.exportando).toBe(true));
    expect(mockBaixarCsv).not.toHaveBeenCalled();

    await act(async () => {
      terminar(ARQUIVOS);
    });
    await waitFor(() => expect(result.current.exportando).toBe(false));
    expect(mockBaixarCsv).toHaveBeenCalledTimes(3);
  });

  it('a falha do banco vira uma mensagem para o Gerente, sem baixar nada', async () => {
    mockGerarArquivos.mockRejectedValue(new Error('JWT expired'));
    const { result } = renderHook(() => useExportarDados('tenant-1', 'America/Manaus', 0));

    await act(async () => {
      await result.current.exportar();
    });

    expect(result.current.erro).toBe('Não foi possível exportar os dados. Tente de novo.');
    expect(result.current.exportando).toBe(false);
    expect(mockBaixarCsv).not.toHaveBeenCalled();
  });

  it('a mensagem própria do módulo chega ao Gerente como está', async () => {
    mockGerarArquivos.mockRejectedValue(new ExportacaoError('Não foi possível identificar a barbearia para exportar os dados.'));
    const { result } = renderHook(() => useExportarDados('tenant-1', 'America/Manaus', 0));

    await act(async () => {
      await result.current.exportar();
    });

    expect(result.current.erro).toBe('Não foi possível identificar a barbearia para exportar os dados.');
  });

  it('uma nova tentativa esquece o erro da anterior', async () => {
    mockGerarArquivos.mockRejectedValueOnce(new Error('falhou')).mockResolvedValueOnce(ARQUIVOS);
    const { result } = renderHook(() => useExportarDados('tenant-1', 'America/Manaus', 0));

    await act(async () => {
      await result.current.exportar();
    });
    expect(result.current.erro).not.toBeNull();

    await act(async () => {
      await result.current.exportar();
    });
    expect(result.current.erro).toBeNull();
    expect(mockBaixarCsv).toHaveBeenCalledTimes(3);
  });
});
