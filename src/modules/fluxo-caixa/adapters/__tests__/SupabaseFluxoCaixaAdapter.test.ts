import { describe, expect, it, vi } from 'vitest';
import { SupabaseFluxoCaixaAdapter } from '../SupabaseFluxoCaixaAdapter';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

describe('SupabaseFluxoCaixaAdapter', () => {
  it('chama get_projected_cash_flow com o contrato atual e converte números', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        timezone: 'America/Sao_Paulo',
        business_today: '2026-06-10',
        estimate: {
          status: 'ok',
          weeks_used: 8,
          weekday_averages: { mon: '10.00', tue: '20.00', wed: '0.00', thu: '0.00', fri: '0.00', sat: '50.00', sun: '0.00' },
        },
        undated_commitments: {
          commission_open: '150.00',
          tips_open: '20.00',
          advances_open: '10.00',
          net_due: '160.00',
        },
        buckets: [
          {
            start_date: '2026-06-10',
            end_date: '2026-06-10',
            kind: 'current',
            inflow_realized: '150.50',
            inflow_estimated: '25.00',
            outflow_realized: '90.00',
            outflow_forecast: '45.00',
            outflow_overdue: '15.00',
            pending_flow: '0.00',
            detail: {
              inflow_by_method: { dinheiro: '30.00', pix: '100.50', cartao: '20.00', outros: '0.00' },
              payouts_by_professional: [
                { professional_id: 'prof-1', professional_name: 'Ana', amount: '60.00' },
              ],
              advances_by_professional: [
                { professional_id: 'prof-2', professional_name: 'Bruno', amount: '30.00' },
              ],
              payables_forecast: [
                { payable_id: 'pay-1', description: 'Aluguel', remaining_amount: '45.00', due_date: '2026-06-10', overdue: false },
                { payable_id: 'pay-2', description: 'Água', remaining_amount: '15.00', due_date: '2026-06-01', overdue: true },
              ],
              settlements_by_category: [
                { category_id: 'cat-1', category_name: 'Produtos para revenda', amount: '90.00' },
              ],
              estimated_days: 5,
              closed_days: 2,
            },
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseFluxoCaixaAdapter().obterFluxoCaixaProjetado({
      tenantId: 'tenant-1',
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      granularity: 'day',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_projected_cash_flow', {
      p_tenant_id: 'tenant-1',
      p_start_date: '2026-06-10',
      p_end_date: '2026-06-10',
      p_granularity: 'day',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.business_today).toBe('2026-06-10');
    expect(result.estimate).toEqual({
      status: 'ok',
      weeks_used: 8,
      weekday_averages: { mon: 10, tue: 20, wed: 0, thu: 0, fri: 0, sat: 50, sun: 0 },
    });
    expect(result.undated_commitments).toEqual({
      commission_open: 150,
      tips_open: 20,
      advances_open: 10,
      net_due: 160,
    });
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]).toEqual({
      start_date: '2026-06-10',
      end_date: '2026-06-10',
      kind: 'current',
      inflow_realized: 150.5,
      inflow_estimated: 25,
      outflow_realized: 90,
      outflow_forecast: 45,
      outflow_overdue: 15,
      pending_flow: 0,
      detail: {
        inflow_by_method: { dinheiro: 30, pix: 100.5, cartao: 20, outros: 0 },
        payouts_by_professional: [{ professional_id: 'prof-1', professional_name: 'Ana', amount: 60 }],
        advances_by_professional: [{ professional_id: 'prof-2', professional_name: 'Bruno', amount: 30 }],
        payables_forecast: [
          { payable_id: 'pay-1', description: 'Aluguel', remaining_amount: 45, due_date: '2026-06-10', overdue: false },
          { payable_id: 'pay-2', description: 'Água', remaining_amount: 15, due_date: '2026-06-01', overdue: true },
        ],
        settlements_by_category: [
          { category_id: 'cat-1', category_name: 'Produtos para revenda', amount: 90 },
        ],
        estimated_days: 5,
        closed_days: 2,
      },
    });
  });

  it('preenche campos ausentes com zero e lista vazia', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        timezone: 'America/Sao_Paulo',
        business_today: '2026-06-10',
        buckets: [{ start_date: '2026-06-10', end_date: '2026-06-10', kind: 'current' }],
      },
      error: null,
    });

    const result = await new SupabaseFluxoCaixaAdapter().obterFluxoCaixaProjetado({
      tenantId: 'tenant-1',
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      granularity: 'day',
    });

    expect(result.estimate).toEqual({
      status: 'insufficient_history',
      weeks_used: 0,
      weekday_averages: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
    });
    expect(result.undated_commitments).toEqual({
      commission_open: 0,
      tips_open: 0,
      advances_open: 0,
      net_due: 0,
    });
    expect(result.buckets[0]).toEqual({
      start_date: '2026-06-10',
      end_date: '2026-06-10',
      kind: 'current',
      inflow_realized: 0,
      inflow_estimated: null,
      outflow_realized: 0,
      outflow_forecast: 0,
      outflow_overdue: 0,
      pending_flow: 0,
      detail: {
        inflow_by_method: { dinheiro: 0, pix: 0, cartao: 0, outros: 0 },
        payouts_by_professional: [],
        advances_by_professional: [],
        payables_forecast: [],
        settlements_by_category: [],
        estimated_days: 0,
        closed_days: 0,
      },
    });
  });

  it('devolve fuso padrão e lista vazia quando o retorno inteiro vem ausente', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const result = await new SupabaseFluxoCaixaAdapter().obterFluxoCaixaProjetado({
      tenantId: 'tenant-1',
      startDate: '2026-06-10',
      endDate: '2026-06-10',
      granularity: 'day',
    });

    expect(result).toEqual({
      timezone: 'America/Sao_Paulo',
      business_today: '',
      estimate: {
        status: 'insufficient_history',
        weeks_used: 0,
        weekday_averages: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
      },
      undated_commitments: {
        commission_open: 0,
        tips_open: 0,
        advances_open: 0,
        net_due: 0,
      },
      buckets: [],
    });
  });

  it('traduz erro do banco em erro de domínio', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Acesso negado. Apenas gerentes podem acessar o fluxo de caixa projetado.' },
    });

    await expect(
      new SupabaseFluxoCaixaAdapter().obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2026-06-10',
        endDate: '2026-06-10',
        granularity: 'day',
      })
    ).rejects.toThrow('Acesso negado. Apenas gerentes podem acessar o fluxo de caixa projetado.');
  });
});
