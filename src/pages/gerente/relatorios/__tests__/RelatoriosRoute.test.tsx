import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../../../../components/AuthGuard';

/**
 * Rota `/relatorios` (spec 038): fica atrás do mesmo `AuthGuard
 * allowedRole="gerente"` que já protege `/financeiro` em `App.tsx` -- não
 * há checagem própria do módulo. Este teste mira essa garantia genérica
 * no caso concreto do barbeiro tentando acessar a área de relatórios:
 * o `AuthGuard` nunca renderiza o conteúdo protegido para outro papel.
 * Mesma estrutura de mock de `src/components/__tests__/AuthGuard.test.tsx`.
 */
const {
  mockAddToast,
  mockGetSession,
  mockNavigate,
  mockProfileSingle,
  mockSubscriptionResult,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockGetSession = vi.fn();
  const mockNavigate = vi.fn();
  const mockProfileSingle = vi.fn();
  const mockSubscriptionResult = vi.fn();

  return {
    mockAddToast,
    mockGetSession,
    mockNavigate,
    mockProfileSingle,
    mockSubscriptionResult,
    mockSupabaseClient: {
      auth: {
        getSession: mockGetSession,
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
      },
      from: vi.fn(),
    },
  };
});

const createSubscriptionBuilder = () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: vi.fn((onFulfilled) => Promise.resolve(onFulfilled(mockSubscriptionResult()))),
  };
  return builder;
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Rota /relatorios — guarda de acesso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
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

  it('barbeiro não alcança o Módulo de Relatórios: é redirecionado, conteúdo nunca aparece', async () => {
    mockProfileSingle.mockResolvedValue({
      data: { role: 'barbeiro', is_active: true, tenant_id: 'tenant-1' },
      error: null,
    });

    render(
      <AuthGuard allowedRole="gerente">
        <div>Módulo de Relatórios</div>
      </AuthGuard>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/minha-agenda');
    });

    expect(screen.queryByText('Módulo de Relatórios')).not.toBeInTheDocument();
  });

  it('gerente do próprio tenant alcança o conteúdo protegido', async () => {
    mockProfileSingle.mockResolvedValue({
      data: { role: 'gerente', is_active: true, tenant_id: 'tenant-1' },
      error: null,
    });

    render(
      <AuthGuard allowedRole="gerente">
        <div>Módulo de Relatórios</div>
      </AuthGuard>
    );

    expect(await screen.findByText('Módulo de Relatórios')).toBeInTheDocument();
  });
});
