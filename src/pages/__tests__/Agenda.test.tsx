import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
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
    useLocation: () => ({ state: null, pathname: '/agenda' }),
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
      start_time: '2026-08-16T12:00:00.000Z', // 09:00 no fuso America/Sao_Paulo (UTC-3)
      end_time: '2026-08-16T12:30:00.000Z',
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

  let mockBlockedSlots: any[] = [];

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z')); // 09:00 em SP
    vi.clearAllMocks();
    mockBlockedSlots = [];
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
          insert: (payload: any) => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'app-new',
                  ...payload,
                },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'comandas') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: vi.fn().mockResolvedValue({
                data: { id: 'cmd-new' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'comanda_itens') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'blocked_slots') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({
                  order: vi.fn().mockResolvedValue({ data: mockBlockedSlots, error: null }),
                }),
              }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn(), insert: vi.fn(), delete: vi.fn() };
    });
  });

  it('renderiza o cabeçalho operacional com o botão mestre + Encaixe e profissionais', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
      expect(screen.getAllByText('Carlos Barbeiro').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Marcos Navalha').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('exibe o card de agendamento na coluna do profissional correspondente com dados do serviço', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Corte Tradicional/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Cliente prefere tesoura/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('abre o modal de encaixe rápido com a flag ativa ao clicar no botão + Encaixe', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Novo encaixe rápido/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Marcar como Encaixe de Balcão/i)).toBeChecked();
    });
  });

  it('filtra a exibição de profissionais quando desmarcado no menu de equipe', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Barbeiro').length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Novo cadastro/i })).toBeInTheDocument();
    });

    // Ajustar horário para 14:00 para garantir que seja futuro no dia de teste e dentro do expediente
    const timeInput = screen.getByLabelText(/Horário de início/i);
    fireEvent.change(timeInput, { target: { value: '14:00' } });

    fireEvent.click(screen.getByRole('button', { name: /Novo cadastro/i }));

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

  it('permite realizar encaixe de balcão sem cadastro ou seleção de cliente (customerMode = none)', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sem cadastro \(Balcão\)/i })).toBeInTheDocument();
    });

    // Selecionar modo sem cadastro
    fireEvent.click(screen.getByRole('button', { name: /Sem cadastro \(Balcão\)/i }));

    // Ajustar horário para 14:00
    const timeInput = screen.getByLabelText(/Horário de início/i);
    fireEvent.change(timeInput, { target: { value: '14:00' } });

    expect(screen.getByText(/Atendimento avulso de balcão sem identificação de cliente/i)).toBeInTheDocument();

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
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    expect(mockAddToast).toHaveBeenCalledWith(
      'A barbearia não abre neste dia conforme as configurações de funcionamento.',
      'warning'
    );

    mockOutletContext.businessHours.domingo.active = true;
  });

  it('abre o modal de bloqueio de horários ao clicar no botão Bloquear no cabeçalho', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Bloquear/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Bloquear/i }));

    await waitFor(() => {
      expect(screen.getByText(/Bloquear horário/i)).toBeInTheDocument();
    });
  });

  it('exibe bloqueio de horário na grade e remove ao confirmar clique no card de bloqueio', async () => {
    mockBlockedSlots = [
      {
        id: 'blk-1',
        tenant_id: 'tenant-123',
        professional_id: 'prof-1',
        start_time: '2026-08-16T15:00:00.000Z', // 12:00 em SP
        end_time: '2026-08-16T16:00:00.000Z', // 13:00 em SP
        reason: 'Almoço',
        is_all_day: false,
      },
    ];

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByText('Almoço')).toBeInTheDocument();
    });

    const blockCard = screen.getByText('Almoço').closest('.timeline-blocked-card');
    expect(blockCard).toBeInTheDocument();

    fireEvent.click(blockCard!);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Almoço'));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Bloqueio removido com sucesso!', 'success');
    });

    confirmSpy.mockRestore();
  });
});
