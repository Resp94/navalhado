import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Agenda } from '../gerente/Agenda';

const { mockAddToast, mockNavigate, mockOutletContext, mockAppointmentInsert } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockAppointmentInsert: vi.fn(),
  mockOutletContext: {
    tenantId: 'tenant-123',
    tenantName: 'Barbearia Navalhado',
    logoUrl: null,
    timezone: 'America/Sao_Paulo',
    slotIntervalMinutes: 30,
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
  const mockProfessionals: any[] = [
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
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          neq: () => builder,
          order: vi.fn().mockResolvedValue({ data: mockProfessionals, error: null }),
        };
        return builder;
      }
      if (table === 'services') {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          neq: () => builder,
          order: vi.fn().mockResolvedValue({ data: mockServices, error: null }),
        };
        return builder;
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
      if (table === 'professional_services') {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          then: (resolve: (value: any) => unknown) =>
            Promise.resolve(resolve({ data: [], error: null })),
        };
        return builder;
      }
      if (table === 'appointments') {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          gte: () => builder,
          lt: () => builder,
          neq: () => builder,
          order: vi.fn().mockResolvedValue({ data: mockAppointments, error: null }),
          insert: (payload: any) => {
            mockAppointmentInsert(payload);
            return {
              select: () => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'app-new',
                    ...payload,
                  },
                  error: null,
                }),
              }),
            };
          },
          update: () => {
            const updateBuilder: any = {
              eq: () => updateBuilder,
              in: () => updateBuilder,
              select: () => updateBuilder,
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'app-1' }, error: null }),
              then: (resolve: (value: any) => unknown) =>
                Promise.resolve(resolve({ data: null, error: null })),
            };
            return updateBuilder;
          },
        };
        return builder;
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
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          gte: () => builder,
          lt: () => builder,
          order: vi.fn().mockImplementation(() => Promise.resolve({ data: mockBlockedSlots, error: null })),
          delete: () => ({
            eq: () => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
        return builder;
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

  it('permite abrir o encaixe em dia fechado sem alterar a regra de agendamento normal', async () => {
    mockOutletContext.businessHours.domingo.active = false;

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Novo encaixe rápido/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Marcar como Encaixe de Balcão/i)).toBeChecked();
    });

    mockOutletContext.businessHours.domingo.active = true;
  });

  it('mantém os slots da sexta-feira até 19:30 quando o fechamento está configurado para 20:00', async () => {
    const previousFriday = mockOutletContext.businessHours.sexta;
    mockOutletContext.businessHours.sexta = { active: true, open: '09:00', close: '20:00' };

    render(<Agenda />);
    await waitFor(() => expect(screen.getAllByDisplayValue('2026-08-16').length).toBeGreaterThan(0));

    fireEvent.change(screen.getAllByDisplayValue('2026-08-16')[0], {
      target: { value: '2026-08-21' },
    });

    await waitFor(() => {
      expect(screen.getByText('19:30')).toBeInTheDocument();
    });

    mockOutletContext.businessHours.sexta = previousFriday;
  });

  it('permite marcar atendimento passado como não compareceu e mantém o card visível', async () => {
    const originalStart = mockAppointments[0].start_time;
    const originalEnd = mockAppointments[0].end_time;
    mockAppointments[0].start_time = '2026-08-16T10:00:00.000Z';
    mockAppointments[0].end_time = '2026-08-16T10:30:00.000Z';
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Marcar Pedro Cliente como não compareceu/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Marcar Pedro Cliente como não compareceu/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Confirmar não comparecimento/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sim, não compareceu/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sim, não compareceu/i }));

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('appointments');
      expect(screen.getAllByText('Não compareceu').length).toBeGreaterThan(0);
    });

    mockAppointments[0].start_time = originalStart;
    mockAppointments[0].end_time = originalEnd;
  });

  it('permite salvar encaixe fora do expediente usando o intervalo da grade', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Novo encaixe rápido/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Horário de início/i), {
      target: { value: '22:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar encaixe na agenda/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Encaixe agendado com sucesso!', 'success');
    });
  });

  it('permite salvar encaixe em horário personalizado fora da grade', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Horário personalizado/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Horário personalizado/i }));
    const timeInput = screen.getByLabelText(/Horário de início/i);
    expect(timeInput).toHaveAttribute('type', 'time');
    fireEvent.change(timeInput, { target: { value: '18:10' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar encaixe na agenda/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Encaixe agendado com sucesso!', 'success');
    });
    expect(mockAppointmentInsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-123',
      professional_id: 'prof-1',
      service_id: 'serv-1',
      start_time: '2026-08-16T21:10:00.000Z',
      end_time: '2026-08-16T21:40:00.000Z',
      is_fitting: true,
      origin: 'manual',
    }));
    expect(mockAddToast).not.toHaveBeenCalledWith(
      'Horário de encaixe deve seguir a grade de 30 minutos.',
      'warning'
    );
  });

  it('permite encaixe com profissional ativo fora da escala individual', async () => {
    const originalSchedule = mockProfessionals[0].weekly_schedule;
    mockProfessionals[0].weekly_schedule = {
      sunday: { active: true, start: '08:00', end: '09:00' },
    };

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Novo encaixe rápido/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Horário de início/i), {
      target: { value: '14:00' },
    });
    fireEvent.change(screen.getByLabelText(/Profissional/i), {
      target: { value: 'prof-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar encaixe na agenda/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Encaixe agendado com sucesso!', 'success');
    });

    mockProfessionals[0].weekly_schedule = originalSchedule;
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

  it('exige confirmação no modal antes de remover bloqueio da grade', async () => {
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

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByText('Almoço')).toBeInTheDocument();
    });

    const blockCard = screen.getByText('Almoço').closest('.timeline-blocked-card');
    expect(blockCard).toBeInTheDocument();

    fireEvent.click(blockCard!);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Remover bloqueio/i })).toBeInTheDocument();
    expect(screen.getByText('Almoço', { selector: 'strong' })).toBeInTheDocument();
    expect(mockAddToast).not.toHaveBeenCalledWith('Bloqueio removido com sucesso!', 'success');

    fireEvent.click(screen.getByRole('button', { name: /Sim, excluir/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Bloqueio removido com sucesso!', 'success');
    });
  });

  it('abre o modal de checkout/comanda ao clicar no agendamento e permite acionar reagendamento sem cancelar', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThan(0);
    });

    const clientLabels = screen.getAllByText('Pedro Cliente');
    const appointmentCard = clientLabels.find((el) => el.closest('.timeline-appointment-card'))?.closest('.timeline-appointment-card');
    expect(appointmentCard).toBeInTheDocument();

    fireEvent.click(appointmentCard!);

    await waitFor(() => {
      expect(screen.getByText('Comanda de atendimento')).toBeInTheDocument();
    });
  });

  it('abre o modal direto de reagendamento ao clicar no botão Reagendar do card na agenda', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Reagendar horário/i }).length).toBeGreaterThan(0);
    });

    const rescheduleButtons = screen.getAllByRole('button', { name: /Reagendar horário/i });
    fireEvent.click(rescheduleButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Reagendar horário de/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Confirmar Reagendamento/i })).toBeInTheDocument();
    });
  });
});
