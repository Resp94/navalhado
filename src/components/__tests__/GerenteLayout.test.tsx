import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GerenteLayout } from '../GerenteLayout';

const { mockAddToast, mockNavigate, mockUseLocation, mockRpc } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockUseLocation: vi.fn().mockReturnValue({ pathname: '/agenda' }),
  mockRpc: vi.fn(),
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
    rpc: (...args: unknown[]) => mockRpc(...args),
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
    mockRpc.mockResolvedValue({ data: [{ access: 'allowed', reason: 'active', relevant_date: null }], error: null });
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

  // Spec 052, ticket 03: o porteiro lê o Estado de Acesso ao lado do redirecionamento
  // para o onboarding. O bloqueio do painel é no front; o banco continua entregando os
  // dados do Gerente para ele poder exportá-los.
  describe('porteiro do Estado de Acesso', () => {
    const painelDaBarbearia = (pathname: string, onboardingCompleted = true, search = '', timezone = 'America/Sao_Paulo') => {
      mockUseLocation.mockReturnValue({ pathname, search });
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
                    timezone,
                    onboarding_completed: onboardingCompleted,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });
    };

    const estadoDoBanco = (access: string, reason: string, relevantDate: string | null = null) =>
      mockRpc.mockResolvedValue({ data: [{ access, reason, relevant_date: relevantDate }], error: null });

    it('bloqueado: mostra só a tela de bloqueio, com o motivo e o Pagar', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('blocked', 'trial_expired', '2026-09-29T12:00:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pagar' })).toBeEnabled();
      expect(screen.getByText('Barbearia Navalhado')).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Spec 052, ticket 05: o Mercado Pago devolve o Gerente em /configuracoes?assinatura=retorno.
    // Se o webhook ainda não chegou, a barbearia segue bloqueada e a tela avisa que confirma.
    it('bloqueado, voltando do Mercado Pago: avisa que o pagamento está sendo confirmado', async () => {
      painelDaBarbearia('/configuracoes', true, '?assinatura=retorno');
      estadoDoBanco('blocked', 'trial_expired', '2026-09-29T12:00:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent(/confirmando seu pagamento/i);
    });

    it('bloqueado, voltando do Mercado Pago: "Atualizar situação" relê o estado e libera o painel quando o webhook chegou', async () => {
      painelDaBarbearia('/configuracoes', true, '?assinatura=retorno');
      mockRpc
        .mockResolvedValueOnce({ data: [{ access: 'blocked', reason: 'trial_expired', relevant_date: null }], error: null })
        .mockResolvedValue({ data: [{ access: 'allowed', reason: 'active', relevant_date: null }], error: null });

      render(<GerenteLayout />);

      await userEvent.click(await screen.findByRole('button', { name: 'Atualizar situação' }));

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Seu período de teste terminou' })).not.toBeInTheDocument();
    });

    it('bloqueado: o onboarding também fica atrás da tela de bloqueio', async () => {
      painelDaBarbearia('/onboarding', false);
      estadoDoBanco('blocked', 'trial_expired');

      render(<GerenteLayout />);

      expect(await screen.findByRole('heading', { name: 'Seu período de teste terminou' })).toBeInTheDocument();
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('bloqueado: o Gerente consegue sair da conta', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('blocked', 'payment_failed');

      render(<GerenteLayout />);

      expect(await screen.findByRole('button', { name: 'Sair da conta' })).toBeInTheDocument();
    });

    it('com aviso: mostra a faixa com os dias restantes e mantém o painel', async () => {
      painelDaBarbearia('/agenda');
      const fim = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 - 60_000).toISOString();
      estadoDoBanco('warning', 'trial', fim);

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent('Seu período de teste termina em 2 dias.');
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    // Spec 052, ticket 07: a data da faixa é a do bloqueio (5 dias depois da primeira recusa), no fuso da barbearia.
    it('pagamento recusado: mostra a faixa com a data do bloqueio e mantém o painel', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('warning', 'payment_failed', '2026-10-03T15:00:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Pagamento recusado. Atualize o cartão até 03/10 para não ter o acesso bloqueado.'
      );
      expect(screen.getByTestId('outlet')).toBeInTheDocument();
    });

    it('pagamento recusado: a data do bloqueio na faixa segue o fuso da barbearia', async () => {
      painelDaBarbearia('/agenda', true, '', 'America/Manaus');
      // 03:30 UTC de 04/10: 00:30 do dia 4 em Brasília, 23:30 do dia 3 em Manaus.
      estadoDoBanco('warning', 'payment_failed', '2026-10-04T03:30:00Z');

      render(<GerenteLayout />);

      expect(await screen.findByRole('status')).toHaveTextContent('até 03/10');
    });

    it('liberado: mostra o painel, sem faixa e sem tela de bloqueio', async () => {
      painelDaBarbearia('/agenda');
      estadoDoBanco('allowed', 'active');

      render(<GerenteLayout />);

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Pagar' })).not.toBeInTheDocument();
    });

    it('lê o estado em paralelo com os dados da barbearia, sem esperar por eles', async () => {
      // A consulta do perfil nunca responde: se a leitura do estado esperasse pela barbearia,
      // ela não aconteceria.
      mockFrom.mockImplementation(() => ({
        select: () => ({ eq: () => ({ single: () => new Promise(() => {}) }) }),
      }));
      estadoDoBanco('allowed', 'active');

      render(<GerenteLayout />);

      await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(1));
    });

    it('enquanto o estado não chega, não mostra o painel para depois trocar pelo bloqueio', async () => {
      painelDaBarbearia('/agenda');
      mockRpc.mockReturnValue(new Promise(() => {}));

      render(<GerenteLayout />);

      await waitFor(() => expect(mockRpc).toHaveBeenCalled());
      expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
    });

    it('se a leitura do estado falha, o painel abre: o banco protege o resto', async () => {
      painelDaBarbearia('/agenda');
      mockRpc.mockResolvedValue({ data: null, error: { message: 'sem rede' } });
      const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<GerenteLayout />);

      expect(await screen.findByTestId('outlet')).toBeInTheDocument();
      erro.mockRestore();
    });

    it('o redirecionamento para o onboarding continua valendo com o estado liberado', async () => {
      painelDaBarbearia('/agenda', false);
      estadoDoBanco('allowed', 'trial');

      render(<GerenteLayout />);

      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'));
    });
  });
});
