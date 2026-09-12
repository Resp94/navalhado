import { describe, expect, it, vi } from 'vitest';
import { SupabaseComissaoAdapter } from '../SupabaseComissaoAdapter';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

describe('SupabaseComissaoAdapter', () => {
  it('registra a quitação chamando register_commission_payout com o contrato atual', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, payout_id: 'payout-1', amount: 50, professional_id: 'prof-1' },
      error: null,
    });

    const result = await new SupabaseComissaoAdapter().registrarQuitacao({
      professional_id: 'prof-1',
      amount: 50,
      payment_method: 'pix',
      notes: 'Quitação semanal',
      paid_at: '2026-09-11T12:00:00.000Z',
      tenant_id: 'tenant-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('register_commission_payout', {
      p_professional_id: 'prof-1',
      p_amount: 50,
      p_payment_method: 'pix',
      p_notes: 'Quitação semanal',
      p_paid_at: '2026-09-11T12:00:00.000Z',
      p_tenant_id: 'tenant-1',
      p_cash_session_id: null,
    });
    expect(result.payout_id).toBe('payout-1');
  });

  it('encaminha a sessao de caixa quando a quitacao e em dinheiro', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, payout_id: 'payout-2', amount: 30, professional_id: 'prof-1' },
      error: null,
    });

    await new SupabaseComissaoAdapter().registrarQuitacao({
      professional_id: 'prof-1',
      amount: 30,
      payment_method: 'cash',
      tenant_id: 'tenant-1',
      cash_session_id: 'session-1',
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'register_commission_payout',
      expect.objectContaining({ p_cash_session_id: 'session-1' })
    );
  });

  it('traduz erro do banco em erro de domínio ao registrar quitação', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'O valor informado excede o saldo pendente de comissao.' },
    });

    await expect(
      new SupabaseComissaoAdapter().registrarQuitacao({
        professional_id: 'prof-1',
        amount: 999,
        payment_method: 'pix',
      })
    ).rejects.toThrow('O valor informado excede o saldo pendente de comissao.');
  });

  it('consulta o saldo do profissional chamando get_professional_commission_balance', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { current_open_balance: 40, generated_commission: 100, paid_commission: 60 },
      error: null,
    });

    const saldo = await new SupabaseComissaoAdapter().obterSaldoProfissional({
      professional_id: 'prof-1',
      start_date: '2026-09-01T00:00:00.000Z',
      end_date: '2026-09-30T23:59:59.000Z',
      tenant_id: 'tenant-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_professional_commission_balance', {
      p_professional_id: 'prof-1',
      p_start_date: '2026-09-01T00:00:00.000Z',
      p_end_date: '2026-09-30T23:59:59.000Z',
      p_tenant_id: 'tenant-1',
    });
    expect(saldo.current_open_balance).toBe(40);
  });

  it('traduz erro do banco em erro de domínio ao consultar saldo', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Acesso negado para consultar comissoes.' },
    });

    await expect(
      new SupabaseComissaoAdapter().obterSaldoProfissional({ professional_id: 'prof-1' })
    ).rejects.toThrow('Acesso negado para consultar comissoes.');
  });

  it('estorna a quitação chamando reverse_commission_payout com o contrato atual', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { reversed: true, reversed_at: '2026-09-12T00:00:00.000Z' },
      error: null,
    });

    const result = await new SupabaseComissaoAdapter().estornarQuitacao({
      payout_id: 'payout-1',
      tenant_id: 'tenant-1',
      reason: 'Quitação registrada por engano',
    });

    expect(mockRpc).toHaveBeenCalledWith('reverse_commission_payout', {
      p_payout_id: 'payout-1',
      p_tenant_id: 'tenant-1',
      p_reason: 'Quitação registrada por engano',
    });
    expect(result.reversed).toBe(true);
  });

  it('traduz erro do banco em erro de domínio ao estornar quitação', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Esta quitacao ja foi estornada.' },
    });

    await expect(
      new SupabaseComissaoAdapter().estornarQuitacao({
        payout_id: 'payout-1',
        reason: 'Tentativa duplicada',
      })
    ).rejects.toThrow('Esta quitacao ja foi estornada.');
  });
});
