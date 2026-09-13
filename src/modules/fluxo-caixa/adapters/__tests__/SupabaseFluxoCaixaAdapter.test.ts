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
        buckets: [
          {
            start_date: '2026-06-10',
            end_date: '2026-06-10',
            kind: 'current',
            inflow_realized: '150.50',
            pending_flow: '0.00',
            detail: {
              inflow_by_method: { dinheiro: '30.00', pix: '100.50', cartao: '20.00', outros: '0.00' },
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
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]).toEqual({
      start_date: '2026-06-10',
      end_date: '2026-06-10',
      kind: 'current',
      inflow_realized: 150.5,
      pending_flow: 0,
      detail: {
        inflow_by_method: { dinheiro: 30, pix: 100.5, cartao: 20, outros: 0 },
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

    expect(result.buckets[0]).toEqual({
      start_date: '2026-06-10',
      end_date: '2026-06-10',
      kind: 'current',
      inflow_realized: 0,
      pending_flow: 0,
      detail: {
        inflow_by_method: { dinheiro: 0, pix: 0, cartao: 0, outros: 0 },
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
