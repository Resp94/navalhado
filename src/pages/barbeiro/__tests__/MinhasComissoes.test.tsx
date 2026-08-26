import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MinhasComissoes } from '../MinhasComissoes';

vi.mock('gsap', () => ({
  gsap: { fromTo: vi.fn() },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: (callback: () => void) => callback(),
}));

const {
  mockAddToast,
  mockGetSession,
  mockNavigate,
  mockPaymentResult,
  mockProfileSingle,
  mockSupabaseClient,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockGetSession = vi.fn();
  const mockNavigate = vi.fn();
  const mockPaymentResult = vi.fn();
  const mockProfileSingle = vi.fn();

  return {
    mockAddToast,
    mockGetSession,
    mockNavigate,
    mockPaymentResult,
    mockProfileSingle,
    mockSupabaseClient: {
      auth: {
        getSession: mockGetSession,
        signOut: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

const createComandaItensBuilder = () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve(mockPaymentResult())),
  };
  return builder;
};

describe('MinhasComissoes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'barbeiro@example.com' } } },
    });
    mockPaymentResult.mockReturnValue({ data: [], error: null });
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'professionals') {
        return {
          select: () => ({
            eq: () => ({ single: mockProfileSingle }),
          }),
        };
      }
      if (table === 'comanda_itens') {
        return createComandaItensBuilder();
      }
      throw new Error(`Tabela inesperada: ${table}`);
    });
  });

  it('nega acesso quando nao existe profissional associado ao usuario', async () => {
    mockProfileSingle.mockResolvedValue({
      data: null,
      error: new Error('Profissional nao encontrado'),
    });

    render(<MinhasComissoes />);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('comanda_itens');
  });

  it('mantem totais zerados quando a consulta financeira falha', async () => {
    mockProfileSingle.mockResolvedValue({
      data: {
        id: 'prof-1',
        name: 'Carlos',
        tenant_id: 'tenant-1',
        commission_percentage: 50,
      },
      error: null,
    });
    mockPaymentResult.mockReturnValue({
      data: null,
      error: new Error('Falha ao consultar comanda_itens'),
    });

    render(<MinhasComissoes />);

    await waitFor(() => {
      expect(screen.getAllByText(/R\$\s*0,00/)).toHaveLength(2);
    });

    expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(screen.queryByText('Arthur Pendragon')).not.toBeInTheDocument();
  });

  it('calcula faturamento e comissoes por item individual e exibe Cliente Balcão para clientes anonimos', async () => {
    mockProfileSingle.mockResolvedValue({
      data: {
        id: 'prof-1',
        name: 'Carlos',
        tenant_id: 'tenant-1',
        commission_percentage: 40,
      },
      error: null,
    });

    // Dois itens atribuídos ao prof-1: um serviço (R$ 50, comissão 50%) e um produto (R$ 100, comissão 10%)
    mockPaymentResult.mockReturnValue({
      data: [
        {
          id: 'item-1',
          quantity: 1,
          unit_price: 50,
          total_price: 50,
          item_type: 'service',
          created_at: '2026-08-26T10:00:00Z',
          professional_id: 'prof-1',
          comanda: {
            id: 'cmd-1',
            status: 'fechada',
            closed_at: '2026-08-26T10:30:00Z',
            created_at: '2026-08-26T10:00:00Z',
            customer: null, // Balcão sem cadastro!
          },
          service: {
            name: 'Corte Degradê',
            price: 50,
            commission_percentage: 50,
          },
          product: null,
        },
        {
          id: 'item-2',
          quantity: 2,
          unit_price: 50,
          total_price: 100,
          item_type: 'product',
          created_at: '2026-08-26T11:00:00Z',
          professional_id: 'prof-1',
          comanda: {
            id: 'cmd-2',
            status: 'fechada',
            closed_at: '2026-08-26T11:30:00Z',
            created_at: '2026-08-26T11:00:00Z',
            customer: { name: 'Lucas Silva' },
          },
          service: null,
          product: {
            name: 'Pomada Matte',
            price: 50,
            commission_percentage: 10,
          },
        },
      ],
      error: null,
    });

    render(<MinhasComissoes />);

    await waitFor(() => {
      // Total Revenue: 50 + 100 = 150 -> R$ 150,00
      expect(screen.getByText(/R\$\s*150,00/)).toBeInTheDocument();
      // Total Commission: (50 * 50%) + (100 * 10%) = 25 + 10 = 35 -> R$ 35,00
      expect(screen.getByText(/R\$\s*35,00/)).toBeInTheDocument();
    });

    // Itens na listagem
    expect(screen.getAllByText('Cliente Balcão').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lucas Silva').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Corte Degradê').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pomada Matte').length).toBeGreaterThan(0);
  });
});
