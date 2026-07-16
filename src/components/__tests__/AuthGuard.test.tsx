import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../AuthGuard';

const {
  mockAddToast,
  mockGetSession,
  mockNavigate,
  mockProfileSingle,
  mockSignOut,
  mockSubscriptionResult,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockGetSession = vi.fn();
  const mockNavigate = vi.fn();
  const mockProfileSingle = vi.fn();
  const mockSignOut = vi.fn();
  const mockSubscriptionResult = vi.fn();

  return {
    mockAddToast,
    mockGetSession,
    mockNavigate,
    mockProfileSingle,
    mockSignOut,
    mockSubscriptionResult,
    mockSupabaseClient: {
      auth: {
        getSession: mockGetSession,
        signOut: mockSignOut,
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(),
    },
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

const createSubscriptionBuilder = () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: vi.fn((onFulfilled) =>
      Promise.resolve(onFulfilled(mockSubscriptionResult()))),
  };
  return builder;
};

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockSubscriptionResult.mockReturnValue({ data: [], error: null });
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({ single: mockProfileSingle }),
          }),
        };
      }
      if (table === 'tenant_subscriptions') {
        return createSubscriptionBuilder();
      }
      throw new Error(`Tabela inesperada: ${table}`);
    });
  });

  it('nega e encerra a sessao de usuario de tenant suspenso', async () => {
    mockProfileSingle.mockResolvedValue({
      data: { role: 'gerente', is_active: true, tenant_id: 'tenant-1' },
      error: null,
    });
    mockSubscriptionResult.mockReturnValue({
      data: [{ status: 'suspended' }],
      error: null,
    });

    render(
      <AuthGuard allowedRole="gerente">
        <div>Area protegida</div>
      </AuthGuard>,
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    expect(screen.queryByText('Area protegida')).not.toBeInTheDocument();
    expect(mockAddToast).toHaveBeenCalledWith(expect.stringMatching(/suspens/i), 'error');
  });

  it('nao exige assinatura de proprietario do SaaS', async () => {
    mockProfileSingle.mockResolvedValue({
      data: { role: 'proprietario', is_active: true, tenant_id: null },
      error: null,
    });

    render(
      <AuthGuard allowedRole="proprietario">
        <div>Area do proprietario</div>
      </AuthGuard>,
    );

    expect(await screen.findByText('Area do proprietario')).toBeInTheDocument();
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('tenant_subscriptions');
  });
});
