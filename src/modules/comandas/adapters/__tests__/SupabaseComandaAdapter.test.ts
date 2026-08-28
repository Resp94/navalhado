import { describe, expect, it, vi } from 'vitest';
import { SupabaseComandaAdapter } from '../SupabaseComandaAdapter';

const { mockLimit, mockMaybeSingle } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: mockLimit,
      maybeSingle: mockMaybeSingle,
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

  it('faz preflight e bloqueia liquidação de comanda de no-show antes de alterar itens', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { appointment: { status: 'no_show' } },
      error: null,
    });

    await expect(
      new SupabaseComandaAdapter().liquidarComanda({
        comanda_id: 'comanda-no-show',
        tenant_id: 'tenant-1',
        pagamentos: [{ payment_method: 'pix', amount: 40 }],
      })
    ).rejects.toThrow('não comparecido');
  });
});
