import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { MenuCliente } from '../MenuCliente';

const { mockAddToast, mockRpc } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { 
    rpc: mockRpc,
    channel: () => ({
      on: () => ({
        subscribe: () => {}
      })
    }),
    removeChannel: () => {}
  },
}));

describe('MenuCliente - TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('navalhado_customer_token', 'mock-customer-token');
  });

  it('oculta botões de Reagendar e Cancelar para agendamentos no passado e exibe para agendamentos no futuro', async () => {
    const mockDetails = {
      customer_id: 'cust-123',
      customer_name: 'Jonathas Teste',
      tenant_id: 'tenant-123',
      tenant_name: 'Barbearia Estilo',
      tenant_phone: '5592999999999',
    };

    // Criar datas relativas ao momento atual
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 2); // 2 horas no futuro

    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 2); // 2 horas no passado

    const mockAppointments = [
      {
        appointment_id: 'app-futuro',
        start_time: futureDate.toISOString(),
        end_time: new Date(futureDate.getTime() + 30 * 60 * 1000).toISOString(),
        status: 'confirmed',
        payment_status: 'pending',
        cancellation_reason: null,
        professional_name: 'Carlos Barbeiro',
        professional_id: 'prof-123',
        service_name: 'Corte Degradê',
        service_id: 'serv-123',
        service_price: 45.0,
        service_duration: 30,
        tenant_name: 'Barbearia Estilo',
        tenant_id: 'tenant-123',
        tenant_phone: '5592999999999',
        customer_name: 'Jonathas Teste',
      },
      {
        appointment_id: 'app-passado',
        start_time: pastDate.toISOString(),
        end_time: new Date(pastDate.getTime() + 30 * 60 * 1000).toISOString(),
        status: 'confirmed',
        payment_status: 'pending',
        cancellation_reason: null,
        professional_name: 'Carlos Barbeiro',
        professional_id: 'prof-123',
        service_name: 'Barba Terapia',
        service_id: 'serv-456',
        service_price: 35.0,
        service_duration: 30,
        tenant_name: 'Barbearia Estilo',
        tenant_id: 'tenant-123',
        tenant_phone: '5592999999999',
        customer_name: 'Jonathas Teste',
      },
    ];

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') {
        return { data: [mockDetails], error: null }; // must be an array!
      }
      if (name === 'get_customer_appointments_by_token') {
        return { data: mockAppointments, error: null };
      }
      return { data: null, error: null };
    });

    render(
      <MemoryRouter>
        <MenuCliente />
      </MemoryRouter>
    );

    // Esperar carregar os dados
    const corteText = await screen.findByText('Corte Degradê');
    const barbaText = screen.getByText('Barba Terapia');
    expect(corteText).toBeInTheDocument();
    expect(barbaText).toBeInTheDocument();

    // Encontrar todos os botões de Cancelar e Reagendar
    const cancelButtons = screen.getAllByRole('button', { name: /Cancelar/i });
    const rescheduleButtons = screen.getAllByRole('button', { name: /Reagendar/i });

    // Esperamos apenas 1 botão de cada (para o agendamento futuro), e não 2!
    expect(cancelButtons.length).toBe(1);
    expect(rescheduleButtons.length).toBe(1);
  });
});
