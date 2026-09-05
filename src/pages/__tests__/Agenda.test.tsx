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
      expect(screen.queryByText(/Cliente prefere tesoura/i)).toBeNull();
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
    try {
      render(<Agenda />);

      await waitFor(() => {
        expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThan(0);
      });

      const appointmentCard = screen
        .getAllByText('Pedro Cliente')
        .find((element) => element.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card');
      expect(appointmentCard).toBeInTheDocument();
      fireEvent.click(appointmentCard!);

      await waitFor(() => {
        expect(screen.getByText('Comanda de atendimento')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Marcar atendimento como não compareceu/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Marcar atendimento como não compareceu/i }));

      await waitFor(() => {
        expect(screen.getByText(/Confirmar não comparecimento/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sim, não compareceu/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Sim, não compareceu/i }));

      await waitFor(() => {
        expect(mockFrom).toHaveBeenCalledWith('appointments');
        expect(screen.getAllByText('Não compareceu').length).toBeGreaterThan(0);
      });
    } finally {
      mockAppointments[0].start_time = originalStart;
      mockAppointments[0].end_time = originalEnd;
    }
  });

  it('permite salvar encaixe personalizado fora do expediente', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Novo encaixe rápido/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('switch', { name: /Alternar entre horário da grade e personalizado/i }));
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

    const modeSwitch = screen.getByRole('switch', { name: /Alternar entre horário da grade e personalizado/i });
    expect(modeSwitch).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(modeSwitch);
    expect(modeSwitch).toHaveAttribute('aria-checked', 'true');
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

  it('usa a escala do profissional para sugerir a grade do encaixe', async () => {
    const originalInterval = mockOutletContext.slotIntervalMinutes;
    const originalSchedule = mockProfessionals[0].weekly_schedule;
    mockOutletContext.slotIntervalMinutes = 40;
    mockProfessionals[0].weekly_schedule = {
      sunday: { active: true, start: '09:00', end: '19:00', break_start: '12:00', break_end: '14:00' },
    };

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: '09:00' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '14:00' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('option', { name: '09:20' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '13:20' })).not.toBeInTheDocument();

    mockOutletContext.slotIntervalMinutes = originalInterval;
    mockProfessionals[0].weekly_schedule = originalSchedule;
  });

  it('salva um encaixe pela grade quando o slot reinicia no retorno do intervalo', async () => {
    const originalInterval = mockOutletContext.slotIntervalMinutes;
    const originalSchedule = mockProfessionals[0].weekly_schedule;
    mockOutletContext.slotIntervalMinutes = 40;
    mockProfessionals[0].weekly_schedule = {
      sunday: { active: true, start: '09:00', end: '19:00', break_start: '13:00', break_end: '15:00' },
    };

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: '17:40' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Horário de início/i), {
      target: { value: '17:40' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar encaixe na agenda/i }));

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Encaixe agendado com sucesso!', 'success');
    });

    mockOutletContext.slotIntervalMinutes = originalInterval;
    mockProfessionals[0].weekly_schedule = originalSchedule;
  });

  it('não oferece no agendamento normal um slot que não comporta a duração até o fechamento', async () => {
    const originalInterval = mockOutletContext.slotIntervalMinutes;
    const originalClose = mockOutletContext.businessHours.domingo.close;
    const originalSchedule = mockProfessionals[0].weekly_schedule;
    const originalDuration = mockServices[0].duration_minutes;

    mockOutletContext.slotIntervalMinutes = 40;
    mockOutletContext.businessHours.domingo.close = '19:00';
    mockProfessionals[0].weekly_schedule = {
      sunday: { active: true, start: '09:00', end: '19:00', break_start: '12:00', break_end: '14:00' },
    };
    mockServices[0].duration_minutes = 40;

    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByTestId('slot-cell-prof-1-18:40')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('slot-cell-prof-1-18:40'));

    await waitFor(() => {
      expect(screen.getByText('Novo agendamento')).toBeInTheDocument();
    });

    expect(screen.queryByRole('option', { name: '18:40' })).not.toBeInTheDocument();

    mockOutletContext.slotIntervalMinutes = originalInterval;
    mockOutletContext.businessHours.domingo.close = originalClose;
    mockProfessionals[0].weekly_schedule = originalSchedule;
    mockServices[0].duration_minutes = originalDuration;
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

    fireEvent.click(screen.getByRole('switch', { name: /Alternar entre horário da grade e personalizado/i }));
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

  it('não renderiza ações rápidas dentro dos cards da agenda', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThan(0);
    });

    const cards = screen
      .getAllByText('Pedro Cliente')
      .map((element) => element.closest('.timeline-appointment-card'))
      .filter(Boolean);
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card?.querySelector('.card-quick-actions-right')).toBeNull();
      expect(card?.querySelector('.card-quick-no-show-btn')).toBeNull();
      expect(card?.querySelector('.card-quick-reagendar-btn')).toBeNull();
    });
  });

  it('mantém o card normal livre de ações rápidas no topo', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThan(0);
    });

    const clientLabels = screen.getAllByText('Pedro Cliente');
    const card = clientLabels
      .find((el) => el.closest('.timeline-appointment-card'))
      ?.closest('.timeline-appointment-card');
    expect(card).toBeInTheDocument();

    const topRow = card!.querySelector('.card-top-row');
    expect(topRow).toBeInTheDocument();
    expect(topRow!.querySelector('.card-quick-actions-right')).toBeNull();
    expect(topRow!.querySelector('.card-quick-reagendar-btn')).toBeNull();

    const clientRow = card!.querySelector('.card-client-row');
    expect(clientRow).toBeInTheDocument();
    expect(clientRow!.querySelector('.card-quick-actions-right')).toBeNull();
  });

  it('mantém o card de encaixe livre de ações rápidas na linha inferior', async () => {
    const originalAppointments = [...mockAppointments];
    mockAppointments[0] = {
      ...mockAppointments[0],
      is_fitting: true,
    };

    try {
      render(<Agenda />);

      await waitFor(() => {
        expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThan(0);
      });

      const clientLabels = screen.getAllByText('Pedro Cliente');
      const card = clientLabels
        .find((el) => el.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card');
      expect(card).toBeInTheDocument();

      const topRow = card!.querySelector('.card-top-row');
      expect(topRow).toBeInTheDocument();
      expect(topRow!.querySelector('.badge-chip--fitting')).toBeInTheDocument();
      expect(topRow!.querySelector('.card-quick-actions-right')).toBeNull();

      const clientRow = card!.querySelector('.card-client-row');
      expect(clientRow).toBeInTheDocument();
      expect(clientRow!.querySelector('.card-quick-actions-right')).toBeNull();
      expect(clientRow!.querySelector('.card-quick-reagendar-btn')).toBeNull();
    } finally {
      mockAppointments[0] = originalAppointments[0];
    }
  });

  it('aplica layout horizontal percentual no dia para card solo e slot dividido com encaixe', async () => {
    const originalAppointments = [...mockAppointments];
    mockAppointments[0] = {
      ...mockAppointments[0],
      id: 'app-regular',
      start_time: '2026-08-16T12:00:00.000Z', // 09:00 em SP
      end_time: '2026-08-16T12:30:00.000Z',
      is_fitting: false,
    };
    mockAppointments[1] = {
      ...mockAppointments[0],
      id: 'app-fitting',
      customer_id: 'cust-2',
      customer: { name: 'Cliente Encaixe', phone: '11999999992' },
      start_time: '2026-08-16T12:00:00.000Z', // 09:00 em SP
      end_time: '2026-08-16T12:30:00.000Z',
      is_fitting: true,
    };
    mockAppointments[2] = {
      ...mockAppointments[0],
      id: 'app-solo',
      customer_id: 'cust-3',
      customer: { name: 'Cliente Solo', phone: '11999999993' },
      start_time: '2026-08-16T13:00:00.000Z', // 10:00 em SP
      end_time: '2026-08-16T13:30:00.000Z',
      is_fitting: false,
    };

    try {
      render(<Agenda />);

      await waitFor(() => {
        expect(screen.getAllByText('Cliente Solo').length).toBeGreaterThan(0);
      });

      const soloCard = screen
        .getAllByText('Cliente Solo')
        .find((el) => el.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card') as HTMLElement;
      expect(soloCard).toBeInTheDocument();
      expect(soloCard.style.width).toBe('calc(100% - 8px)');
      expect(soloCard.style.height).toBe('69px');
      expect(soloCard.style.left).toBe('4px');

      const regularCard = screen
        .getAllByText('Pedro Cliente')
        .find((el) => el.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card') as HTMLElement;
      expect(regularCard).toBeInTheDocument();
      expect(regularCard.style.width).toBe('calc(50% - 8px)');
      expect(regularCard.style.height).toBe('69px');
      expect(regularCard.style.left).toBe('4px');

      const fittingCard = screen
        .getAllByText('Cliente Encaixe')
        .find((el) => el.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card') as HTMLElement;
      expect(fittingCard).toBeInTheDocument();
      expect(fittingCard.style.width).toBe('calc(50% - 8px)');
      expect(fittingCard.style.height).toBe('69px');
      expect(fittingCard.style.left).toBe('calc(50% + 4px)');
      expect(fittingCard.style.top).toBe(regularCard.style.top);
      expect(parseInt(soloCard.style.top)).toBeGreaterThan(parseInt(regularCard.style.top));
    } finally {
      mockAppointments.length = 0;
      mockAppointments.push(...originalAppointments);
    }
  });

  it('desabilita opção de agendamento e encaixe em slot que já possui agendamento ou encaixe', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getByTestId('slot-cell-prof-1-09:00')).toBeInTheDocument();
    });

    const occupiedSlot = screen.getByTestId('slot-cell-prof-1-09:00');
    expect(occupiedSlot).toHaveClass('grid-slot-cell--occupied');
    expect(occupiedSlot).toHaveAttribute('title', expect.stringContaining('Horário ocupado'));
    expect(occupiedSlot.querySelector('.slot-hover-text')).toBeNull();

    // Clicar no slot ocupado não deve abrir o modal de novo agendamento
    fireEvent.click(occupiedSlot);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('distribui três compromissos sobrepostos em faixas percentuais sem largura fixa', async () => {
    const originalAppointments = [...mockAppointments];
    const overlappingAppointments = [
      ['three-app-a', 'Cliente Sobreposto A'],
      ['three-app-b', 'Cliente Sobreposto B'],
      ['three-app-c', 'Cliente Sobreposto C'],
    ];

    overlappingAppointments.forEach(([id, customerName], index) => {
      mockAppointments[index] = {
        ...mockAppointments[0],
        id,
        customer_id: `cust-three-${index}`,
        customer: { id: `cust-three-${index}`, name: customerName, phone: `1199999999${index}` },
        start_time: '2026-08-16T12:00:00.000Z', // 09:00 em SP
        end_time: '2026-08-16T12:30:00.000Z',
        is_fitting: false,
      };
    });

    try {
      render(<Agenda />);

      await waitFor(() => {
        expect(screen.getAllByText('Cliente Sobreposto A').length).toBeGreaterThan(0);
      });

      const cards = overlappingAppointments.map(([, customerName]) => {
        const card = screen
          .getAllByText(customerName)
          .find((el) => el.closest('.timeline-appointment-card'))
          ?.closest('.timeline-appointment-card') as HTMLElement;
        expect(card).toBeInTheDocument();
        return card;
      });

      expect(cards.map((card) => card.style.left)).toEqual([
        '4px',
        'calc(33.333% + 4px)',
        'calc(66.667% + 4px)',
      ]);
      expect(cards.map((card) => card.style.width)).toEqual([
        'calc(33.333% - 8px)',
        'calc(33.333% - 8px)',
        'calc(33.333% - 8px)',
      ]);
      expect(cards.every((card) => !/^\d+px$/.test(card.style.width))).toBe(true);
      expect(cards.map((card) => card.style.top)).toEqual([
        cards[0].style.top,
        cards[0].style.top,
        cards[0].style.top,
      ]);
      expect(cards.map((card) => card.style.height)).toEqual(['69px', '69px', '69px']);
    } finally {
      mockAppointments.length = 0;
      mockAppointments.push(...originalAppointments);
    }
  });

  it('aplica largura de 463px para agendamento individual e 231px quando divide slot com encaixe na visão semanal', async () => {
    const originalAppointments = [...mockAppointments];
    mockAppointments[0] = {
      ...mockAppointments[0],
      id: 'week-app-regular',
      start_time: '2026-08-16T13:00:00.000Z', // 10:00 em SP
      end_time: '2026-08-16T13:30:00.000Z',
      is_fitting: false,
    };
    mockAppointments[1] = {
      ...mockAppointments[0],
      id: 'week-app-fitting',
      customer_id: 'cust-week-2',
      customer: { name: 'Cliente Semana Encaixe', phone: '11999999992' },
      start_time: '2026-08-16T13:00:00.000Z', // 10:00 em SP
      end_time: '2026-08-16T13:30:00.000Z',
      is_fitting: true,
    };
    mockAppointments[2] = {
      ...mockAppointments[0],
      id: 'week-app-solo',
      customer_id: 'cust-week-3',
      customer: { name: 'Cliente Semana Solo', phone: '11999999993' },
      start_time: '2026-08-16T14:00:00.000Z', // 11:00 em SP
      end_time: '2026-08-16T14:30:00.000Z',
      is_fitting: false,
    };

    try {
      render(<Agenda />);

      // Alternar para a visão semanal
      const weekBtn = screen.getByText('Semana');
      fireEvent.click(weekBtn);

      await waitFor(
        () => {
          const cards = document.querySelectorAll('.timeline-appointment-card');
          expect(cards.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );

      const soloCard = screen
        .getAllByText('Cliente Semana Solo')
        .find((el) => el.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card') as HTMLElement;
      expect(soloCard).toBeInTheDocument();
      expect(soloCard.style.width).toBe('463px');
      expect(soloCard.style.height).toBe('69px');
      expect(soloCard.style.left).toBe('5px');

      const regularCard = screen
        .getAllByText('Pedro Cliente')
        .find((el) => el.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card') as HTMLElement;
      expect(regularCard).toBeInTheDocument();
      expect(regularCard.style.width).toBe('231px');
      expect(regularCard.style.height).toBe('69px');
      expect(regularCard.style.left).toBe('3px');

      const fittingCard = screen
        .getAllByText('Cliente Semana Encaixe')
        .find((el) => el.closest('.timeline-appointment-card'))
        ?.closest('.timeline-appointment-card') as HTMLElement;
      expect(fittingCard).toBeInTheDocument();
      expect(fittingCard.style.width).toBe('231px');
      expect(fittingCard.style.height).toBe('69px');
      expect(fittingCard.style.left).toBe('239px');
      expect(fittingCard.style.top).toBe(regularCard.style.top);
    } finally {
      mockAppointments.length = 0;
      mockAppointments.push(...originalAppointments);
    }
  });

  it('mantém o botão de filtro de equipe idêntico ao alternar de dia para semana e permite alternar o profissional', async () => {
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Barbeiro').length).toBeGreaterThanOrEqual(1);
    });

    // Na visão de dia, o botão de equipe existe com título e classe corretos
    const dayFilterBtn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    expect(dayFilterBtn).toBeInTheDocument();
    expect(dayFilterBtn).toHaveClass('btn-agenda-filter');
    expect(dayFilterBtn).toHaveTextContent(/Equipe \(\s*2\s*\)/i);

    // Alternar para a visão semanal
    const weekBtn = screen.getByRole('button', { name: 'Semana' });
    fireEvent.click(weekBtn);

    // Na visão semanal, o botão de equipe NÃO deve virar um <select>, deve permanecer o mesmo botão
    const weekFilterBtn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    expect(weekFilterBtn).toBeInTheDocument();
    expect(weekFilterBtn).toHaveClass('btn-agenda-filter');
    expect(document.querySelector('.agenda-week-prof-select')).toBeNull();

    // Clicar no botão para abrir o dropdown de seleção na semana
    fireEvent.click(weekFilterBtn);

    // Deve abrir o dropdown com opção dos profissionais com checkbox
    expect(screen.getByRole('dialog', { name: /Filtrar Barbeiros da Equipe/i })).toBeInTheDocument();
    const carlosCheckbox = screen.getByLabelText('Carlos Barbeiro');
    const marcosCheckbox = screen.getByLabelText('Marcos Navalha');
    expect(carlosCheckbox).toBeChecked();
    expect(marcosCheckbox).toBeChecked();

    // Desmarcar Marcos Navalha -> fica apenas Carlos selecionado
    fireEvent.click(marcosCheckbox);
    expect(marcosCheckbox).not.toBeChecked();

    // A visão semanal deve refletir apenas Carlos Barbeiro no subtítulo
    await waitFor(() => {
      expect(screen.getByText(/Visão semanal do profissional Carlos Barbeiro/i)).toBeInTheDocument();
    });

    // Desmarcar Carlos Barbeiro -> 0 selecionados, deve exibir o mesmo empty state do dia
    fireEvent.click(carlosCheckbox);
    await waitFor(() => {
      expect(screen.getByText('Nenhum profissional selecionado')).toBeInTheDocument();
      expect(screen.getByText(/Ative ao menos um profissional no filtro acima/i)).toBeInTheDocument();
    });

    // Clicar em "Exibir Todos" no empty state da semana deve restaurar todos os profissionais
    const exibirTodosBtn = screen.getByRole('button', { name: /Exibir Todos/i });
    fireEvent.click(exibirTodosBtn);
    await waitFor(() => {
      expect(screen.queryByText('Nenhum profissional selecionado')).toBeNull();
      expect(screen.getByText(/Visão semanal de 2 profissional\(is\)/i)).toBeInTheDocument();
    });
  });
});

