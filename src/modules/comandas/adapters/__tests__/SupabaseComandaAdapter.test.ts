import { describe, expect, it, vi } from 'vitest';
import { SupabaseComandaAdapter } from '../SupabaseComandaAdapter';

const { mockLimit, mockRpc } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
    })),
  },
}));

describe('SupabaseComandaAdapter', () => {
  it('normaliza relação appointment to-one retornada como objeto ou array', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [
        {
          id: 'c-fitting',
          tenant_id: 'tenant-1',
          appointment_id: 'app-fitting',
          status: 'aberta',
          total_amount: 40,
          discount_amount: 0,
          tip_amount: 0,
          appointment: [{
            id: 'app-fitting',
            start_time: '2026-08-28T14:00:00.000Z',
            is_fitting: true,
            service: { id: 'service-1', name: 'Corte' },
            professional: { id: 'prof-1', name: 'Carlos' },
          }],
        },
        {
          id: 'c-normal',
          tenant_id: 'tenant-1',
          appointment_id: 'app-normal',
          status: 'fechada',
          total_amount: 50,
          discount_amount: 0,
          tip_amount: 0,
          appointment: {
            id: 'app-normal',
            start_time: '2026-08-28T15:00:00.000Z',
            is_fitting: false,
            service: { id: 'service-2', name: 'Barba' },
            professional: { id: 'prof-2', name: 'Diego' },
          },
        },
        {
          id: 'c-counter',
          tenant_id: 'tenant-1',
          appointment_id: null,
          status: 'cancelada',
          total_amount: 20,
          discount_amount: 0,
          tip_amount: 0,
          appointment: null,
        },
      ],
      error: null,
    });

    const result = await new SupabaseComandaAdapter().listarTodas('tenant-1');

    expect(result.map((comanda) => comanda.appointment_is_fitting)).toEqual([true, false, null]);
    expect(result[0]).toMatchObject({
      customer_name: 'Cliente Agendado',
      appointment_service_name: 'Corte',
      professional_name: 'Carlos',
    });
    expect(result[2]).toMatchObject({
      customer_name: 'Cliente Balcão',
      appointment_start_time: null,
    });
  });

  it('finaliza comanda por uma única RPC transacional', async () => {
    const input = {
      comanda_id: null,
      tenant_id: 'tenant-1',
      appointment_id: 'appointment-1',
      customer_id: 'customer-1',
      discount_amount: 5,
      tip_amount: 2,
      cash_session_id: 'session-1',
      itens: [{ item_type: 'servico' as const, service_id: 'service-1', quantity: 1, unit_price: 50 }],
      pagamentos: [{ payment_method: 'pix' as const, amount: 47 }],
    };
    mockRpc.mockResolvedValueOnce({
      data: { id: 'comanda-1', status: 'fechada' },
      error: null,
    });

    await expect(new SupabaseComandaAdapter().liquidarComanda(input)).resolves.toMatchObject({
      id: 'comanda-1',
      status: 'fechada',
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('settle_comanda', {
      p_comanda_id: null,
      p_tenant_id: 'tenant-1',
      p_appointment_id: 'appointment-1',
      p_customer_id: 'customer-1',
      p_discount_amount: 5,
      p_tip_amount: 2,
      p_cash_session_id: 'session-1',
      p_itens: input.itens,
      p_pagamentos: input.pagamentos,
    });
  });
});
