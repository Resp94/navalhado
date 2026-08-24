import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FluxoAgendamento } from '../FluxoAgendamento';

const { mockAddToast, mockRpc } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

const incompleteDetails = {
  customer_id: 'customer-1',
  customer_name: 'Cliente',
  tenant_id: 'tenant-1',
  tenant_name: 'Barbearia Navalhado',
  tenant_phone: '5592999999999',
  cadastro_completo: false,
};

function renderBookingRoute(initialEntry = '/cliente/token-abc/agendar') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/cliente/:token/agendar" element={<FluxoAgendamento />} />
        <Route path="/cliente/agendar" element={<FluxoAgendamento />} />
        <Route path="/cliente/acesso-expirado" element={<div>Acesso expirado</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FluxoAgendamento - cadastro inicial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('carrega o catálogo diretamente mesmo para cliente sem cadastro prévio', async () => {
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') {
        return { data: [incompleteDetails], error: null };
      }
      if (name === 'get_services_by_customer_token') {
        return { data: [service], error: null };
      }
      if (name === 'get_professionals_by_customer_token') {
        return { data: [], error: null };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();

    expect(await screen.findByRole('heading', { name: /Selecione o Serviço/i })).toBeInTheDocument();
    expect(await screen.findByText('Corte')).toBeInTheDocument();
  });

  it('valida nome e sobrenome e telefone no modal de confirmação antes de agendar', async () => {
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [incompleteDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [service], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      if (name === 'get_available_slots_by_token') return { data: ['14:00'], error: null };
      return { data: null, error: null };
    });

    renderBookingRoute();
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));
    fireEvent.click(await screen.findByRole('button', { name: '14:00' }));

    expect(await screen.findByText(/Confirmar agendamento/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Ex: Matheus Lopes/i);
    const phoneInput = screen.getByPlaceholderText(/\(92\) 99420-4756/i);

    // Sem preencher nome completo
    fireEvent.change(nameInput, { target: { value: 'João' } });
    fireEvent.change(phoneInput, { target: { value: '92999998888' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e agendar/i }));

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('nome e sobrenome completo'),
      'warning',
    );
  });

  it('completa cadastro e agenda com sucesso no modal de confirmação', async () => {
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
      if (name === 'get_customer_details_by_token') return { data: [incompleteDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [service], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      if (name === 'get_available_slots_by_token') return { data: ['14:00'], error: null };
      if (name === 'complete_customer_registration') {
        expect(params).toEqual({ p_token: 'token-abc', p_name: 'Maria Silva', p_phone: '92999998888' });
        return { data: [{ ...incompleteDetails, customer_name: 'Maria Silva', phone: '92999998888', token_acesso: 'token-abc', cadastro_completo: true }], error: null };
      }
      if (name === 'create_appointment_by_token') {
        return { data: 'appointment-123', error: null };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));
    fireEvent.click(await screen.findByRole('button', { name: '14:00' }));

    expect(await screen.findByText(/Confirmar agendamento/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Ex: Matheus Lopes/i);
    const phoneInput = screen.getByPlaceholderText(/\(92\) 99420-4756/i);

    fireEvent.change(nameInput, { target: { value: 'Maria Silva' } });
    fireEvent.change(phoneInput, { target: { value: '92999998888' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e agendar/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Agendamento realizado com sucesso!', 'success');
    });
  });

  it('carrega slots pela RPC protegida com o token do cliente', async () => {
    const completedDetails = { ...incompleteDetails, customer_name: 'Maria', cadastro_completo: true };
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [completedDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [service], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      if (name === 'get_available_slots_by_token') return { data: [], error: null };
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_available_slots_by_token', {
        p_token: 'token-abc',
        p_service_id: 'service-1',
        p_professional_id: null,
        p_date: expect.any(String),
        p_exclude_appointment_id: null,
      });
    });
  });

  it('exibe mensagem amigável de expediente encerrado quando não há slots para a data de hoje', async () => {
    const completedDetails = { 
      ...incompleteDetails, 
      customer_name: 'Maria', 
      cadastro_completo: true,
      business_hours: {
        segunda: { active: true, open: '09:00', close: '18:00' },
        terca: { active: true, open: '09:00', close: '18:00' },
        quarta: { active: true, open: '09:00', close: '18:00' },
        quinta: { active: true, open: '09:00', close: '18:00' },
        sexta: { active: true, open: '09:00', close: '18:00' },
        sabado: { active: true, open: '09:00', close: '15:00' },
        domingo: { active: false, open: '09:00', close: '12:00' }
      }
    };
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [completedDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [service], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      if (name === 'get_available_slots_by_token') return { data: [], error: null };
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute();
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));

    expect(await screen.findByText(/expediente da barbearia para o dia de hoje já foi encerrado|Nenhum horário disponível/i)).toBeInTheDocument();
  });

  it('exibe a política da barbearia no modal de confirmação do agendamento', async () => {
    const completedDetails = { 
      ...incompleteDetails, 
      customer_name: 'Maria', 
      cadastro_completo: true,
      min_cancellation_lead_time_minutes: 180,
    };
    const service = {
      id: 'service-1',
      name: 'Corte',
      description: null,
      price: 50,
      duration_minutes: 30,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [completedDetails], error: null };
      if (name === 'get_services_by_customer_token') return { data: [service], error: null };
      if (name === 'get_professionals_by_customer_token') return { data: [], error: null };
      if (name === 'get_available_slots_by_token') return { data: ['23:30'], error: null };
      return { data: null, error: null };
    });

    renderBookingRoute();
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));

    const slotBtn = await screen.findByRole('button', { name: '23:30' });
    fireEvent.click(slotBtn);

    expect(await screen.findByText(/Confirmar agendamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Política da barbearia:/i)).toBeInTheDocument();
    expect(screen.getByText(/3 horas/i)).toBeInTheDocument();
  });
});
