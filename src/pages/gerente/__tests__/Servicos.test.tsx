import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Servicos } from '../Servicos';

// Mocks do GSAP para evitar erros no JSDOM
vi.mock('gsap', () => ({
  gsap: {
    fromTo: vi.fn(),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: (cb: () => void) => {
    cb();
  },
}));

// Mocks hoisted do Vitest
const {
  mockAddToast,
  mockSupabaseClient,
  mockSelect,
  mockInsert,
  mockUpdate,
} = vi.hoisted(() => {
  const mockAddToast = vi.fn();
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();

  const mockSupabaseClient = {
    from: vi.fn().mockImplementation((_table) => {
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
    }),
  };

  return {
    mockAddToast,
    mockSupabaseClient,
    mockSelect,
    mockInsert,
    mockUpdate,
  };
});

// Mock do Toast
vi.mock('../../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

// Mock do react-router-dom
vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    tenantId: 'tenant-test-id',
    tenantName: 'Barbearia Estilo',
  }),
  useNavigate: () => vi.fn(),
}));

// Mock do Supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('Aba de Serviços (Servicos.tsx)', () => {
  const mockServices = [
    {
      id: 'srv-1',
      tenant_id: 'tenant-test-id',
      name: 'Corte Tradicional',
      description: 'Corte completo com tesoura ou máquina',
      price: 45.0,
      price_type: 'fixed',
      duration_minutes: 35,
      category: 'Cabelo',
      commission_percentage: 50,
      return_period_days: 20,
      custom_reminder_template: null,
      is_active: true,
      display_order: 1,
      deleted_at: null,
    },
    {
      id: 'srv-2',
      tenant_id: 'tenant-test-id',
      name: 'Barba Terapia',
      description: 'Barba com toalha quente',
      price: 35.0,
      price_type: 'fixed',
      duration_minutes: 30,
      category: 'Barba',
      commission_percentage: 50,
      return_period_days: 15,
      custom_reminder_template: null,
      is_active: false,
      display_order: 2,
      deleted_at: null,
    },
  ];

  const createDefaultBuilder = (data: any, error: any = null) => {
    const builder: any = {
      eq: vi.fn().mockImplementation(() => builder),
      is: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      select: vi.fn().mockImplementation(() => builder),
      then: vi.fn().mockImplementation((onfulfilled) => {
        return Promise.resolve(onfulfilled({ data, error }));
      }),
    };
    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockImplementation(() => createDefaultBuilder(mockServices));
    mockInsert.mockImplementation(() => createDefaultBuilder(mockServices[0]));
    mockUpdate.mockImplementation(() => createDefaultBuilder(mockServices[0]));
  });

  it('renderiza o catálogo de serviços e badges informativas', async () => {
    render(<Servicos />);

    await waitFor(() => {
      expect(screen.getByText('Corte Tradicional')).toBeInTheDocument();
      expect(screen.getByText('Barba Terapia')).toBeInTheDocument();
      expect(screen.getByText('R$ 45,00')).toBeInTheDocument();
      expect(screen.getByText('R$ 35,00')).toBeInTheDocument();
    });
  });

  it('marca posição e categoria como informações secundárias para compactação mobile', async () => {
    const { container } = render(<Servicos />);

    await waitFor(() => {
      expect(screen.getByText('Corte Tradicional')).toBeInTheDocument();
    });

    expect(container.querySelector('.service-position-badge')).toHaveClass(
      'service-position-badge--mobile-secondary'
    );
    expect(container.querySelector('.service-category-badge')).toHaveClass(
      'service-category-badge--mobile-secondary'
    );
  });

  it('permite alternar status de ativo/inativo pelo switch', async () => {
    render(<Servicos />);

    await waitFor(() => {
      expect(screen.getByText('Corte Tradicional')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);

    // Toggle no primeiro serviço (ativo -> inativo)
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        })
      );
    });
  });

  it('permite realizar soft delete de serviço com modal de confirmação preservando histórico', async () => {
    render(<Servicos />);

    await waitFor(() => {
      expect(screen.getByText('Corte Tradicional')).toBeInTheDocument();
    });

    const btnExcluir = screen.getByRole('button', { name: /Excluir Corte Tradicional/i });
    fireEvent.click(btnExcluir);

    // Modal de confirmação deve aparecer
    expect(screen.getByRole('heading', { name: 'Excluir serviço' })).toBeInTheDocument();
    expect(screen.getByText(/O histórico de agendamentos, atendimentos e comandas passadas/i)).toBeInTheDocument();

    const btnConfirmar = screen.getByRole('button', { name: /Sim, excluir/i });
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          deleted_at: expect.any(String),
        })
      );
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('excluído com sucesso'),
        'success'
      );
    });
  });
});
