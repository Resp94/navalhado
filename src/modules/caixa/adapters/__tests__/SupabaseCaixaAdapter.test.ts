import { describe, expect, it, vi } from 'vitest';
import { SupabaseCaixaAdapter } from '../SupabaseCaixaAdapter';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

describe('SupabaseCaixaAdapter - resumo financeiro diário', () => {
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
});
