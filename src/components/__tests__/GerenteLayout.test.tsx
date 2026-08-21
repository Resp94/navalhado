import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GerenteLayout } from '../GerenteLayout';

const { mockAddToast, mockNavigate, mockUseLocation } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseLocation: vi.fn().mockReturnValue({ pathname: '/agenda' }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockUseLocation(),
    Outlet: ({ context }: any) => <div data-testid="outlet" data-context={JSON.stringify(context)}>Conteúdo Outlet</div>,
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

vi.mock('../Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../lib/useRealtimeNotifications', () => ({
  useRealtimeNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAllAsRead: vi.fn(),
    markAsRead: vi.fn(),
  }),
}));

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  },
}));

describe('GerenteLayout Gatekeeper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'gerente@test.local' } },
      error: null,
    });
  });

  it('redireciona para /onboarding quando onboarding_completed for false e rota for /agenda', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/agenda' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jonathas', tenant_id: 'tenant-123', role: 'gerente' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'tenant-123',
                  name: 'Barbearia Navalhado',
                  logo_url: null,
                  timezone: 'America/Sao_Paulo',
                  onboarding_completed: false,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<GerenteLayout />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
    });
  });

  it('redireciona para /agenda quando onboarding_completed for true e usuário tentar acessar /onboarding', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/onboarding' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jonathas', tenant_id: 'tenant-123', role: 'gerente' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'tenant-123',
                  name: 'Barbearia Navalhado',
                  logo_url: null,
                  timezone: 'America/Sao_Paulo',
                  onboarding_completed: true,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<GerenteLayout />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/agenda');
    });
  });

  it('renderiza o painel normalmente quando onboarding_completed for true em rota /agenda', async () => {
    mockUseLocation.mockReturnValue({ pathname: '/agenda' });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: { name: 'Jonathas', tenant_id: 'tenant-123', role: 'gerente' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'tenant-123',
                  name: 'Barbearia Navalhado',
                  logo_url: null,
                  timezone: 'America/Sao_Paulo',
                  onboarding_completed: true,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<GerenteLayout />);

    await waitFor(() => {
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/onboarding');
  });
});
