import { describe, expect, it, vi } from 'vitest';
import { SupabaseCaixaAdapter } from '../SupabaseCaixaAdapter';

const { mockRpc, mockFrom, mockQuery } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  mockQuery: {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    then: vi.fn(),
  },
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

describe('SupabaseCaixaAdapter - resumo financeiro diário', () => {
  it('restringe o resumo à sessão informada', async () => {
    mockFrom.mockReturnValue(mockQuery);
    mockQuery.select.mockReturnValue(mockQuery);
    mockQuery.eq.mockReturnValue(mockQuery);
    mockQuery.then.mockImplementation((resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ payment_method: 'pix', amount: 20 }], error: null }).then(resolve)
    );

    await new SupabaseCaixaAdapter().obterResumoTurno('tenant-1', '2026-08-28T10:00:00Z', 'session-1');

    expect(mockQuery.eq).toHaveBeenCalledWith('cash_session_id', 'session-1');
    expect(mockQuery.gte).not.toHaveBeenCalled();
  });

  it('consulta a RPC com período, tenant, fuso e sessão', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          date: '2026-08-28',
          realized_revenue: '80.00',
          received_total: '80.00',
          by_method: { dinheiro: '0.00', pix: '80.00', cartao: '0.00', outros: '0.00' },
          closed_comandas_count: '1',
          payment_count: '1',
        },
      ],
      error: null,
    });

    const result = await new SupabaseCaixaAdapter().obterResumoFinanceiroDiario({
      tenantId: 'tenant-1',
      startDate: '2026-08-28',
      endDate: '2026-08-28',
      timeZone: 'America/Sao_Paulo',
      cashSessionId: 'session-1',
    });

    expect(result[0]).toMatchObject({
      date: '2026-08-28',
      realized_revenue: 80,
      received_total: 80,
      closed_comandas_count: 1,
      payment_count: 1,
    });
    expect(mockRpc).toHaveBeenCalledWith('get_daily_financial_summary', {
      p_start_date: '2026-08-28',
      p_end_date: '2026-08-28',
      p_time_zone: 'America/Sao_Paulo',
      p_tenant_id: 'tenant-1',
      p_cash_session_id: 'session-1',
    });
  });

  it('fecha a sessão por uma única RPC transacional', async () => {
    mockRpc.mockClear();
    mockRpc.mockResolvedValueOnce({
      data: {
        id: 'session-1',
        tenant_id: 'tenant-1',
        status: 'closed',
        initial_amount: 100,
        closing_amount: 370,
        expected_amount: 370,
        difference_amount: 0,
      },
      error: null,
    });

    await expect(new SupabaseCaixaAdapter().fecharCaixa({
      session_id: 'session-1',
      tenant_id: 'tenant-1',
      closed_by: 'user-1',
      closing_amount: 370,
      notes: 'Conferência',
    })).resolves.toMatchObject({
      id: 'session-1',
      status: 'closed',
      expected_amount: 370,
      difference_amount: 0,
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('close_cash_session', {
      p_session_id: 'session-1',
      p_tenant_id: 'tenant-1',
      p_closing_amount: 370,
      p_notes: 'Conferência',
    });
  });

  it('reabre a sessao de caixa chamando reopen_cash_session', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { id: 'session-1', status: 'open', closing_amount: null },
      error: null,
    });

    await expect(new SupabaseCaixaAdapter().reabrirCaixa({
      session_id: 'session-1',
      tenant_id: 'tenant-1',
      reason: 'Contagem incorreta na conferencia',
    })).resolves.toMatchObject({ id: 'session-1', status: 'open' });

    expect(mockRpc).toHaveBeenCalledWith('reopen_cash_session', {
      p_session_id: 'session-1',
      p_tenant_id: 'tenant-1',
      p_reason: 'Contagem incorreta na conferencia',
    });
  });

  it('traduz erro do banco em erro de dominio ao reabrir sessao de caixa', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Ja existe uma sessao de caixa aberta para esta unidade.' },
    });

    await expect(new SupabaseCaixaAdapter().reabrirCaixa({
      session_id: 'session-1',
      tenant_id: 'tenant-1',
      reason: 'Contagem incorreta na conferencia',
    })).rejects.toThrow(/Ja existe uma sessao de caixa aberta/);
  });

  it('registra um ajuste posterior chamando register_cash_session_adjustment', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        adjustment_id: 'adj-1',
        cash_session_id: 'session-1',
        original_expected_amount: 150,
        original_closing_amount: 150,
        original_difference_amount: 0,
        previous_adjustment_amount: 0,
        adjusted_closing_amount: 155,
        adjusted_difference_amount: 5,
      },
      error: null,
    });

    const result = await new SupabaseCaixaAdapter().registrarAjuste({
      session_id: 'session-1',
      tenant_id: 'tenant-1',
      adjustment_amount: 5,
      reason: 'Diferenca encontrada na conferencia',
    });

    expect(mockRpc).toHaveBeenCalledWith('register_cash_session_adjustment', {
      p_session_id: 'session-1',
      p_tenant_id: 'tenant-1',
      p_adjustment_amount: 5,
      p_reason: 'Diferenca encontrada na conferencia',
    });
    expect(result.adjustment_id).toBe('adj-1');
  });

  it('traduz erro do banco em erro de dominio ao registrar ajuste', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'A sessao de caixa precisa estar fechada.' },
    });

    await expect(new SupabaseCaixaAdapter().registrarAjuste({
      session_id: 'session-1',
      tenant_id: 'tenant-1',
      adjustment_amount: 5,
      reason: 'Diferenca encontrada na conferencia',
    })).rejects.toThrow(/precisa estar fechada/);
  });

  it('consulta o extrato chamando get_cash_session_statement', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        session: { id: 'session-1', status: 'closed' },
        adjustments: [],
        adjusted_difference_amount: 0,
        movements: [],
        reopenings: [],
      },
      error: null,
    });

    const statement = await new SupabaseCaixaAdapter().obterExtrato('session-1', 'tenant-1');

    expect(mockRpc).toHaveBeenCalledWith('get_cash_session_statement', {
      p_session_id: 'session-1',
      p_tenant_id: 'tenant-1',
    });
    expect(statement.session.id).toBe('session-1');
  });

  it('traduz erro do banco em erro de dominio ao consultar o extrato', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Acesso negado para a unidade solicitada.' },
    });

    await expect(new SupabaseCaixaAdapter().obterExtrato('session-1', 'tenant-1'))
      .rejects.toThrow(/Acesso negado/);
  });

  it('apura o valor esperado da gaveta chamando get_cash_session_expected_amount', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        session_id: 'session-1',
        tenant_id: 'tenant-1',
        initial_amount: '100.00',
        cash_received: '250.00',
        inflow_amount: '0.00',
        outflow_amount: '80.00',
        expected_amount: '270.00',
        movements_by_type: [
          { type: 'repasse_comissao', direction: 'saida', amount: '50.00' },
          { type: 'vale_profissional', direction: 'saida', amount: '30.00' },
        ],
      },
      error: null,
    });

    const result = await new SupabaseCaixaAdapter().obterValorEsperadoGaveta('session-1', 'tenant-1');

    expect(mockRpc).toHaveBeenCalledWith('get_cash_session_expected_amount', {
      p_session_id: 'session-1',
      p_tenant_id: 'tenant-1',
    });
    expect(result).toEqual({
      session_id: 'session-1',
      tenant_id: 'tenant-1',
      initial_amount: 100,
      cash_received: 250,
      inflow_amount: 0,
      outflow_amount: 80,
      expected_amount: 270,
      movements_by_type: [
        { type: 'repasse_comissao', direction: 'saida', amount: 50 },
        { type: 'vale_profissional', direction: 'saida', amount: 30 },
      ],
    });
  });

  it('traduz erro do banco em erro de dominio ao apurar o valor esperado da gaveta', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'A sessão de caixa não está aberta ou não existe.' },
    });

    await expect(new SupabaseCaixaAdapter().obterValorEsperadoGaveta('session-1', 'tenant-1'))
      .rejects.toThrow(/não está aberta/);
  });

  describe('registrarMovimentoManual (ticket 03/036)', () => {
    it('chama register_cash_movement sem enviar autor', async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          id: 'mov-1',
          tenant_id: 'tenant-1',
          cash_session_id: 'session-1',
          type: 'sangria',
          amount: 50,
          reason: 'Pagamento de água',
          performed_by: 'user-autenticado',
          created_at: '2026-09-13T10:00:00Z',
        },
        error: null,
      });

      const result = await new SupabaseCaixaAdapter().registrarMovimentoManual({
        tenant_id: 'tenant-1',
        cash_session_id: 'session-1',
        type: 'sangria',
        amount: 50,
        reason: 'Pagamento de água',
      });

      expect(mockRpc).toHaveBeenCalledWith('register_cash_movement', {
        p_cash_session_id: 'session-1',
        p_tenant_id: 'tenant-1',
        p_type: 'sangria',
        p_amount: 50,
        p_reason: 'Pagamento de água',
      });
      // Autor nunca sai do navegador: nao existe p_performed_by nem
      // qualquer chave de autor no payload enviado a RPC.
      const payload = mockRpc.mock.calls[0][1];
      expect(payload).not.toHaveProperty('p_performed_by');
      expect(result).toMatchObject({ id: 'mov-1', type: 'sangria', amount: 50 });
    });

    it('traduz erro de saldo insuficiente em erro de dominio', async () => {
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'O valor da sangria excede o saldo disponível na gaveta do turno.' },
      });

      await expect(new SupabaseCaixaAdapter().registrarMovimentoManual({
        tenant_id: 'tenant-1',
        cash_session_id: 'session-1',
        type: 'sangria',
        amount: 999,
        reason: 'Acima do saldo',
      })).rejects.toThrow(/excede o saldo disponível na gaveta/);
    });
  });
});
