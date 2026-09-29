import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../AuthGuard';

const {
  mockAddToast,
  mockGetSession,
  mockNavigate,
  mockProfileSingle,
  mockSignOut,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockGetSession = vi.fn();
  const mockNavigate = vi.fn();
  const mockProfileSingle = vi.fn();
  const mockSignOut = vi.fn();

  return {
    mockAddToast,
    mockGetSession,
    mockNavigate,
    mockProfileSingle,
    mockSignOut,
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

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    // Só a tabela users existe aqui: qualquer outra consulta derruba o teste.
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({ single: mockProfileSingle }),
          }),
        };
      }
      throw new Error(`Tabela inesperada: ${table}`);
    });
  });

  // Spec 052, ticket 03: o bloqueio por assinatura saiu daqui. Quem decide é o porteiro dos
  // layouts, que lê o Estado de Acesso e mostra a tela de bloqueio. O usuário de uma barbearia
  // bloqueada precisa continuar logado para ver a tela e, no caso do Gerente, exportar os dados.
  it('nao encerra a sessao nem consulta a assinatura de usuario de tenant', async () => {
    mockProfileSingle.mockResolvedValue({
      data: { role: 'gerente', is_active: true, tenant_id: 'tenant-1' },
      error: null,
    });

    render(
      <AuthGuard allowedRole="gerente">
        <div>Area protegida</div>
      </AuthGuard>,
    );

    expect(await screen.findByText('Area protegida')).toBeInTheDocument();
    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('tenant_subscriptions');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('continua encerrando a sessao de conta desativada pelo administrador', async () => {
    mockProfileSingle.mockResolvedValue({
      data: { role: 'gerente', is_active: false, tenant_id: 'tenant-1' },
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
    expect(mockAddToast).toHaveBeenCalledWith('Esta conta foi desativada pelo administrador.', 'error');
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
