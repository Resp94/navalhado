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
    timezone: 'America/Sao_Paulo',
  }),
}));

describe('Página Financeiro (Gerente - Hub Financeiro)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });

    // Default mock para consultas de tabela
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
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
    expect(screen.getAllByText(/2\.500,00/).length).toBeGreaterThanOrEqual(1);

    // 2. Serviços prestados
    expect(screen.getByText('Serviços prestados')).toBeInTheDocument();
    expect(screen.getAllByText(/2\.000,00/).length).toBeGreaterThanOrEqual(1);

    // 3. Venda de produtos
    expect(screen.getByText('Venda de produtos')).toBeInTheDocument();
    expect(screen.getAllByText(/500,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10 itens/)).toBeInTheDocument();

    // 4. Comissões da equipe
    expect(screen.getByText('Comissões da equipe')).toBeInTheDocument();
    expect(screen.getAllByText(/800,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Pendente: R\$\s*450,00/)).toBeInTheDocument();

    // 5. Lucro líquido livre
    expect(screen.getByText('Lucro líquido livre')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.500,00/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Resumo por dia')).toHaveLength(2);
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
      expect(mockRpc.mock.calls.filter(([name]) => name === 'get_tenant_financial_metrics')).toHaveLength(1);
    });

    const btn30d = screen.getByRole('button', { name: /Últimos 30 dias/i });
    fireEvent.click(btn30d);

    await waitFor(() => {
      expect(mockRpc.mock.calls.filter(([name]) => name === 'get_tenant_financial_metrics')).toHaveLength(2);
    });
  });

  it('deve permitir imprimir o extrato de uma sessão de caixa encerrada', async () => {
    mockRpc.mockImplementation((name: string) => {
      if (name === 'get_cash_session_statement') {
        return Promise.resolve({
          data: {
            session: {
              id: 'sess-1',
              tenant_id: 'test-tenant-123',
              status: 'closed',
            },
            adjustments: [],
            adjusted_difference_amount: 0,
            movements: [
              { id: 'mov-1', type: 'suprimento', amount: 50, reason: 'Troco extra', performed_by: null, payout_id: null, created_at: '2026-09-01T10:00:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
              { id: 'mov-2', type: 'sangria', amount: 30, reason: 'Retirada para o cofre', performed_by: null, payout_id: null, created_at: '2026-09-01T11:00:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
              { id: 'mov-3', type: 'repasse_comissao', amount: 120, reason: 'Repasse Carlos', performed_by: null, payout_id: 'payout-1', created_at: '2026-09-01T12:00:00Z', reversed_at: null, reversed_by: null, reversal_reason: null },
            ],
            reopenings: [],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const closedSessionRow = {
      id: 'sess-1',
      tenant_id: 'test-tenant-123',
      opened_by: 'user-1',
      closed_by: 'user-1',
      opened_at: '2026-09-01T08:00:00Z',
      closed_at: '2026-09-01T18:00:00Z',
      initial_amount: 100,
      closing_amount: 500,
      expected_amount: 500,
      difference_amount: 0,
      cash_received_amount: 300,
      pix_received_amount: 150,
      card_received_amount: 50,
      other_received_amount: 0,
      payment_count: 8,
      supplies_amount: 50,
      withdrawals_amount: 30,
      calculation_version: 'v1',
      status: 'closed' as const,
      notes: null,
      opened_user: { name: 'Ana Gerente' },
      closed_user: { name: 'Ana Gerente' },
    };

    const defaultTableChain = () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'cash_sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [closedSessionRow], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return defaultTableChain();
    });

    render(<Financeiro />);

    await waitFor(() => {
      expect(screen.getByText(/Caixa diário e turnos/i)).toBeInTheDocument();
    });

    const extratoBtn = await screen.findByRole('button', { name: /Extrato/i });
    fireEvent.click(extratoBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'get_cash_session_statement',
        expect.objectContaining({ p_session_id: 'sess-1', p_tenant_id: 'test-tenant-123' })
      );
    });

    expect(await screen.findByText('Troco extra')).toBeInTheDocument();
    expect(screen.getByText('Retirada para o cofre')).toBeInTheDocument();
    expect(screen.getByText('Repasse Carlos')).toBeInTheDocument();
    expect(screen.getByText(/Sem diferença/)).toBeInTheDocument();

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const printBtn = screen.getByRole('button', { name: /Imprimir/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
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
