import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    reabrirCaixa: vi.fn(),
    registrarAjuste: vi.fn(),
    obterExtrato: vi.fn(),
    obterResumoFinanceiroDiario: vi.fn(),
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

  it('delega abertura válida preservando o contrato da sessão', async () => {
    const input = { tenant_id: 't-1', opened_by: 'user-1', initial_amount: 100, notes: 'Turno manhã' };
    const session = {
      id: 'sess-3',
      tenant_id: 't-1',
      opened_by: 'user-1',
      closed_by: null,
      opened_at: '2026-08-18T08:00:00Z',
      closed_at: null,
      initial_amount: 100,
      closing_amount: null,
      status: 'open' as const,
      notes: 'Turno manhã',
    };
    vi.mocked(mockAdapter.obterSessaoAtiva).mockResolvedValueOnce(null);
    vi.mocked(mockAdapter.abrirCaixa).mockResolvedValueOnce(session);

    const result = await repository.openSession(input);

    expect(result).toEqual(session);
    expect(mockAdapter.abrirCaixa).toHaveBeenCalledWith(input);
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

    it('obtém o resumo financeiro diário pelo seam do CaixaRepository', async () => {
      const dailySummary = [
        {
          date: '2026-08-28',
          realized_revenue: 80,
          received_total: 80,
          by_method: { dinheiro: 40, pix: 40, cartao: 0, outros: 0 },
          closed_comandas_count: 1,
          payment_count: 2,
        },
      ];
      vi.mocked(mockAdapter.obterResumoFinanceiroDiario).mockResolvedValueOnce(dailySummary);

      const result = await repository.getDailyFinancialSummary({
        tenantId: 't-1',
        startDate: '2026-08-28',
        endDate: '2026-08-28',
        timeZone: 'America/Manaus',
        cashSessionId: 'session-1',
      });

      expect(result).toEqual(dailySummary);
      expect(mockAdapter.obterResumoFinanceiroDiario).toHaveBeenCalledWith({
        tenantId: 't-1',
        startDate: '2026-08-28',
        endDate: '2026-08-28',
        timeZone: 'America/Manaus',
        cashSessionId: 'session-1',
      });
    });

    it('rejeita resumo diário sem fuso horário', async () => {
      await expect(
        repository.getDailyFinancialSummary({
          tenantId: 't-1',
          startDate: '2026-08-28',
          endDate: '2026-08-28',
          timeZone: '',
        }),
      ).rejects.toThrow(CaixaValidationError);
    });

  it('lança erro ao fechar caixa sem ID de sessão', async () => {
    await expect(
      repository.closeSession({
        session_id: '',
        tenant_id: 't-1',
        closing_amount: 100,
      })
    ).rejects.toThrow(CaixaValidationError);
  });

  it('delega fechamento válido preservando valor contado e observação', async () => {
    const input = {
      session_id: 'sess-1',
      tenant_id: 't-1',
      closed_by: 'user-1',
      closing_amount: 370,
      notes: 'Conferência concluída',
    };
    const closedSession = {
      id: 'sess-1',
      tenant_id: 't-1',
      opened_by: 'user-1',
      closed_by: 'user-1',
      opened_at: '2026-08-18T08:00:00Z',
      closed_at: '2026-08-18T18:00:00Z',
      initial_amount: 100,
      closing_amount: 370,
      status: 'closed' as const,
      notes: 'Conferência concluída',
    };
    vi.mocked(mockAdapter.fecharCaixa).mockResolvedValueOnce(closedSession);

    const result = await repository.closeSession(input);

    expect(result).toEqual(closedSession);
    expect(mockAdapter.fecharCaixa).toHaveBeenCalledWith(input);
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

  describe('reopenSession', () => {
    beforeEach(() => {
      vi.mocked(mockAdapter.reabrirCaixa).mockClear();
    });

    it('reabre a sessao de caixa repassando o contrato ao adaptador', async () => {
      vi.mocked(mockAdapter.reabrirCaixa).mockResolvedValueOnce({
        id: 'sess-1',
        tenant_id: 't-1',
        opened_by: 'user-1',
        closed_by: null,
        opened_at: new Date().toISOString(),
        closed_at: null,
        initial_amount: 100,
        closing_amount: null,
        status: 'open',
        notes: null,
      });

      const session = await repository.reopenSession({
        session_id: 'sess-1',
        tenant_id: 't-1',
        reason: 'Contagem incorreta na conferencia',
      });

      expect(session.status).toBe('open');
      expect(mockAdapter.reabrirCaixa).toHaveBeenCalledWith({
        session_id: 'sess-1',
        tenant_id: 't-1',
        reason: 'Contagem incorreta na conferencia',
      });
    });

    it('rejeita reabertura sem sessao informada', async () => {
      await expect(
        repository.reopenSession({ session_id: '', tenant_id: 't-1', reason: 'motivo valido' })
      ).rejects.toThrow(CaixaValidationError);
      expect(mockAdapter.reabrirCaixa).not.toHaveBeenCalled();
    });

    it('rejeita reabertura sem justificativa suficiente', async () => {
      await expect(
        repository.reopenSession({ session_id: 'sess-1', tenant_id: 't-1', reason: 'oi' })
      ).rejects.toThrow(CaixaValidationError);
      expect(mockAdapter.reabrirCaixa).not.toHaveBeenCalled();
    });
  });

  describe('registerAdjustment', () => {
    beforeEach(() => {
      vi.mocked(mockAdapter.registrarAjuste).mockClear();
    });

    it('registra um ajuste posterior repassando o contrato ao adaptador', async () => {
      vi.mocked(mockAdapter.registrarAjuste).mockResolvedValueOnce({
        success: true,
        adjustment_id: 'adj-1',
        cash_session_id: 'sess-1',
        original_expected_amount: 150,
        original_closing_amount: 150,
        original_difference_amount: 0,
        previous_adjustment_amount: 0,
        adjusted_closing_amount: 155,
        adjusted_difference_amount: 5,
      });

      const result = await repository.registerAdjustment({
        session_id: 'sess-1',
        tenant_id: 't-1',
        adjustment_amount: 5,
        reason: 'Diferenca encontrada na conferencia',
      });

      expect(result.adjustment_id).toBe('adj-1');
      expect(mockAdapter.registrarAjuste).toHaveBeenCalledWith({
        session_id: 'sess-1',
        tenant_id: 't-1',
        adjustment_amount: 5,
        reason: 'Diferenca encontrada na conferencia',
      });
    });

    it('rejeita ajuste sem sessao informada', async () => {
      await expect(
        repository.registerAdjustment({ session_id: '', tenant_id: 't-1', adjustment_amount: 5, reason: 'motivo valido' })
      ).rejects.toThrow(CaixaValidationError);
      expect(mockAdapter.registrarAjuste).not.toHaveBeenCalled();
    });

    it('rejeita ajuste com valor zero', async () => {
      await expect(
        repository.registerAdjustment({ session_id: 'sess-1', tenant_id: 't-1', adjustment_amount: 0, reason: 'motivo valido' })
      ).rejects.toThrow(CaixaValidationError);
      expect(mockAdapter.registrarAjuste).not.toHaveBeenCalled();
    });

    it('rejeita ajuste sem justificativa suficiente', async () => {
      await expect(
        repository.registerAdjustment({ session_id: 'sess-1', tenant_id: 't-1', adjustment_amount: 5, reason: 'oi' })
      ).rejects.toThrow(CaixaValidationError);
      expect(mockAdapter.registrarAjuste).not.toHaveBeenCalled();
    });
  });

  describe('getSessionStatement', () => {
    beforeEach(() => {
      vi.mocked(mockAdapter.obterExtrato).mockClear();
    });

    it('consulta o extrato repassando o contrato ao adaptador', async () => {
      vi.mocked(mockAdapter.obterExtrato).mockResolvedValueOnce({
        session: {
          id: 'sess-1',
          tenant_id: 't-1',
          opened_by: 'user-1',
          closed_by: 'user-1',
          opened_at: new Date().toISOString(),
          closed_at: new Date().toISOString(),
          initial_amount: 100,
          closing_amount: 150,
          status: 'closed',
          notes: null,
        },
        adjustments: [],
        adjusted_difference_amount: 0,
        movements: [],
        reopenings: [],
      });

      const statement = await repository.getSessionStatement('sess-1', 't-1');

      expect(statement.session.id).toBe('sess-1');
      expect(mockAdapter.obterExtrato).toHaveBeenCalledWith('sess-1', 't-1');
    });

    it('rejeita consulta sem sessao informada', async () => {
      await expect(repository.getSessionStatement('', 't-1')).rejects.toThrow(CaixaValidationError);
      expect(mockAdapter.obterExtrato).not.toHaveBeenCalled();
    });

    it('rejeita consulta sem tenant informado', async () => {
      await expect(repository.getSessionStatement('sess-1', '')).rejects.toThrow(CaixaValidationError);
      expect(mockAdapter.obterExtrato).not.toHaveBeenCalled();
    });
  });

  describe('calculateExpectedDrawerCash', () => {
    it('calcula o saldo esperado com troco inicial, entradas, suprimentos e sangrias', async () => {
      const { calculateExpectedDrawerCash } = await import('../CaixaRepository');
      const total = calculateExpectedDrawerCash(100, 250, 50, 30);
      expect(total).toBe(370); // 100 + 250 + 50 - 30
    });

    it('trata valores zerados ou indefinidos com segurança', async () => {
      const { calculateExpectedDrawerCash } = await import('../CaixaRepository');
      const total = calculateExpectedDrawerCash(0, 0);
      expect(total).toBe(0);
    });
  });
});

