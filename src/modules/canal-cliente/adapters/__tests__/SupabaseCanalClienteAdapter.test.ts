import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseCanalClienteAdapter } from '../SupabaseCanalClienteAdapter';

const { mockRpc, mockGetSession, mockSignInAnonymously, mockInvoke, mockSetSession, mockSignOut } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockGetSession: vi.fn(),
  mockSignInAnonymously: vi.fn(),
  mockInvoke: vi.fn(),
  mockSetSession: vi.fn(),
  mockSignOut: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
  },
  publicSupabase: {
    rpc: mockRpc,
    auth: {
      getSession: mockGetSession,
      signInAnonymously: mockSignInAnonymously,
      setSession: mockSetSession,
      signOut: mockSignOut,
    },
    functions: {
      invoke: mockInvoke,
    },
  },
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

  it('inicia sessão pública pelo endpoint protegido e vincula o cliente ao tenant sem receber token de cliente', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockInvoke.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token-1',
          refresh_token: 'refresh-token-1',
          user: { id: 'auth-user-1', is_anonymous: true },
        },
        profile: {
          found: true,
          customer_id: 'customer-1',
          customer_name: 'Jonathas Teste',
          customer_phone: '92999999999',
          cadastro_completo: true,
          tenant_id: 'tenant-1',
          tenant_name: 'Barbearia Teste',
          tenant_phone: '92999999998',
          tenant_slug: 'barbearia-teste',
          tenant_timezone: 'America/Manaus',
          business_hours: {},
          min_cancellation_lead_time_minutes: 60,
          min_booking_lead_time_minutes: 30,
          slot_interval_minutes: 40,
        },
      },
      error: null,
    });
    mockSetSession.mockResolvedValue({ data: { session: null }, error: null });

    const adapter = new SupabaseCanalClienteAdapter();
    const result = await adapter.iniciarSessaoPublica(
      'barbearia-teste',
      'Jonathas Teste',
      '92999999999',
      'turnstile-token-1',
    );

    expect(mockInvoke).toHaveBeenCalledWith('public-customer-session', {
      body: {
        slug: 'barbearia-teste',
        name: 'Jonathas Teste',
        phone: '92999999999',
        captchaToken: 'turnstile-token-1',
      },
    });
    expect(mockSetSession).toHaveBeenCalledWith(expect.objectContaining({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
    }));
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      found: true,
      customer_id: 'customer-1',
      tenant_slug: 'barbearia-teste',
    });
    expect(result).not.toHaveProperty('token_acesso');
  });

  it('não usa o Auth global diretamente ao iniciar uma sessão pública', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockInvoke.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token-1',
          refresh_token: 'refresh-token-1',
          user: { id: 'auth-user-1', is_anonymous: true },
        },
        profile: [{
          found: true,
          tenant_id: 'tenant-1',
          tenant_name: 'Barbearia Teste',
          tenant_phone: '92999999998',
          tenant_slug: 'barbearia-teste',
        }],
      },
      error: null,
    });
    mockSetSession.mockResolvedValue({ data: { session: null }, error: null });

    const adapter = new SupabaseCanalClienteAdapter();

    await adapter.iniciarSessaoPublica('barbearia-teste', 'Jonathas Teste', '92999999999');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it('encerra a sessão pública pelo Supabase Auth', async () => {
    mockSignOut.mockResolvedValue({ error: null });
    const adapter = new SupabaseCanalClienteAdapter();

    await expect(adapter.encerrarSessaoPublica()).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
