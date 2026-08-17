import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Financeiro } from '../Financeiro';

// Mocks do GSAP para testes unitários
vi.mock('gsap', () => ({
  gsap: {
    fromTo: vi.fn(),
    timeline: () => ({
      fromTo: vi.fn().mockReturnThis(),
    }),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: (cb: () => void) => {
    cb();
  },
}));

const { mockAddToast, mockRpc } = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockRpc = vi.fn();
  return { mockAddToast, mockRpc };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
  },
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    tenantId: 'test-tenant-123',
    tenantName: 'Barbearia Modelo',
  }),
}));

describe('Página Financeiro (Gerente)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve exibir métricas financeiras consolidadas ao carregar com sucesso', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        total_revenue: 1500.5,
        total_commission: 600.2,
        net_revenue: 900.3,
        revenue_by_method: {
          pix: 1000.5,
          credit_card: 300,
          cash: 200,
        },
        commissions_by_professional: [
          {
            professional_id: 'prof-1',
            professional_name: 'Carlos Barbeiro',
            commission_sum: 400,
            appointments_count: 8,
          },
          {
            professional_id: 'prof-2',
            professional_name: 'Ana Navalha',
            commission_sum: 200.2,
            appointments_count: 4,
          },
        ],
      },
      error: null,
    });

    render(<Financeiro />);

    await waitFor(() => {
      expect(screen.getByText('Relatório financeiro')).toBeInTheDocument();
    });

    // Faturamento bruto
    expect(screen.getByText(/1\.500,50/)).toBeInTheDocument();
    // Comissões
    expect(screen.getByText(/600,20/)).toBeInTheDocument();
    // Líquido
    expect(screen.getByText(/900,30/)).toBeInTheDocument();

    // Métodos de pagamento mapeados
    expect(screen.getByText('PIX')).toBeInTheDocument();
    expect(screen.getByText('Cartão de crédito')).toBeInTheDocument();
    expect(screen.getByText('Dinheiro em espécie')).toBeInTheDocument();

    // Profissionais
    expect(screen.getByText('Carlos Barbeiro')).toBeInTheDocument();
    expect(screen.getByText('Ana Navalha')).toBeInTheDocument();
  });

  it('deve permitir trocar o período de consulta (30 dias, 90 dias)', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_revenue: 3000,
        total_commission: 1200,
        net_revenue: 1800,
        revenue_by_method: { pix: 3000 },
        commissions_by_professional: [],
      },
      error: null,
    });

    render(<Financeiro />);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(1);
    });

    const btn30d = screen.getByRole('button', { name: /Últimos 30 dias/i });
    fireEvent.click(btn30d);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });
  });

  it('deve disparar toast amigável e tratar erro caso a RPC falhe', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Acesso negado' },
    });

    render(<Financeiro />);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'Não foi possível carregar o relatório financeiro.',
        'error'
      );
    });
  });
});
