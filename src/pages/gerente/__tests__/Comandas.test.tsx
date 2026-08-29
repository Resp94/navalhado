import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../../../components/Toast';
import { ComandaRepository } from '../../../modules/comandas/ComandaRepository';
import { Comandas } from '../Comandas';

// Mock do OutletContext
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({
      tenantId: 'tenant-123',
      tenantName: 'Barbearia Navalha de Ouro',
      timezone: 'America/Sao_Paulo',
    }),
  };
});

const mockQueryBuilder: any = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockChannelObj: any = {
  on: vi.fn().mockImplementation(() => mockChannelObj),
  subscribe: vi.fn().mockImplementation(() => mockChannelObj),
};

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => mockQueryBuilder),
    channel: vi.fn(() => mockChannelObj),
    removeChannel: vi.fn(),
  },
}));

describe('Comandas Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza título, abas de filtro e botão de nova comanda avulsa', async () => {
    render(
      <ToastProvider>
        <BrowserRouter>
          <Comandas />
        </BrowserRouter>
      </ToastProvider>
    );

    expect(screen.getByText('Comandas e atendimentos')).toBeInTheDocument();
    expect(screen.getByText('Nova comanda avulsa')).toBeInTheDocument();
    expect(screen.getByText('Abertas')).toBeInTheDocument();
    expect(screen.getByText('Pagas')).toBeInTheDocument();
    expect(screen.getByText('Todas')).toBeInTheDocument();
  });

  it('renderiza badges visuais para comandas vinculadas a agendamento e comandas avulsas de balcão', async () => {
    const mockComandas = [
      {
        id: 'cmd-1',
        tenant_id: 'tenant-123',
        appointment_id: 'app-1',
        customer_id: 'cust-1',
        customer_name: 'Marcos Vinicius',
        customer_phone: '92999998888',
        professional_name: 'Carlos Barbeiro',
        status: 'aberta' as const,
        total_amount: 50.0,
        discount_amount: 0,
        tip_amount: 0,
        notes: null,
        appointment_start_time: '2026-08-25T15:00:00.000Z',
        appointment_service_name: 'Corte Degradê',
        appointment_is_fitting: false,
        itens: [],
      },
      {
        id: 'cmd-2',
        tenant_id: 'tenant-123',
        appointment_id: null,
        customer_id: null,
        customer_name: 'Cliente Balcão',
        customer_phone: null,
        professional_name: 'Equipe',
        status: 'aberta' as const,
        total_amount: 30.0,
        discount_amount: 0,
        tip_amount: 0,
        notes: null,
        appointment_start_time: null,
        appointment_service_name: null,
        appointment_is_fitting: null,
        itens: [],
      },
      {
        id: 'cmd-3',
        tenant_id: 'tenant-123',
        appointment_id: 'app-2',
        customer_id: 'cust-2',
        customer_name: 'Cliente Encaixe',
        customer_phone: '92999997777',
        professional_name: 'Marcos Barbeiro',
        status: 'aberta' as const,
        total_amount: 35.0,
        discount_amount: 0,
        tip_amount: 0,
        notes: null,
        appointment_start_time: '2026-08-25T16:00:00.000Z',
        appointment_service_name: 'Barba',
        appointment_is_fitting: true,
        itens: [],
      },
    ];

    vi.spyOn(ComandaRepository.prototype, 'listAll').mockResolvedValue(mockComandas);

    render(
      <ToastProvider>
        <BrowserRouter>
          <Comandas />
        </BrowserRouter>
      </ToastProvider>
    );

    expect(await screen.findByText('Marcos Vinicius')).toBeInTheDocument();
    expect(screen.getByText('Agendamento')).toBeInTheDocument();
    expect(screen.getByText(/Corte Degradê/i)).toBeInTheDocument();

    expect(screen.getByText('Cliente Balcão')).toBeInTheDocument();
    expect(screen.getByText(/Atendimento Balcão \/ Avulsa/i)).toBeInTheDocument();
    expect(screen.getByText('Cliente Encaixe')).toBeInTheDocument();
    expect(screen.getByText('Encaixe')).toBeInTheDocument();
  });
});
