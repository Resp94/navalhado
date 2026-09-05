import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    active_tenants: 12,
    suspended_tenants: 2,
    revenue_this_month: 5200.0,
    revenue_trend: [
      { month: '2026-07', month_label: 'Jul/26', revenue: 4000 },
      { month: '2026-08', month_label: 'Ago/26', revenue: 5200 },
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
      expect(screen.getByText('Barbearias Ativas')).toBeInTheDocument();
      expect(screen.getByText('12')).toBeInTheDocument();
      expect(screen.getByText('Inadimplentes / Suspensas')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
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
