import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agenda } from '../gerente/Agenda';

const { mockAddToast, mockNavigate, mockOutletContext } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockOutletContext: {
    tenantId: 'tenant-123',
    tenantName: 'Barbearia Navalhado',
    logoUrl: null,
    timezone: 'America/Sao_Paulo',
    onboardingCompleted: true,
    businessHours: {
      segunda: { active: true, open: '08:00', close: '20:00' },
      terca: { active: true, open: '08:00', close: '20:00' },
      quarta: { active: true, open: '08:00', close: '20:00' },
      quinta: { active: true, open: '08:00', close: '20:00' },
      sexta: { active: true, open: '08:00', close: '20:00' },
      sabado: { active: true, open: '08:00', close: '20:00' },
      domingo: { active: true, open: '08:00', close: '20:00' },
    },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => mockOutletContext,
  };
});

vi.mock('../../components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}));

const mockFrom = vi.fn();
const mockChannel = vi.fn().mockReturnValue({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    channel: (...args: any[]) => mockChannel(...args),
    removeChannel: vi.fn(),
  },
}));

describe('Página de Agenda do Gerente (Grade Temporal)', () => {
  const mockProfessionals = [
    { id: 'prof-1', name: 'Carlos Barbeiro', is_active: true, phone: '11999990001' },
    { id: 'prof-2', name: 'Marcos Navalha', is_active: true, phone: '11999990002' },
  ];

  const mockServices = [
    { id: 'serv-1', name: 'Corte Tradicional', price: 45.0, duration_minutes: 30 },
    { id: 'serv-2', name: 'Barba Completa', price: 35.0, duration_minutes: 30 },
  ];

  const mockCustomers = [
    { id: 'cust-1', name: 'Pedro Cliente', phone: '11988887777' },
  ];

  const mockAppointments = [
    {
      id: 'app-1',
      start_time: '2026-08-15T12:00:00.000Z', // 09:00 no fuso America/Sao_Paulo (UTC-3)
      end_time: '2026-08-15T12:30:00.000Z',
      status: 'confirmed',
      payment_status: 'pending',
      is_fitting: false,
      notes: 'Cliente prefere tesoura',
      origin: 'whatsapp',
      professional_id: 'prof-1',
      customer_id: 'cust-1',
      customer: mockCustomers[0],
      service: mockServices[0],
      professional: mockProfessionals[0],
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z')); // 09:00 em SP
    vi.clearAllMocks();
    mockOutletContext.businessHours.domingo.active = true;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'professionals') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: vi.fn().mockResolvedValue({ data: mockProfessionals, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'services') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: vi.fn().mockResolvedValue({ data: mockServices, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({
              order: vi.fn().mockResolvedValue({ data: mockCustomers, error: null }),
            }),
          }),
          insert: (payload: any) => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'cust-new',
                  name: payload.name,
                  phone: payload.phone,
                  cadastro_completo: payload.cadastro_completo,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'appointments') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({
                  neq: () => ({
                    order: vi.fn().mockResolvedValue({ data: mockAppointments, error: null }),
                  }),
                }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'blocked_slots') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });
  });

  it('renderiza o cabeçalho operacional com o botão mestre + Encaixe e profissionais', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Encaixe/i })).toBeInTheDocument();
      expect(screen.getByText('Carlos Barbeiro')).toBeInTheDocument();
      expect(screen.getByText('Marcos Navalha')).toBeInTheDocument();
    });
  });

  it('exibe o card de agendamento na coluna do profissional correspondente com badges e ações', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByText('Pedro Cliente')).toBeInTheDocument();
      expect(screen.getByText(/Corte Tradicional/i)).toBeInTheDocument();
      expect(screen.getByText(/Cliente prefere tesoura/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cobrar/i })).toBeInTheDocument();
      expect(screen.getByTitle(/WhatsApp/i)).toBeInTheDocument();
    });
  });

  it('abre o modal de encaixe rápido com a flag ativa ao clicar no botão + Encaixe', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Encaixe/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Encaixe/i }));

    await waitFor(() => {
      expect(screen.getByText(/Novo encaixe rápido/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Marcar como Encaixe de Balcão/i)).toBeChecked();
    });
  });

  it('filtra a exibição de profissionais quando desmarcado no menu de equipe', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByText('Carlos Barbeiro')).toBeInTheDocument();
    });

    const filterBtn = screen.getByRole('button', { name: /Equipe/i });
    fireEvent.click(filterBtn);

    const carlosCheckbox = screen.getByLabelText('Carlos Barbeiro');
    fireEvent.click(carlosCheckbox); // Desmarca Carlos

    await waitFor(() => {
      expect(screen.queryByTestId('prof-col-prof-1')).not.toBeInTheDocument();
      expect(screen.getByTestId('prof-col-prof-2')).toBeInTheDocument();
    });
  });

  it('permite cadastrar novo cliente provisório diretamente pelo modal de encaixe', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Encaixe/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Encaixe/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cliente rápido de balcão/i })).toBeInTheDocument();
    });

    // Ajustar horário para 14:00 para garantir que seja futuro no dia de teste e dentro do expediente
    const timeInput = screen.getByLabelText(/Horário/i);
    fireEvent.change(timeInput, { target: { value: '14:00' } });

    fireEvent.click(screen.getByRole('button', { name: /Cliente rápido de balcão/i }));

    const nameInput = screen.getByLabelText(/Nome do cliente/i);
    const phoneInput = screen.getByLabelText(/WhatsApp ou celular/i);

    fireEvent.change(nameInput, { target: { value: 'Cliente Balcão Teste' } });
    fireEvent.change(phoneInput, { target: { value: '11977776666' } });

    const submitBtn = screen.getByRole('button', { name: /Confirmar/i });
    fireEvent.click(submitBtn);


    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'Encaixe agendado com sucesso!',
        'success'
      );
    });
  });

  it('bloqueia clique e agendamento em dia fechado de acordo com businessHours', async () => {
    mockOutletContext.businessHours.domingo.active = false;

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Encaixe/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Encaixe/i }));

    expect(mockAddToast).toHaveBeenCalledWith(
      'A barbearia não abre neste dia conforme as configurações de funcionamento.',
      'warning'
    );

    mockOutletContext.businessHours.domingo.active = true;
  });
});
