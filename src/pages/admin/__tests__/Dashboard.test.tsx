import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../Dashboard';

const mockNavigate = vi.fn();
const mockAddToast = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/admin/dashboard' }),
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

const mockRpc = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      signOut: () => mockSignOut(),
    },
    rpc: (...args: any[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { name: 'João Admin' } }),
        }),
      }),
    }),
  },
}));

describe('Admin Dashboard', () => {
  const fakeMetrics = {
    mrr: 4500.0,
    released_tenants: 12,
    blocked_tenants: 2,
    revenue_this_month: 5200.0,
    revenue_trend: [
      { month: '2026-07', month_label: 'Julho 26', revenue: 0 },
      { month: '2026-08', month_label: 'Agosto 26', revenue: 5200 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-admin-1' } } });
    mockRpc.mockResolvedValue({ data: fakeMetrics, error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('renderiza o painel com as métricas em StatCards', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Receita Recorrente (MRR)')).toBeInTheDocument();
      expect(screen.getByText('Barbearias Liberadas')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Com acesso liberado agora')).toBeInTheDocument();
      expect(screen.getByText('Barbearias Bloqueadas')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Com acesso bloqueado agora')).toBeInTheDocument();
    });
  });

  it('não usa mais as palavras Suspensas, Inadimplentes nem Ativas nos cartões', async () => {
    render(<Dashboard />);

    await screen.findByText('Barbearias Liberadas');

    expect(screen.queryByText(/Suspensas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Inadimplentes/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Barbearias Ativas/i)).not.toBeInTheDocument();
  });

  it('mostra o mês sem cobrança como zero no gráfico, e não como erro de carga', async () => {
    const { container } = render(<Dashboard />);

    await screen.findByText('Evolução da receita');

    const points = container.querySelectorAll('svg g.cursor-pointer');
    expect(points).toHaveLength(2);
    expect(container.querySelector('svg path[d*="NaN"]')).toBeNull();

    fireEvent.mouseEnter(points[0]);
    expect(screen.getByText('Julho 26')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s0,00/)).toBeInTheDocument();
  });

  it('usa o cabeçalho compartilhado do Admin, com a aba Dashboard marcada', async () => {
    render(<Dashboard />);

    const abas = within(await screen.findByRole('navigation', { name: 'Navegação do Admin' }));
    expect(abas.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(abas.getByRole('button', { name: 'Barbearias' })).not.toHaveAttribute('aria-current');
    expect(await screen.findByText('João Admin')).toBeInTheDocument();
  });

  it('permite realizar logout com o botão Sair', async () => {
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sair/i })).toBeInTheDocument();
    });

    const logoutBtn = screen.getByRole('button', { name: /Sair/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
