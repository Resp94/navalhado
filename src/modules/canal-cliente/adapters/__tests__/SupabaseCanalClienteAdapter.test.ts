import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseCanalClienteAdapter } from '../SupabaseCanalClienteAdapter';
import { AgendamentoConflitoError, AgendamentoOnlineIndisponivelError } from '../../errors';

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
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('descarta a sessão pública quando o refresh token armazenado ficou inválido', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: {
        code: 'refresh_token_not_found',
        message: 'Invalid Refresh Token: Refresh Token Not Found',
      },
    });
    mockSignOut.mockResolvedValue({ error: null });

    const adapter = new SupabaseCanalClienteAdapter();

    await expect(adapter.obterPerfilPublicoSessao()).resolves.toBeNull();
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('não mantém o logout bloqueado quando o Supabase não responde', async () => {
    vi.useFakeTimers();
    mockSignOut.mockReturnValue(new Promise(() => {}));

    try {
      const logoutPromise = new SupabaseCanalClienteAdapter().encerrarSessaoPublica();
      const result = expect(logoutPromise).rejects.toThrow('PUBLIC_SESSION_OPERATION_TIMEOUT');

      await vi.advanceTimersByTimeAsync(1500);
      await result;
    } finally {
      vi.useRealTimers();
    }
  });
});

// Spec 052, ticket 04: barbearia bloqueada por assinatura. O servidor recusa criar e
// reagendar com ONLINE_BOOKING_UNAVAILABLE. A mensagem contem "indisponível", que os
// mapeamentos antigos liam como conflito de horário: a recusa por bloqueio vem primeiro.
describe('SupabaseCanalClienteAdapter - agendamento online indisponível', () => {
  const recusaPorBloqueio = {
    code: '55000',
    message: 'ONLINE_BOOKING_UNAVAILABLE: Agendamento online indisponível no momento. Entre em contato diretamente com o estabelecimento.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('consultarDisponibilidadeAgendamento', () => {
    it('pergunta ao banco pelo slug, sem precisar de login', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      await new SupabaseCanalClienteAdapter().consultarDisponibilidadeAgendamento('brooklyn');

      expect(mockRpc).toHaveBeenCalledWith('get_public_booking_availability', { p_slug: 'brooklyn' });
    });

    it.each([true, false])('devolve %s como o banco respondeu', async (resposta) => {
      mockRpc.mockResolvedValue({ data: resposta, error: null });

      await expect(new SupabaseCanalClienteAdapter().consultarDisponibilidadeAgendamento('brooklyn')).resolves.toBe(resposta);
    });

    it('slug que o banco não conhece volta como nulo', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      await expect(new SupabaseCanalClienteAdapter().consultarDisponibilidadeAgendamento('nao-existe')).resolves.toBeNull();
    });

    it('erro do banco vira exceção', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'sem rede' } });

      await expect(new SupabaseCanalClienteAdapter().consultarDisponibilidadeAgendamento('brooklyn')).rejects.toThrow('sem rede');
    });
  });

  describe('a recusa por bloqueio vira AgendamentoOnlineIndisponivelError, e não conflito de horário', () => {
    it('ao confirmar pelo slug', async () => {
      mockRpc.mockResolvedValue({ data: null, error: recusaPorBloqueio });

      await expect(
        new SupabaseCanalClienteAdapter().confirmarAgendamentoPublico({
          slug: 'brooklyn',
          serviceId: 'servico-1',
          professionalId: null,
          date: '2040-01-02',
          slot: '09:00',
          name: 'Maria Silva',
          phone: '92999990000',
        }),
      ).rejects.toBeInstanceOf(AgendamentoOnlineIndisponivelError);
    });

    it('ao criar com o token', async () => {
      mockRpc.mockResolvedValue({ data: null, error: recusaPorBloqueio });

      await expect(
        new SupabaseCanalClienteAdapter().criarAgendamentoPorToken('token-1', {
          serviceId: 'servico-1',
          professionalId: null,
          startTime: '2040-01-02T09:00:00',
        }),
      ).rejects.toBeInstanceOf(AgendamentoOnlineIndisponivelError);
    });

    it('ao reagendar com o token', async () => {
      mockRpc.mockResolvedValue({ data: null, error: recusaPorBloqueio });

      await expect(
        new SupabaseCanalClienteAdapter().reagendarAgendamentoPorToken('token-1', {
          appointmentId: 'agendamento-1',
          newServiceId: 'servico-1',
          newDate: '2040-01-02',
          newSlot: '09:00',
        }),
      ).rejects.toBeInstanceOf(AgendamentoOnlineIndisponivelError);
    });

    it('ao reagendar pela sessão pública', async () => {
      mockRpc.mockResolvedValue({ data: null, error: recusaPorBloqueio });

      await expect(
        new SupabaseCanalClienteAdapter().reagendarAgendamentoPublicoSessao({
          appointmentId: 'agendamento-1',
          newServiceId: 'servico-1',
          newDate: '2040-01-02',
          newSlot: '09:00',
        }),
      ).rejects.toBeInstanceOf(AgendamentoOnlineIndisponivelError);
    });

    it('um conflito de horário de verdade continua sendo conflito', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

      await expect(
        new SupabaseCanalClienteAdapter().criarAgendamentoPorToken('token-1', {
          serviceId: 'servico-1',
          professionalId: null,
          startTime: '2040-01-02T09:00:00',
        }),
      ).rejects.toBeInstanceOf(AgendamentoConflitoError);
    });
  });
});
