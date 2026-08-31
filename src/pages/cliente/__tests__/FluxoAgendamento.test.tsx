import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FluxoAgendamento } from '../FluxoAgendamento';

const { mockAddToast, mockRpc, mockPublicRpc, mockPublicGetSession, mockPublicSignIn, mockPublicInvoke, mockPublicSetSession } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockRpc: vi.fn(),
  mockPublicRpc: vi.fn(),
  mockPublicGetSession: vi.fn(),
  mockPublicSignIn: vi.fn(),
  mockPublicInvoke: vi.fn(),
  mockPublicSetSession: vi.fn(),
}));

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
  publicSupabase: {
    rpc: mockPublicRpc,
    auth: {
      getSession: mockPublicGetSession,
      signInAnonymously: mockPublicSignIn,
      setSession: mockPublicSetSession,
      signOut: vi.fn(),
    },
    functions: {
      invoke: mockPublicInvoke,
    },
  },
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
    mockPublicGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockPublicSignIn.mockResolvedValue({
      data: { session: { user: { is_anonymous: true } } },
      error: null,
    });
    mockPublicRpc.mockResolvedValue({ data: [], error: null });
    localStorage.clear();
    vi.setSystemTime(new Date('2026-08-25T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('carrega rota pública por slug sem criar cliente provisório e oculta slot indisponível', async () => {
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
      if (name === 'resolve_public_customer_identity') {
        return {
          data: [{
            found: true,
            customer_id: 'customer-public-existing',
            customer_name: 'Maria Silva',
            customer_phone: '5592999998888',
            cadastro_completo: true,
            tenant_id: 'tenant-public',
            tenant_name: 'Barbearia Pública',
            tenant_phone: '5592999999999',
            tenant_slug: 'brooklyn',
          }],
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

    // Modal 02: Seleção de Dias da semana
    expect(await screen.findByText(/Selecione o dia da semana desejado/i)).toBeInTheDocument();
    expect(screen.getByText('25/08')).toBeInTheDocument();
    fireEvent.click(screen.getByText('25/08'));

    // Modal 03: Barbeiro e Horários
    expect(await screen.findByText(/Horários disponíveis/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '10:00' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '10:30' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    fireEvent.click(screen.getByRole('button', { name: /Avançar para identificação/i }));

    // Modal 04: Resumo da Comanda
    expect(await screen.findByText(/Resumo do agendamento/i)).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText(/Ex: Jonathas Lopes/i);
    const phoneInput = screen.getByPlaceholderText('(92) 99420-4756');

    fireEvent.change(nameInput, { target: { value: 'Maria Silva' } });
    fireEvent.change(phoneInput, { target: { value: '92999998888' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar agendamento/i }));

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

    expect(await screen.findByText('Barbearia Navalhado')).toBeInTheDocument();
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
    fireEvent.click(await screen.findByText('25/08'));

    expect(await screen.findByText(/Horários disponíveis/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '14:00' }));
    fireEvent.click(screen.getByRole('button', { name: /Avançar para identificação/i }));

    expect(await screen.findByText(/Resumo do agendamento/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Ex: Jonathas Lopes/i);
    const phoneInput = screen.getByPlaceholderText('(92) 99420-4756');

    fireEvent.change(nameInput, { target: { value: 'João' } });
    fireEvent.change(phoneInput, { target: { value: '92999998888' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar agendamento/i }));

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
    fireEvent.click(await screen.findByText('25/08'));

    expect(await screen.findByText(/Horários disponíveis/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '14:00' }));
    fireEvent.click(screen.getByRole('button', { name: /Avançar para identificação/i }));

    expect(await screen.findByText(/Resumo do agendamento/i)).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/Ex: Jonathas Lopes/i);
    const phoneInput = screen.getByPlaceholderText('(92) 99420-4756');

    fireEvent.change(nameInput, { target: { value: 'Maria Silva' } });
    fireEvent.change(phoneInput, { target: { value: '92999998888' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar agendamento/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Agendamento realizado com sucesso!', 'success');
    });
  });
});
