import { describe, expect, it, vi } from 'vitest';
import { SupabaseContaProfissionalAdapter } from '../SupabaseContaProfissionalAdapter';

const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}));

describe('SupabaseContaProfissionalAdapter', () => {
  it('lança o vale chamando register_professional_advance com o contrato atual', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        entry_id: 'entry-1',
        professional_id: 'prof-1',
        amount: 30,
        cash_movement_id: 'mov-1',
        cash_session_id: 'sess-1',
      },
      error: null,
    });

    const result = await new SupabaseContaProfissionalAdapter().registrarVale({
      professional_id: 'prof-1',
      amount: 30,
      reason: 'Adiantamento para o corte de cabelo',
      payment_method: 'cash',
      tenant_id: 'tenant-1',
      cash_session_id: 'sess-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('register_professional_advance', {
      p_professional_id: 'prof-1',
      p_amount: 30,
      p_reason: 'Adiantamento para o corte de cabelo',
      p_payment_method: 'cash',
      p_tenant_id: 'tenant-1',
      p_cash_session_id: 'sess-1',
    });
    expect(result.entry_id).toBe('entry-1');
  });

  it('traduz erro do banco em erro de domínio ao lançar vale', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.' },
    });

    await expect(
      new SupabaseContaProfissionalAdapter().registrarVale({
        professional_id: 'prof-1',
        amount: 999,
        reason: 'Adiantamento alto demais',
        payment_method: 'cash',
        cash_session_id: 'sess-1',
      })
    ).rejects.toThrow('O valor do vale em dinheiro excede o saldo disponivel na gaveta do turno.');
  });

  it('estorna o vale chamando reverse_professional_advance com o contrato atual', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { reversed: true, reversed_at: '2026-09-12T00:00:00.000Z' },
      error: null,
    });

    const result = await new SupabaseContaProfissionalAdapter().estornarVale({
      entry_id: 'entry-1',
      tenant_id: 'tenant-1',
      reason: 'Lançado por engano',
    });

    expect(mockRpc).toHaveBeenCalledWith('reverse_professional_advance', {
      p_entry_id: 'entry-1',
      p_tenant_id: 'tenant-1',
      p_reason: 'Lançado por engano',
    });
    expect(result.reversed).toBe(true);
  });

  it('traduz erro do banco em erro de domínio ao estornar vale', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Este vale ja foi estornado.' },
    });

    await expect(
      new SupabaseContaProfissionalAdapter().estornarVale({
        entry_id: 'entry-1',
        reason: 'Tentativa duplicada',
      })
    ).rejects.toThrow('Este vale ja foi estornado.');
  });

  it('lista os lançamentos do profissional filtrando por profissional e unidade', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'entry-1',
          tenant_id: 'tenant-1',
          professional_id: 'prof-1',
          entry_type: 'vale',
          direction: 'debit',
          amount: 30,
          settled_amount: 0,
          status: 'open',
          reason: 'Adiantamento',
          comanda_id: null,
          cash_movement_id: 'mov-1',
          created_by: 'user-1',
          created_at: '2026-09-12T10:00:00Z',
          reversed_at: null,
          reversed_by: null,
          reversal_reason: null,
        },
      ],
      error: null,
    });
    const eqTenant = vi.fn().mockReturnValue({ order });
    const eqProf = vi.fn().mockReturnValue({ eq: eqTenant });
    const select = vi.fn().mockReturnValue({ eq: eqProf });
    mockFrom.mockReturnValue({ select });

    const result = await new SupabaseContaProfissionalAdapter().listarLancamentos('prof-1', 'tenant-1');

    expect(mockFrom).toHaveBeenCalledWith('professional_account_entries');
    expect(eqProf).toHaveBeenCalledWith('professional_id', 'prof-1');
    expect(eqTenant).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(result).toHaveLength(1);
  });

  it('traduz erro do banco em erro de domínio ao listar lançamentos', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'Acesso negado.' } });
    const eqTenant = vi.fn().mockReturnValue({ order });
    const eqProf = vi.fn().mockReturnValue({ eq: eqTenant });
    const select = vi.fn().mockReturnValue({ eq: eqProf });
    mockFrom.mockReturnValue({ select });

    await expect(
      new SupabaseContaProfissionalAdapter().listarLancamentos('prof-1', 'tenant-1')
    ).rejects.toThrow('Acesso negado.');
  });
});
