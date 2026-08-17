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

const { mockAddToast, mockRpc, mockFrom } = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockRpc = vi.fn();
  const mockFrom = vi.fn();
  return { mockAddToast, mockRpc, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: mockRpc,
    from: mockFrom,
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

describe('Página Financeiro (Gerente - Hub Financeiro)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock para consultas de tabela
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  it('deve exibir os 5 cards de KPIs consolidados ao carregar com sucesso', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        total_revenue: 2500.0,
        services_revenue: 2000.0,
        products_revenue: 500.0,
        products_count: 10,
        products_cost: 200.0,
        total_commission: 800.0,
        paid_commission: 350.0,
        pending_commission: 450.0,
        net_revenue: 1500.0,
        revenue_by_method: {
          pix: 1500.0,
          credit_card: 700.0,
          cash: 300.0,
        },
        commissions_by_professional: [
          {
            professional_id: 'prof-1',
            professional_name: 'Carlos Barbeiro',
            commission_sum: 500.0,
            paid_sum: 200.0,
            pending_sum: 300.0,
            appointments_count: 12,
          },
        ],
      },
      error: null,
    });

    render(<Financeiro />);

    await waitFor(() => {
      expect(screen.getByText('Hub financeiro')).toBeInTheDocument();
    });

    // 1. Faturamento bruto
    expect(screen.getByText('Faturamento bruto')).toBeInTheDocument();
    expect(screen.getByText(/2\.500,00/)).toBeInTheDocument();

    // 2. Serviços prestados
    expect(screen.getByText('Serviços prestados')).toBeInTheDocument();
    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument();

    // 3. Venda de produtos
    expect(screen.getByText('Venda de produtos')).toBeInTheDocument();
    expect(screen.getAllByText(/500,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10 itens/)).toBeInTheDocument();

    // 4. Comissões da equipe
    expect(screen.getByText('Comissões da equipe')).toBeInTheDocument();
    expect(screen.getByText(/800,00/)).toBeInTheDocument();
    expect(screen.getByText(/Pendente: R\$\s*450,00/)).toBeInTheDocument();

    // 5. Lucro líquido livre
    expect(screen.getByText('Lucro líquido livre')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.500,00/).length).toBeGreaterThanOrEqual(1);
  });

  it('deve alternar entre as abas Caixa diário e Repasses de comissões', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_revenue: 1000.0,
        services_revenue: 800.0,
        products_revenue: 200.0,
        products_count: 4,
        products_cost: 80.0,
        total_commission: 300.0,
        paid_commission: 100.0,
        pending_commission: 200.0,
        net_revenue: 620.0,
        revenue_by_method: { pix: 1000.0 },
        commissions_by_professional: [
          {
            professional_id: 'prof-1',
            professional_name: 'Carlos Barbeiro',
            commission_sum: 300.0,
            paid_sum: 100.0,
            pending_sum: 200.0,
            appointments_count: 5,
          },
        ],
      },
      error: null,
    });

    render(<Financeiro />);

    await waitFor(() => {
      expect(screen.getByText(/Caixa diário e turnos/i)).toBeInTheDocument();
    });

    // Clicar na aba Repasses de comissões
    const comissoesTab = screen.getByRole('button', { name: /Repasses de comissões/i });
    fireEvent.click(comissoesTab);

    // Deve exibir tabela de comissões
    expect(screen.getByText('Saldos de comissão por profissional')).toBeInTheDocument();
    expect(screen.getByText('Carlos Barbeiro')).toBeInTheDocument();
    expect(screen.getByText('Pagar comissão')).toBeInTheDocument();
  });

  it('deve permitir trocar o período de consulta (30 dias, 90 dias)', async () => {
    mockRpc.mockResolvedValue({
      data: {
        total_revenue: 3000,
        services_revenue: 2500,
        products_revenue: 500,
        products_count: 5,
        products_cost: 200,
        total_commission: 1200,
        paid_commission: 400,
        pending_commission: 800,
        net_revenue: 1600,
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
        'Não foi possível carregar os dados do painel financeiro.',
        'error'
      );
    });
  });
});
