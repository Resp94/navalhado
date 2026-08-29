import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseCanalClienteAdapter } from '../SupabaseCanalClienteAdapter';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

describe('SupabaseCanalClienteAdapter - reagendamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envia o nome do parâmetro aceito pela RPC publicada', async () => {
    mockRpc.mockImplementation(async (_name: string, params: Record<string, unknown>) => {
      if ('p_appointment_id' in params) {
        return { data: 'appointment-1', error: null };
      }

      return {
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function with the provided parameters',
        },
      };
    });

    const adapter = new SupabaseCanalClienteAdapter();

    await expect(
      adapter.reagendarAgendamentoPorToken('token-1', {
        appointmentId: 'appointment-1',
        newServiceId: 'service-1',
        newProfessionalId: 'professional-1',
        newDate: '2026-08-29',
        newSlot: '13:00',
        newStartTime: '2026-08-29T13:00:00',
      }),
    ).resolves.toBeUndefined();

    expect(mockRpc).toHaveBeenCalledWith('reschedule_appointment_by_token', {
      p_token: 'token-1',
      p_appointment_id: 'appointment-1',
      p_new_service_id: 'service-1',
      p_new_professional_id: 'professional-1',
      p_new_date: '2026-08-29',
      p_new_slot: '13:00',
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});
