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

const createPaymentBuilder = () => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
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
      if (table === 'payments') {
        return createPaymentBuilder();
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

    expect(mockSupabaseClient.from).not.toHaveBeenCalledWith('payments');
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
      error: new Error('Falha ao consultar pagamentos'),
    });

    render(<MinhasComissoes />);

    await waitFor(() => {
      expect(screen.getAllByText(/R\$\s*0,00/)).toHaveLength(2);
    });

    expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
    expect(screen.queryByText('Arthur Pendragon')).not.toBeInTheDocument();
  });
});
