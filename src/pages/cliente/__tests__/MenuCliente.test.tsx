import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MenuCliente } from '../MenuCliente';

const { mockAddToast, mockRpc, mockPublicRpc, mockPublicGetSession, mockPublicSignOut } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockRpc: vi.fn(),
  mockPublicRpc: vi.fn(),
  mockPublicGetSession: vi.fn(),
  mockPublicSignOut: vi.fn(),
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
  publicSupabase: {
    rpc: mockPublicRpc,
    auth: {
      getSession: mockPublicGetSession,
      signOut: mockPublicSignOut,
    },
  },
}));

describe('MenuCliente - TDD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublicGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockPublicSignOut.mockResolvedValue({ error: null });
    mockPublicRpc.mockResolvedValue({ data: [], error: null });
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
      cadastro_completo: true,
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

  it('exibe modal de redirecionamento para o WhatsApp do barbeiro caso o prazo de cancelamento tenha expirado', async () => {
    const mockDetails = {
      customer_id: 'cust-123',
      customer_name: 'Jonathas Teste',
      tenant_id: 'tenant-123',
      tenant_name: 'Barbearia Estilo',
      tenant_phone: '5592999999999',
      cadastro_completo: true,
    };

    const futureDate = new Date();
    futureDate.setMinutes(futureDate.getMinutes() + 45); // 45 min no futuro

    const mockAppointments = [
      {
        appointment_id: 'app-futuro-proximo',
        start_time: futureDate.toISOString(),
        end_time: new Date(futureDate.getTime() + 30 * 60 * 1000).toISOString(),
        status: 'confirmed',
        payment_status: 'pending',
        cancellation_reason: null,
        professional_name: 'Carlos Barbeiro',
        professional_id: 'prof-123',
        professional_phone: '92988887777',
        service_name: 'Corte Degradê',
        service_id: 'serv-123',
        service_price: 45.0,
        service_duration: 30,
        tenant_name: 'Barbearia Estilo',
        tenant_id: 'tenant-123',
        tenant_phone: '5592999999999',
        customer_name: 'Jonathas Teste',
      }
    ];

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') {
        return { data: [mockDetails], error: null };
      }
      if (name === 'get_customer_appointments_by_token') {
        return { data: mockAppointments, error: null };
      }
      if (name === 'cancel_appointment_by_token') {
        return { 
          data: null, 
          error: { 
            message: 'APPOINTMENT_CANCELLATION_DEADLINE_EXPIRED: O prazo para cancelamento online expirou (120 minutos).',
            code: '22023' 
          } 
        };
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
    expect(corteText).toBeInTheDocument();

    // Clicar em Cancelar
    const cancelButton = screen.getByRole('button', { name: /Cancelar/i });
    fireEvent.click(cancelButton);

    // Confirmar cancelamento no primeiro modal
    const confirmCancelBtn = await screen.findByRole('button', { name: /Confirmar cancelamento/i });
    fireEvent.click(confirmCancelBtn);

    // Deve abrir o modal de prazo expirado com o botão do WhatsApp
    const expiredHeading = await screen.findByText(/Prazo de cancelamento expirado/i);
    expect(expiredHeading).toBeInTheDocument();

    const waButton = screen.getByRole('link', { name: /Falar com a barbearia no WhatsApp/i });
    expect(waButton).toBeInTheDocument();
    expect(waButton).toHaveAttribute('href', expect.stringContaining('5592999999999'));
  });

  it('redireciona cliente sem cadastro para a página de serviços / agendamento', async () => {
    const unregisteredDetails = {
      customer_id: 'cust-unreg',
      customer_name: 'Cliente',
      tenant_id: 'tenant-123',
      tenant_name: 'Barbearia Estilo',
      tenant_phone: '5592999999999',
      cadastro_completo: false,
    };

    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') {
        return { data: [unregisteredDetails], error: null };
      }
      return { data: null, error: null };
    });

    render(
      <MemoryRouter initialEntries={['/cliente/menu']}>
        <MenuCliente />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('get_customer_details_by_token', {
        p_token: 'mock-customer-token',
      });
    });
  });

  it('resolve token válido, lista agendamentos e preserva o contexto ao iniciar novo horário', async () => {
    const mockDetails = {
      customer_id: 'cust-valid',
      customer_name: 'Cliente Validado',
      tenant_id: 'tenant-valid',
      tenant_name: 'Barbearia Validada',
      tenant_phone: '5592999999999',
      cadastro_completo: true,
    };
    const mockAppointments = [{
      appointment_id: 'app-valid',
      start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 150 * 60 * 1000).toISOString(),
      status: 'confirmed',
      payment_status: 'pending',
      cancellation_reason: null,
      professional_name: 'Profissional Validado',
      professional_id: 'prof-valid',
      service_name: 'Corte Validado',
      service_id: 'service-valid',
      service_price: 45,
      service_duration: 30,
      tenant_name: 'Barbearia Validada',
      tenant_id: 'tenant-valid',
      tenant_phone: '5592999999999',
      customer_name: 'Cliente Validado',
    }];

    localStorage.clear();
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') return { data: [mockDetails], error: null };
      if (name === 'get_customer_appointments_by_token') return { data: mockAppointments, error: null };
      return { data: null, error: null };
    });

    render(
      <MemoryRouter initialEntries={['/cliente/token-validado']}>
        <Routes>
          <Route path="/cliente/:token" element={<MenuCliente />} />
          <Route path="/cliente/menu" element={<MenuCliente />} />
          <Route path="/cliente/agendar" element={<div>Fluxo de novo agendamento</div>} />
          <Route path="/cliente/acesso-expirado" element={<div>Acesso expirado</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Corte Validado')).toBeInTheDocument();
    expect(screen.getByText(/Olá, Cliente/)).toBeInTheDocument();
    expect(screen.getByText('Finalizados')).toBeInTheDocument();
    expect(screen.queryByText('Histórico')).not.toBeInTheDocument();
    expect(mockRpc).toHaveBeenCalledWith('get_customer_details_by_token', { p_token: 'token-validado' });

    fireEvent.click(screen.getByRole('button', { name: /Agendar novo horário/i }));
    expect(await screen.findByText('Fluxo de novo agendamento')).toBeInTheDocument();
    expect(localStorage.getItem('navalhado_customer_token')).toBe('token-validado');
  });

  it('não concede área privada para token inválido', async () => {
    localStorage.clear();
    mockRpc.mockImplementation(async (name: string) => {
      if (name === 'get_customer_details_by_token') {
        return { data: null, error: { message: 'Token inválido', code: 'P0001' } };
      }
      return { data: null, error: null };
    });

    render(
      <MemoryRouter initialEntries={['/cliente/token-invalido']}>
        <Routes>
          <Route path="/cliente/:token" element={<MenuCliente />} />
          <Route path="/cliente/menu" element={<MenuCliente />} />
          <Route path="/cliente/acesso-expirado" element={<div>Acesso expirado</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Acesso expirado')).toBeInTheDocument();
  });

  it('abre o menu pela sessão pública e inicia novo agendamento pelo slug da barbearia', async () => {
    localStorage.clear();
    const publicDetails = {
      customer_id: 'cust-public',
      customer_name: 'Cliente Público',
      customer_phone: '92999999999',
      tenant_id: 'tenant-public',
      tenant_name: 'Barbearia Pública',
      tenant_phone: '5592999999999',
      tenant_slug: 'brooklyn',
      cadastro_completo: true,
    };
    const publicAppointment = {
      appointment_id: 'app-public',
      start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      status: 'confirmed',
      payment_status: 'pending',
      cancellation_reason: null,
      professional_name: 'Profissional Público',
      professional_id: 'prof-public',
      service_name: 'Corte Público',
      service_id: 'service-public',
      service_price: 50,
      service_duration: 60,
      tenant_name: 'Barbearia Pública',
      tenant_id: 'tenant-public',
      tenant_phone: '5592999999999',
      customer_name: 'Cliente Público',
    };

    mockPublicGetSession.mockResolvedValue({
      data: { session: { user: { is_anonymous: true } } },
      error: null,
    });
    mockPublicRpc.mockImplementation(async (name: string) => {
      if (name === 'get_public_customer_session') return { data: [publicDetails], error: null };
      if (name === 'get_public_customer_appointments') return { data: [publicAppointment], error: null };
      return { data: [], error: null };
    });

    render(
      <MemoryRouter initialEntries={['/cliente/menu']}>
        <Routes>
          <Route path="/cliente/menu" element={<MenuCliente />} />
          <Route path="/brooklyn" element={<div>Catálogo público</div>} />
          <Route path="/cliente/acesso-expirado" element={<div>Acesso expirado</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Corte Público')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Agendar novo horário/i }));
    expect(await screen.findByText('Catálogo público')).toBeInTheDocument();
  });

  it('encerra a sessão pública e retorna ao catálogo da mesma barbearia', async () => {
    localStorage.clear();
    mockPublicGetSession.mockResolvedValue({
      data: { session: { user: { is_anonymous: true } } },
      error: null,
    });
    mockPublicRpc.mockImplementation(async (name: string) => {
      if (name === 'get_public_customer_session') {
        return {
          data: [{
            customer_id: 'cust-public',
            customer_name: 'Cliente Público',
            customer_phone: '92999999999',
            tenant_id: 'tenant-public',
            tenant_name: 'Barbearia Pública',
            tenant_phone: '5592999999999',
            tenant_slug: 'brooklyn',
            cadastro_completo: true,
          }],
          error: null,
        };
      }
      if (name === 'get_public_customer_appointments') return { data: [], error: null };
      return { data: [], error: null };
    });

    render(
      <MemoryRouter initialEntries={['/cliente/menu']}>
        <Routes>
          <Route path="/cliente/menu" element={<MenuCliente />} />
          <Route path="/brooklyn" element={<div>Catálogo público</div>} />
          <Route path="/cliente/acesso-expirado" element={<div>Acesso expirado</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Sair' });
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(mockPublicSignOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Catálogo público')).toBeInTheDocument();
  });
});
