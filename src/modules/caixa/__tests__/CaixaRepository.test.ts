import { describe, expect, it, vi } from 'vitest';
import { CaixaRepository, CaixaValidationError } from '../CaixaRepository';
import type { ICaixaAdapter } from '../types';

describe('CaixaRepository', () => {
  const mockAdapter: ICaixaAdapter = {
    obterSessaoAtiva: vi.fn(),
    abrirCaixa: vi.fn(),
    fecharCaixa: vi.fn(),
    listarHistorico: vi.fn(),
    obterEntradasDinheiro: vi.fn(),
    obterResumoTurno: vi.fn(),
    registrarMovimentacao: vi.fn(),
    listarMovimentacoes: vi.fn(),
    obterResumoMovimentacoes: vi.fn(),
  };

  const repository = new CaixaRepository(mockAdapter);

  it('verifica se o caixa está aberto com sucesso', async () => {
    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce({
      id: 'sess-1',
      tenant_id: 't-1',
      opened_by: 'user-1',
      closed_by: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      initial_amount: 50.0,
      closing_amount: null,
      status: 'open',
      notes: null,
    });

    const isOpen = await repository.isCashierOpen('t-1');
    expect(isOpen).toBe(true);
  });

  it('retorna false quando não há caixa aberto', async () => {
    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce(null);
    const isOpen = await repository.isCashierOpen('t-1');
    expect(isOpen).toBe(false);
  });

  it('impede abertura de novo caixa se já houver um aberto', async () => {
    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce({
      id: 'sess-1',
      tenant_id: 't-1',
      opened_by: 'user-1',
      closed_by: null,
      opened_at: new Date().toISOString(),
      closed_at: null,
      initial_amount: 50.0,
      closing_amount: null,
      status: 'open',
      notes: null,
    });

    await expect(
      repository.openSession({
        tenant_id: 't-1',
        initial_amount: 100.0,
      })
    ).rejects.toThrow(CaixaValidationError);
  });

  it('lança erro ao informar fundo de troco negativo', async () => {
    await expect(
      repository.openSession({
        tenant_id: 't-1',
        initial_amount: -20.0,
      })
    ).rejects.toThrow(CaixaValidationError);
  });

  it('lista histórico de caixas com sucesso', async () => {
    const mockHistory = [
      {
        id: 'sess-2',
        tenant_id: 't-1',
        opened_by: 'user-1',
        closed_by: 'user-1',
        opened_at: '2026-08-17T08:00:00Z',
        closed_at: '2026-08-17T18:00:00Z',
        initial_amount: 50.0,
        closing_amount: 350.0,
        status: 'closed' as const,
        notes: 'Fechamento sem divergência',
      },
    ];

    vi.mocked(mockAdapter.listarHistorico).mockResolvedValueOnce(mockHistory);
    const history = await repository.listHistory('t-1');
    expect(history).toEqual(mockHistory);
    expect(mockAdapter.listarHistorico).toHaveBeenCalledWith('t-1', 20);
  });

  it('lança erro ao fechar caixa sem ID de sessão', async () => {
    await expect(
      repository.closeSession({
        session_id: '',
        closing_amount: 100,
      })
    ).rejects.toThrow(CaixaValidationError);
  });

  describe('Movimentações (Sangrias e Suprimentos)', () => {
    it('registra sangria com sucesso', async () => {
      const mockMovement = {
        id: 'mov-1',
        tenant_id: 't-1',
        cash_session_id: 'sess-1',
        type: 'sangria' as const,
        amount: 50,
        reason: 'Pagamento de água',
        performed_by: 'user-1',
        created_at: new Date().toISOString(),
      };

      vi.mocked(mockAdapter.registrarMovimentacao).mockResolvedValueOnce(mockMovement);

      const result = await repository.registerMovement({
        tenant_id: 't-1',
        cash_session_id: 'sess-1',
        type: 'sangria',
        amount: 50,
        reason: 'Pagamento de água',
        performed_by: 'user-1',
      });

      expect(result).toEqual(mockMovement);
      expect(mockAdapter.registrarMovimentacao).toHaveBeenCalled();
    });

    it('valida valor e motivo obrigatórios na movimentação', async () => {
      await expect(
        repository.registerMovement({
          tenant_id: 't-1',
          cash_session_id: 'sess-1',
          type: 'sangria',
          amount: 0,
          reason: 'Teste',
        })
      ).rejects.toThrow(CaixaValidationError);

      await expect(
        repository.registerMovement({
          tenant_id: 't-1',
          cash_session_id: 'sess-1',
          type: 'suprimento',
          amount: 50,
          reason: '   ',
        })
      ).rejects.toThrow(CaixaValidationError);
    });

    it('obtém resumo de suprimentos e sangrias corretamente', async () => {
      vi.mocked(mockAdapter.obterResumoMovimentacoes).mockResolvedValueOnce({
        suprimentos: 100,
        sangrias: 40,
      });

      const summary = await repository.getMovementsSummary('sess-1');
      expect(summary).toEqual({ suprimentos: 100, sangrias: 40 });
    });
  });
});

