import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
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

function renderBookingRoute(initialEntry: string | { pathname: string; state?: unknown } = '/cliente/token-abc/agendar') {
  return render(
    <MemoryRouter initialEntries={[initialEntry as any]}>
      <Routes>
        <Route path="/cliente/:token/agendar" element={<FluxoAgendamento />} />
        <Route path="/cliente/agendar" element={<FluxoAgendamento />} />
        <Route path="/cliente/menu" element={<div>Menu do Cliente</div>} />
        <Route path="/cliente/acesso-expirado" element={<div>Acesso expirado</div>} />
        <Route path="/:slug" element={<FluxoAgendamento />} />
        <Route path="/:slug/agendar" element={<FluxoAgendamento />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FluxoAgendamento - cadastro inicial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.setSystemTime(new Date('2026-08-25T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carrega rota pública por slug sem criar cliente provisório e preserva slot indisponível', async () => {
    const service = {
      id: 'service-public-1',
      name: 'Corte Público',
      description: null,
      price: 50,
      duration_minutes: 40,
      category: 'Cabelo',
      is_active: true,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_public_tenant_by_slug') {
        return {
          data: [{
            tenant_id: 'tenant-public',
            tenant_name: 'Barbearia Pública',
            tenant_phone: '5592999999999',
            tenant_slug: 'brooklyn',
            timezone: 'America/Manaus',
            slot_interval_minutes: 30,
            min_booking_lead_time_minutes: 0,
            min_cancellation_lead_time_minutes: 120,
          }],
          error: null,
        };
      }
      if (name === 'get_services_by_public_slug') return { data: [service], error: null };
      if (name === 'get_professionals_by_public_slug') return { data: [], error: null };
      if (name === 'get_public_schedule_by_slug') {
        return {
          data: [
            { slot_time: '10:00', available: true },
            { slot_time: '10:30', available: false },
          ],
          error: null,
        };
      }
      if (name === 'confirm_public_booking') {
        return {
          data: [{
            appointment_id: 'appointment-public',
            customer_id: 'customer-public',
            token_acesso: 'token-public',
            customer_name: 'Maria Silva',
            customer_phone: '5592999998888',
          }],
          error: null,
        };
      }
      if (name === 'get_or_create_provisional_customer_by_slug') {
        throw new Error('rota pública não deve criar cliente provisório');
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute('/brooklyn');

    expect(await screen.findByText('Corte Público')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Corte Público'));
    fireEvent.click(await screen.findByText('Tanto faz'));

    expect(screen.getByDisplayValue('25/08/2026')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '10:00' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '10:30' })).toBeDisabled();
    expect(mockRpc).not.toHaveBeenCalledWith(
      'get_or_create_provisional_customer_by_slug',
      expect.anything(),
    );

    fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    fireEvent.change(screen.getByPlaceholderText(/Ex: Matheus Lopes/i), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByPlaceholderText(/\(92\) 99420-4756/i), { target: { value: '92999998888' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e agendar/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('confirm_public_booking', {
        p_slug: 'brooklyn',
        p_service_id: 'service-public-1',
        p_professional_id: null,
        p_date: expect.any(String),
        p_slot: '10:00',
        p_name: 'Maria Silva',
        p_phone: '92999998888',
        p_token: null,
      });
    });
  });

  it('preenche cliente reconhecido, permite agendar para terceiro e envia o token validado', async () => {
    const service = {
      id: 'service-public-1',
      name: 'Corte Público',
      description: null,
      price: 50,
      duration_minutes: 40,
      category: 'Cabelo',
      is_active: true,
    };
    const recognizedDetails = {
      ...incompleteDetails,
      customer_id: 'customer-original',
      customer_name: 'João Original',
      customer_phone: '92999990000',
      tenant_id: 'tenant-public',
      tenant_name: 'Barbearia Pública',
      tenant_phone: '5592999999999',
      tenant_slug: 'brooklyn',
      cadastro_completo: true,
      token_acesso: 'token-recognized',
    };

    localStorage.setItem('navalhado_canal_cliente_v1_token_brooklyn', 'token-recognized');
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_public_tenant_by_slug') {
        return {
          data: [{
            tenant_id: 'tenant-public',
            tenant_name: 'Barbearia Pública',
            tenant_phone: '5592999999999',
            tenant_slug: 'brooklyn',
            timezone: 'America/Manaus',
            slot_interval_minutes: 30,
            min_booking_lead_time_minutes: 0,
            min_cancellation_lead_time_minutes: 120,
          }],
          error: null,
        };
      }
      if (name === 'get_customer_details_by_token') return { data: [recognizedDetails], error: null };
      if (name === 'get_services_by_public_slug') return { data: [service], error: null };
      if (name === 'get_professionals_by_public_slug') return { data: [], error: null };
      if (name === 'get_public_schedule_by_slug') {
        return { data: [{ slot_time: '10:00', available: true }], error: null };
      }
      if (name === 'confirm_public_booking') {
        return {
          data: [{
            appointment_id: 'appointment-third-party',
            customer_id: 'customer-third-party',
            token_acesso: 'token-third-party',
            customer_name: 'Maria Terceira',
            customer_phone: '92999998888',
          }],
          error: null,
        };
      }
      throw new Error(`RPC inesperada: ${name}`);
    });

    renderBookingRoute({ pathname: '/brooklyn', state: { fromMenu: true } });
    fireEvent.click(await screen.findByText('Corte Público'));
    fireEvent.click(await screen.findByText('Tanto faz'));
    fireEvent.click(await screen.findByRole('button', { name: '10:00' }));

    expect(await screen.findByPlaceholderText(/Ex: Matheus Lopes/i)).toHaveValue('João Original');
    fireEvent.change(screen.getByPlaceholderText(/Ex: Matheus Lopes/i), { target: { value: 'Maria Terceira' } });
    fireEvent.change(screen.getByPlaceholderText(/\(92\) 99420-4756/i), { target: { value: '92999998888' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e agendar/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('confirm_public_booking', {
        p_slug: 'brooklyn',
        p_service_id: 'service-public-1',
        p_professional_id: null,
        p_date: expect.any(String),
        p_slot: '10:00',
        p_name: 'Maria Terceira',
        p_phone: '92999998888',
        p_token: 'token-recognized',
      });
    });
    expect(mockRpc).not.toHaveBeenCalledWith('complete_customer_registration', expect.anything());
    expect(mockRpc).not.toHaveBeenCalledWith('create_appointment_by_token', expect.anything());
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

  it('redireciona cliente com cadastro completo para o menu de agendamentos se não veio de ação explícita', async () => {
    const completedDetails = { ...incompleteDetails, customer_name: 'Maria', cadastro_completo: true };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [completedDetails], error: null };
      return { data: null, error: null };
    });

    renderBookingRoute('/cliente/token-abc/agendar');

    expect(await screen.findByText('Menu do Cliente')).toBeInTheDocument();
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

    renderBookingRoute({ pathname: '/cliente/token-abc/agendar', state: { fromMenu: true } });
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

    renderBookingRoute({ pathname: '/cliente/token-abc/agendar', state: { fromMenu: true } });
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

    renderBookingRoute({ pathname: '/cliente/token-abc/agendar', state: { fromMenu: true } });
    fireEvent.click(await screen.findByText('Corte'));
    fireEvent.click(await screen.findByText('Tanto faz'));

    const slotBtn = await screen.findByRole('button', { name: '23:30' });
    fireEvent.click(slotBtn);

    expect(await screen.findByText(/Confirmar agendamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Política da barbearia:/i)).toBeInTheDocument();
    expect(screen.getByText(/3 horas/i)).toBeInTheDocument();
  });
});
