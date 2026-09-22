import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Agenda } from '../gerente/Agenda';

const { mockAddToast, mockNavigate, mockOutletContext, mockRpc } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockNavigate: vi.fn(),
  mockRpc: vi.fn(),
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
    rpc: (...args: any[]) => mockRpc(...args),
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
  let mockCanceledAppointments: any[] = [];
  let mockAppointmentsFail = false;
  let mockBlockedSlotsFail = false;

  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-16T12:00:00.000Z')); // 09:00 em SP
    vi.clearAllMocks();
    mockBlockedSlots = [];
    mockCanceledAppointments = [];
    mockAppointmentsFail = false;
    mockBlockedSlotsFail = false;
    mockOutletContext.businessHours.domingo.active = true;
    // A criação de agendamento é uma RPC do banco (AgendaRepository.criarAgendamento).
    mockRpc.mockImplementation(async (fn: string, params: any) => {
      if (fn === 'create_appointment_by_manager') {
        return {
          data: {
            appointment_id: 'app-new',
            tenant_id: params.p_tenant_id,
            customer_id: params.p_customer_id ?? (params.p_new_customer_name ? 'cust-new' : null),
            professional_id: params.p_professional_id ?? 'prof-1',
            start_time: params.p_start_time,
            end_time: params.p_start_time,
            status: 'confirmed',
            is_fitting: params.p_is_fitting,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });
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
        // Aplica o status pedido: a leitura dos ativos (neq canceled) e a dos cancelados (eq canceled)
        // nao podem devolver as mesmas linhas, senao nenhum teste distingue uma da outra.
        let statusIgual: string | null = null;
        let statusDiferente: string | null = null;
        const builder: any = {
          select: () => builder,
          eq: (coluna: string, valor: string) => {
            if (coluna === 'status') statusIgual = valor;
            return builder;
          },
          gte: () => builder,
          lt: () => builder,
          neq: (coluna: string, valor: string) => {
            if (coluna === 'status') statusDiferente = valor;
            return builder;
          },
          order: vi.fn().mockImplementation(async () => {
            if (mockAppointmentsFail) return { data: null, error: { message: 'falha de rede' } };
            return {
              data: [...mockAppointments, ...mockCanceledAppointments].filter(
                (a) =>
                  (statusIgual === null || a.status === statusIgual) &&
                  (statusDiferente === null || a.status !== statusDiferente)
              ),
              error: null,
            };
          }),
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
          order: vi.fn().mockImplementation(() =>
            Promise.resolve(
              mockBlockedSlotsFail
                ? { data: null, error: { message: 'falha de rede' } }
                : { data: mockBlockedSlots, error: null }
            )
          ),
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

  describe('selo de Agendamento vindo da Lista de Espera (spec 043, ticket 07)', () => {
    const comMarca = async (marcado: boolean, aoVerificar: () => Promise<void>) => {
      const original = (mockAppointments[0] as any).from_waiting_list;
      (mockAppointments[0] as any).from_waiting_list = marcado;
      try {
        await aoVerificar();
      } finally {
        (mockAppointments[0] as any).from_waiting_list = original;
      }
    };

    it('marca no cartão do dia o Agendamento que veio da fila', async () => {
      await comMarca(true, async () => {
        render(<Agenda />);
        await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

        expect(screen.getAllByTitle('Veio da Lista de Espera').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('não marca o Agendamento que não veio da fila', async () => {
      await comMarca(false, async () => {
        render(<Agenda />);
        await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

        expect(screen.queryAllByTitle('Veio da Lista de Espera')).toHaveLength(0);
      });
    });

    it('marca também no cartão da visão semanal', async () => {
      await comMarca(true, async () => {
        render(<Agenda />);
        await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

        fireEvent.click(screen.getByText('Semana'));

        await waitFor(() =>
          expect(screen.getAllByTitle('Veio da Lista de Espera').length).toBeGreaterThanOrEqual(1)
        );
      });
    });
  });

  describe('Selos do cartão usam o componente Badge da biblioteca (spec 044, ticket 12)', () => {
    const comSelosMultiplos = async (aoVerificar: () => Promise<void>) => {
      const original = { ...mockAppointments[0] };
      (mockAppointments[0] as any).is_fitting = true;
      (mockAppointments[0] as any).from_waiting_list = true;
      (mockAppointments[0] as any).payment_status = 'paid';
      try {
        await aoVerificar();
      } finally {
        Object.assign(mockAppointments[0], original);
      }
    };

    // A grade desktop e a visão de celular (MobileAgendaView) são renderizadas juntas o tempo todo,
    // uma escondida da outra só por CSS de breakpoint (max-md:) — por isso os selos aparecem em
    // dobro no jsdom, que não avalia media query. getAllBy* cobre as duas superfícies de uma vez.
    it('mostra Encaixe, Espera e Pago juntos no cartão do dia (grade e visão de celular), cada um com o par de tokens sólidos do Badge', async () => {
      await comSelosMultiplos(async () => {
        render(<Agenda />);
        await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

        const encaixes = screen.getAllByTitle('Encaixe');
        const esperas = screen.getAllByTitle('Veio da Lista de Espera');
        const pagos = screen.getAllByTitle('Pago');
        expect(encaixes.length).toBeGreaterThanOrEqual(1);
        expect(esperas.length).toBeGreaterThanOrEqual(1);
        expect(pagos.length).toBeGreaterThanOrEqual(1);

        // Classe exata que o Badge gera para cada variante/tipo — só aparece vindo do componente da
        // biblioteca, nunca do span solto antigo. Prova que a troca de componente aconteceu de
        // verdade, não só que os três selos têm classes diferentes entre si.
        encaixes.forEach((selo) => expect(selo.className).toMatch(/\bbg-brand-primary-solid\b/));
        pagos.forEach((selo) => expect(selo.className).toMatch(/\bbg-success-solid\b/));
        esperas.forEach((selo) => expect(selo.className).toMatch(/\bbg-brand-lightest\b/)); // subtle, como antes

        // Nenhum selo carrega mais uma cor hexadecimal solta.
        [...encaixes, ...esperas, ...pagos].forEach((selo) => {
          expect(selo.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
      });
    });

    it('mostra "Não compareceu" com o token de erro sólido, sem a cor hexadecimal antiga', async () => {
      const original = { ...mockAppointments[0] };
      (mockAppointments[0] as any).status = 'no_show';
      try {
        render(<Agenda />);
        await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

        const selos = screen.getAllByTitle('Não compareceu');
        expect(selos.length).toBeGreaterThanOrEqual(1);
        selos.forEach((selo) => {
          expect(selo.className).toMatch(/\bbg-error-solid\b/);
          expect(selo.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
      } finally {
        Object.assign(mockAppointments[0], original);
      }
    });

    it('mostra os mesmos selos, encolhidos para caber, no cartão da visão semanal', async () => {
      await comSelosMultiplos(async () => {
        render(<Agenda />);
        await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

        fireEvent.click(screen.getByText('Semana'));

        await waitFor(() => expect(screen.getAllByTitle('Pago').length).toBeGreaterThanOrEqual(1));
        expect(screen.getAllByTitle('Encaixe').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByTitle('Veio da Lista de Espera').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Bloqueios de Horário lidos por caminho único (spec 043, ticket 08)', () => {
    const bloqueioAlmoco = {
      id: 'blk-1',
      tenant_id: 'tenant-123',
      professional_id: 'prof-1',
      start_time: '2026-08-16T15:00:00.000Z',
      end_time: '2026-08-16T16:00:00.000Z',
      reason: 'Almoço',
      is_all_day: false,
    };
    const consultasAoBanco = (tabela: string) => mockFrom.mock.calls.filter(([nome]) => nome === tabela).length;

    it('lê a tabela de Bloqueios uma única vez por atualização', async () => {
      mockBlockedSlots = [bloqueioAlmoco];
      render(<Agenda />);
      await waitFor(() => expect(screen.getByText('Almoço')).toBeInTheDocument());

      expect(consultasAoBanco('blocked_slots')).toBe(1);
    });

    it('a falha na leitura de Bloqueios não esconde os Agendamentos nem acusa erro de agendamento', async () => {
      mockBlockedSlotsFail = true;
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<Agenda />);

      await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));
      await waitFor(() => expect(consoleErro).toHaveBeenCalledWith('Erro ao buscar bloqueios:', expect.anything()));
      expect(mockAddToast).not.toHaveBeenCalledWith('Erro ao carregar os agendamentos do dia.', 'error');
      consoleErro.mockRestore();
    });

    it('a falha na leitura de Agendamentos mantém os Bloqueios na grade e avisa o erro de agendamento', async () => {
      mockBlockedSlots = [bloqueioAlmoco];
      mockAppointmentsFail = true;
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<Agenda />);

      await waitFor(() =>
        expect(mockAddToast).toHaveBeenCalledWith('Erro ao carregar os agendamentos do dia.', 'error')
      );
      expect(screen.getByText('Almoço')).toBeInTheDocument();
      consoleErro.mockRestore();
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
    const user = userEvent.setup();
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Barbeiro').length).toBeGreaterThanOrEqual(1);
    });

    const filterBtn = screen.getByRole('button', { name: /Equipe/i });
    await user.click(filterBtn);

    const carlosItem = screen.getByRole('menuitemcheckbox', { name: 'Carlos Barbeiro' });
    await user.click(carlosItem); // Desmarca Carlos

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
    // O Cliente Provisório é criado pelo banco, na mesma transação do agendamento.
    expect(mockRpc).toHaveBeenCalledWith(
      'create_appointment_by_manager',
      expect.objectContaining({
        p_customer_id: null,
        p_new_customer_name: 'Cliente Balcão Teste',
        p_new_customer_phone: '11977776666',
        p_is_fitting: true,
      })
    );
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
        .find((element) => element.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]');
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

    // Espera os agendamentos existentes carregarem antes de clicar: o rodízio de
    // encaixe usa a contagem atual de atendimentos por profissional pra sugerir
    // quem está com a agenda mais livre, e essa contagem só fica correta depois
    // que os agendamentos mockados terminam de carregar.
    await waitFor(() => {
      expect(screen.getByTestId('appointment-card')).toBeInTheDocument();
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
    expect(mockRpc).toHaveBeenCalledWith(
      'create_appointment_by_manager',
      expect.objectContaining({
        p_tenant_id: 'tenant-123',
        p_professional_id: 'prof-2', // rodízio: prof-1 (Carlos) já tem 1 atendimento, prof-2 (Marcos) tem 0
        p_service_id: 'serv-1',
        p_start_time: '2026-08-16T21:10:00.000Z',
        p_is_fitting: true,
      })
    );
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

  it('sugere para o encaixe um horário que está na grade do profissional, não só na grade do dia (spec 040)', async () => {
    const originalInterval = mockOutletContext.slotIntervalMinutes;
    const originalSchedules = mockProfessionals.map((p) => p.weekly_schedule);
    mockOutletContext.slotIntervalMinutes = 40;
    // Grade de 40 min ancorada às 09:00 (09:00, 09:40, 10:20...). Às 09:00 o horário padrão contado
    // desde 00:00 seria 09:20, que não existe nessa grade.
    mockProfessionals.forEach((p) => {
      p.weekly_schedule = { sunday: { active: true, start: '09:00', end: '19:00' } };
    });

    try {
      render(<Agenda />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Encaixe$/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

      const timeInput = await screen.findByLabelText(/Horário de início/i);
      await waitFor(() => {
        expect(timeInput.querySelector('option[value="09:40"]')).not.toBeNull();
      });
      expect(timeInput.querySelector('option[value="09:20"]')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: /Confirmar encaixe na agenda/i }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('Encaixe agendado com sucesso!', 'success');
      });
      expect(mockAddToast).not.toHaveBeenCalledWith(
        'Horário de encaixe deve seguir a grade de 40 minutos.',
        'warning'
      );
      expect(mockRpc).toHaveBeenCalledWith(
        'create_appointment_by_manager',
        expect.objectContaining({ p_start_time: '2026-08-16T12:40:00.000Z', p_is_fitting: true })
      );
    } finally {
      mockOutletContext.slotIntervalMinutes = originalInterval;
      mockProfessionals.forEach((p, i) => {
        p.weekly_schedule = originalSchedules[i];
      });
    }
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

    const blockCard = screen.getByText('Almoço').closest('[data-testid="blocked-card"]');
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
    const appointmentCard = clientLabels.find((el) => el.closest('[data-testid="appointment-card"]'))?.closest('[data-testid="appointment-card"]');
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
      .map((element) => element.closest('[data-testid="appointment-card"]'))
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
      .find((el) => el.closest('[data-testid="appointment-card"]'))
      ?.closest('[data-testid="appointment-card"]');
    expect(card).toBeInTheDocument();

    const topRow = card!.querySelector('[data-testid="card-top-row"]');
    expect(topRow).toBeInTheDocument();
    expect(topRow!.querySelector('.card-quick-actions-right')).toBeNull();
    expect(topRow!.querySelector('.card-quick-reagendar-btn')).toBeNull();

    const clientRow = card!.querySelector('[data-testid="card-client-row"]');
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
        .find((el) => el.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]');
      expect(card).toBeInTheDocument();

      const topRow = card!.querySelector('[data-testid="card-top-row"]');
      expect(topRow).toBeInTheDocument();
      expect(topRow!.querySelector('[title="Encaixe"]')).toBeInTheDocument();
      expect(topRow!.querySelector('.card-quick-actions-right')).toBeNull();

      const clientRow = card!.querySelector('[data-testid="card-client-row"]');
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
      customer: { id: 'cust-2', name: 'Cliente Encaixe', phone: '11999999992' },
      start_time: '2026-08-16T12:00:00.000Z', // 09:00 em SP
      end_time: '2026-08-16T12:30:00.000Z',
      is_fitting: true,
    };
    mockAppointments[2] = {
      ...mockAppointments[0],
      id: 'app-solo',
      customer_id: 'cust-3',
      customer: { id: 'cust-3', name: 'Cliente Solo', phone: '11999999993' },
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
        .find((el) => el.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]') as HTMLElement;
      expect(soloCard).toBeInTheDocument();
      expect(soloCard.style.width).toBe('calc(100% - 8px)');
      expect(soloCard.style.height).toBe('69px');
      expect(soloCard.style.left).toBe('4px');

      const regularCard = screen
        .getAllByText('Pedro Cliente')
        .find((el) => el.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]') as HTMLElement;
      expect(regularCard).toBeInTheDocument();
      expect(regularCard.style.width).toBe('calc(50% - 8px)');
      expect(regularCard.style.height).toBe('69px');
      expect(regularCard.style.left).toBe('4px');

      const fittingCard = screen
        .getAllByText('Cliente Encaixe')
        .find((el) => el.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]') as HTMLElement;
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
    expect(occupiedSlot).toHaveClass('cursor-default');
    expect(occupiedSlot).toHaveAttribute('title', expect.stringContaining('Horário ocupado'));
    expect(occupiedSlot.querySelectorAll('span').length).toBe(0);

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
          .find((el) => el.closest('[data-testid="appointment-card"]'))
          ?.closest('[data-testid="appointment-card"]') as HTMLElement;
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
      customer: { id: 'cust-week-2', name: 'Cliente Semana Encaixe', phone: '11999999992' },
      start_time: '2026-08-16T13:00:00.000Z', // 10:00 em SP
      end_time: '2026-08-16T13:30:00.000Z',
      is_fitting: true,
    };
    mockAppointments[2] = {
      ...mockAppointments[0],
      id: 'week-app-solo',
      customer_id: 'cust-week-3',
      customer: { id: 'cust-week-3', name: 'Cliente Semana Solo', phone: '11999999993' },
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
          const cards = document.querySelectorAll('[data-testid="appointment-card"]');
          expect(cards.length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );

      const soloCard = screen
        .getAllByText('Cliente Semana Solo')
        .find((el) => el.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]') as HTMLElement;
      expect(soloCard).toBeInTheDocument();
      expect(soloCard.style.width).toBe('463px');
      expect(soloCard.style.height).toBe('69px');
      expect(soloCard.style.left).toBe('5px');

      const regularCard = screen
        .getAllByText('Pedro Cliente')
        .find((el) => el.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]') as HTMLElement;
      expect(regularCard).toBeInTheDocument();
      expect(regularCard.style.width).toBe('231px');
      expect(regularCard.style.height).toBe('69px');
      expect(regularCard.style.left).toBe('3px');

      const fittingCard = screen
        .getAllByText('Cliente Semana Encaixe')
        .find((el) => el.closest('[data-testid="appointment-card"]'))
        ?.closest('[data-testid="appointment-card"]') as HTMLElement;
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
    const user = userEvent.setup();
    render(<Agenda />);

    await waitFor(() => {
      expect(screen.getAllByText('Carlos Barbeiro').length).toBeGreaterThanOrEqual(1);
    });

    // Na visão de dia, o botão de equipe existe com título e contagem corretos
    const dayFilterBtn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    expect(dayFilterBtn).toBeInTheDocument();
    expect(dayFilterBtn).toHaveTextContent(/Equipe \(\s*2\s*\)/i);

    // Alternar para a visão semanal
    const weekBtn = screen.getByRole('button', { name: 'Semana' });
    fireEvent.click(weekBtn);

    // Na visão semanal, o botão de equipe NÃO deve virar um <select>, deve permanecer o mesmo botão
    const weekFilterBtn = screen.getByRole('button', { name: /Filtrar Equipe/i });
    expect(weekFilterBtn).toBeInTheDocument();
    expect(document.querySelector('.agenda-week-prof-select')).toBeNull();

    // Clicar no botão para abrir o dropdown de seleção na semana
    await user.click(weekFilterBtn);

    // Deve abrir o dropdown com opção dos profissionais com checkbox
    expect(screen.getByText('Exibir Barbeiros')).toBeInTheDocument();
    const carlosItem = screen.getByRole('menuitemcheckbox', { name: 'Carlos Barbeiro' });
    const marcosItem = screen.getByRole('menuitemcheckbox', { name: 'Marcos Navalha' });
    expect(carlosItem).toHaveAttribute('aria-checked', 'true');
    expect(marcosItem).toHaveAttribute('aria-checked', 'true');

    // Desmarcar Marcos Navalha -> fica apenas Carlos selecionado
    await user.click(marcosItem);

    // A visão semanal deve refletir apenas Carlos Barbeiro no subtítulo
    await waitFor(() => {
      expect(screen.getByText(/Visão semanal do profissional Carlos Barbeiro/i)).toBeInTheDocument();
    });

    // Desmarcar Carlos Barbeiro -> 0 selecionados, deve exibir o mesmo empty state do dia
    // (o menu segue aberto: onSelect faz preventDefault pra permitir múltiplas marcações)
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Carlos Barbeiro' }));
    await user.keyboard('{Escape}'); // fecha o menu pra liberar o resto da página (aria-hidden do Radix)
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

  describe('Resposta obsoleta descartada ao trocar de dia rápido (spec 044, ticket 10)', () => {
    it('duas trocas de dia, a primeira resposta chegando por último: a grade mostra o dia pedido por último', async () => {
      // A leitura de montagem (índice 0) resolve na hora, com os dados padrão do arquivo (Pedro
      // Cliente), como em todo outro teste. A partir do primeiro clique em "Próximo Dia", cada
      // leitura de Agendamentos ativos fica pendurada até o teste decidir resolvê-la — permite
      // inverter a ordem de chegada das duas trocas de dia seguintes.
      const pendentes: Array<(nome: string) => void> = [];
      let chamada = -1;
      const originalFrom = mockFrom.getMockImplementation()!;

      mockFrom.mockImplementation((table: string) => {
        if (table !== 'appointments') return originalFrom(table);

        let statusDiferente: string | null = null;
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          neq: (coluna: string, valor: string) => {
            if (coluna === 'status') statusDiferente = valor;
            return builder;
          },
          gte: () => builder,
          lt: () => builder,
          order: vi.fn().mockImplementation(() => {
            // A consulta de cancelados (eq status = canceled) não participa da corrida: sempre vazia.
            if (statusDiferente !== 'canceled') return Promise.resolve({ data: [], error: null });

            chamada += 1;
            const indiceDaChamada = chamada;
            if (indiceDaChamada === 0) {
              return Promise.resolve({ data: mockAppointments, error: null });
            }
            return new Promise((resolve) => {
              pendentes[indiceDaChamada] = (nome: string) =>
                resolve({
                  data: [{ ...mockAppointments[0], id: `app-${indiceDaChamada}`, customer: { ...mockCustomers[0], name: nome } }],
                  error: null,
                });
            });
          }),
        };
        return builder;
      });

      render(<Agenda />);
      await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

      const proximoDia = screen.getByRole('button', { name: 'Próximo Dia' });
      fireEvent.click(proximoDia); // dispara a leitura 1 (pendente)
      fireEvent.click(proximoDia); // dispara a leitura 2 (pendente), antes da 1 responder

      await waitFor(() => expect(pendentes[1]).toBeDefined());
      await waitFor(() => expect(pendentes[2]).toBeDefined());

      // Inverte a ordem: a leitura 2 (mais recente) responde primeiro; a leitura 1 (obsoleta) só depois.
      pendentes[2]('Cliente Dia Novo');
      await waitFor(() => expect(screen.getAllByText('Cliente Dia Novo').length).toBeGreaterThanOrEqual(1));

      pendentes[1]('Cliente Dia Antigo');
      // A leitura obsoleta nunca chega a aparecer: nem antes, nem depois de resolvida.
      expect(screen.queryByText('Cliente Dia Antigo')).toBeNull();
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByText('Cliente Dia Antigo')).toBeNull();
      expect(screen.getAllByText('Cliente Dia Novo').length).toBeGreaterThanOrEqual(1);

      // O indicador de carregamento não fica preso ligado pela resposta obsoleta chegando por último
      // (a leitura válida, mais recente, já desligou; sobra só a transição de troca de dia, que some
      // sozinha depois do próprio atraso de animação, sem depender da leitura obsoleta).
      await waitFor(() => expect(screen.queryByLabelText('Carregando grade da agenda')).toBeNull(), {
        timeout: 1000,
      });
      // A leitura obsoleta não é erro: nenhum toast de falha foi disparado.
      expect(mockAddToast).not.toHaveBeenCalledWith('Erro ao carregar os agendamentos do dia.', 'error');
    });

    it('o mesmo vale para a leitura de Bloqueios de Horário, que também acompanha o dia', async () => {
      const pendentes: Array<(reason: string) => void> = [];
      let chamada = -1;
      const originalFrom = mockFrom.getMockImplementation()!;

      mockFrom.mockImplementation((table: string) => {
        if (table !== 'blocked_slots') return originalFrom(table);

        const builder: any = {
          select: () => builder,
          eq: () => builder,
          gte: () => builder,
          lt: () => builder,
          order: vi.fn().mockImplementation(() => {
            chamada += 1;
            const indiceDaChamada = chamada;
            if (indiceDaChamada === 0) return Promise.resolve({ data: [], error: null });
            return new Promise((resolve) => {
              pendentes[indiceDaChamada] = (reason: string) =>
                resolve({
                  data: [
                    {
                      id: `blk-${indiceDaChamada}`,
                      tenant_id: 'tenant-123',
                      professional_id: 'prof-1',
                      start_time: '2026-08-16T15:00:00.000Z',
                      end_time: '2026-08-16T16:00:00.000Z',
                      reason,
                      is_all_day: false,
                    },
                  ],
                  error: null,
                });
            });
          }),
          delete: () => ({ eq: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
        };
        return builder;
      });

      render(<Agenda />);
      await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThanOrEqual(1));

      const proximoDia = screen.getByRole('button', { name: 'Próximo Dia' });
      fireEvent.click(proximoDia); // dispara a leitura 1 de bloqueios (pendente)
      fireEvent.click(proximoDia); // dispara a leitura 2 (pendente), antes da 1 responder

      await waitFor(() => expect(pendentes[1]).toBeDefined());
      await waitFor(() => expect(pendentes[2]).toBeDefined());

      // Inverte a ordem: a leitura 2 (mais recente) responde primeiro; a leitura 1 (obsoleta) só depois.
      pendentes[2]('Bloqueio Dia Novo');
      await waitFor(() => expect(screen.getByText('Bloqueio Dia Novo')).toBeInTheDocument());

      pendentes[1]('Bloqueio Dia Antigo');
      expect(screen.queryByText('Bloqueio Dia Antigo')).toBeNull();
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByText('Bloqueio Dia Antigo')).toBeNull();
      expect(screen.getByText('Bloqueio Dia Novo')).toBeInTheDocument();
    });
  });

  describe('Painel de Cancelados do Dia (spec 043, ticket 05)', () => {
    const cancelado = (overrides: Record<string, unknown> = {}) => ({
      id: 'canc-x',
      start_time: '2026-08-16T13:00:00.000Z',
      end_time: '2026-08-16T13:30:00.000Z',
      status: 'canceled',
      payment_status: 'pending',
      is_fitting: false,
      notes: null,
      origin: 'manual',
      professional_id: 'prof-1',
      professional: mockProfessionals[0],
      customer: { id: 'cust-2', name: 'Marcos Desistente', phone: '11977776666' },
      service: mockServices[0],
      cancellation_reason: 'Imprevisto no trabalho',
      ...overrides,
    });
    const CANC_CARLOS = cancelado({ id: 'canc-1' });
    const CANC_MARCOS = cancelado({
      id: 'canc-2',
      professional_id: 'prof-2',
      professional: mockProfessionals[1],
      start_time: '2026-08-16T14:00:00.000Z',
      customer: { id: 'cust-3', name: 'Lucas Esquecido', phone: '11966665555' },
      cancellation_reason: 'Cliente desistiu',
    });

    const abrirPainel = async () => {
      fireEvent.click(await screen.findByRole('button', { name: /Cancelados/i }));
      return await screen.findByRole('dialog', { name: /Cancelados do dia/i });
    };

    it('mostra no cabeçalho o contador de cancelamentos do dia, sem pôr cancelado na grade', async () => {
      mockCanceledAppointments = [CANC_CARLOS, CANC_MARCOS];
      render(<Agenda />);

      expect(await screen.findByRole('button', { name: /Cancelados.*2/i })).toBeInTheDocument();
      expect(screen.queryByText('Marcos Desistente')).not.toBeInTheDocument();
      expect(screen.queryByText('Lucas Esquecido')).not.toBeInTheDocument();
    });

    it('lista na mesma lista os cancelados de mais de um profissional, com o motivo por extenso', async () => {
      mockCanceledAppointments = [CANC_CARLOS, CANC_MARCOS];
      render(<Agenda />);

      const painel = await abrirPainel();

      expect(within(painel).getByText('Marcos Desistente')).toBeInTheDocument();
      expect(within(painel).getByText('Lucas Esquecido')).toBeInTheDocument();
      expect(within(painel).getByText('Carlos Barbeiro')).toBeInTheDocument();
      expect(within(painel).getByText('Marcos Navalha')).toBeInTheDocument();
      expect(within(painel).getByText('Imprevisto no trabalho')).toBeInTheDocument();
      expect(within(painel).getByText('Cliente desistiu')).toBeInTheDocument();
    });

    it('respeita o filtro de equipe e, ao limpá-lo, revela o cancelado sem recarregar a leitura', async () => {
      const user = userEvent.setup();
      mockCanceledAppointments = [CANC_CARLOS, CANC_MARCOS];
      render(<Agenda />);
      await screen.findByRole('button', { name: /Cancelados.*2/i });
      const leiturasAntes = mockFrom.mock.calls.filter(([tabela]) => tabela === 'appointments').length;

      await user.click(screen.getByRole('button', { name: /Equipe/i }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: 'Carlos Barbeiro' }));
      await user.keyboard('{Escape}');

      expect(await screen.findByRole('button', { name: /Cancelados.*1/i })).toBeInTheDocument();
      let painel = await abrirPainel();
      expect(within(painel).getByText('Lucas Esquecido')).toBeInTheDocument();
      expect(within(painel).queryByText('Marcos Desistente')).not.toBeInTheDocument();

      await user.click(within(painel).getByRole('button', { name: /Fechar painel/i }));
      await user.click(screen.getByRole('button', { name: /Equipe/i }));
      await user.click(screen.getByRole('button', { name: /Selecionar todos os barbeiros/i }));
      await user.keyboard('{Escape}');

      expect(await screen.findByRole('button', { name: /Cancelados.*2/i })).toBeInTheDocument();
      painel = await abrirPainel();
      expect(within(painel).getByText('Marcos Desistente')).toBeInTheDocument();
      expect(mockFrom.mock.calls.filter(([tabela]) => tabela === 'appointments').length).toBe(leiturasAntes);
    });

    it('só conta os cancelados do dia selecionado, mesmo quando a leitura traz outros dias', async () => {
      mockCanceledAppointments = [
        CANC_CARLOS,
        cancelado({
          id: 'canc-outro-dia',
          start_time: '2026-08-17T13:00:00.000Z',
          customer: { id: 'cust-9', name: 'Fora Do Dia', phone: '11955554444' },
        }),
      ];
      render(<Agenda />);

      const painel = await abrirPainel();

      expect(screen.getByRole('button', { name: /Cancelados.*1/i })).toBeInTheDocument();
      expect(within(painel).getByText('Marcos Desistente')).toBeInTheDocument();
      expect(within(painel).queryByText('Fora Do Dia')).not.toBeInTheDocument();
    });

    it('acompanha a troca do dia selecionado', async () => {
      mockCanceledAppointments = [CANC_CARLOS];
      render(<Agenda />);
      await screen.findByRole('button', { name: /Cancelados.*1/i });

      mockCanceledAppointments = [
        cancelado({
          id: 'canc-dia-seguinte',
          start_time: '2026-08-17T13:00:00.000Z',
          customer: { id: 'cust-8', name: 'Ana Do Dia Seguinte', phone: '11944443333' },
        }),
      ];
      // A visão de celular e a de desktop convivem no DOM; ambas trocam o mesmo dia selecionado.
      fireEvent.click(screen.getAllByRole('button', { name: /Próximo Dia/i })[0]);

      const painel = await abrirPainel();
      expect(within(painel).getByText('Ana Do Dia Seguinte')).toBeInTheDocument();
      expect(within(painel).queryByText('Marcos Desistente')).not.toBeInTheDocument();
    });

    it('oferece o atalho para chamar o cliente no WhatsApp a partir da entrada cancelada', async () => {
      const abrirJanela = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockCanceledAppointments = [CANC_CARLOS];
      render(<Agenda />);

      const painel = await abrirPainel();
      fireEvent.click(within(painel).getByRole('button', { name: /Chamar no WhatsApp/i }));

      expect(abrirJanela).toHaveBeenCalledWith(
        expect.stringContaining('wa.me/5511977776666'),
        '_blank',
        'noopener,noreferrer'
      );
      abrirJanela.mockRestore();
    });

    it('na visão semanal, o painel continua sendo do dia selecionado, não da semana inteira', async () => {
      mockCanceledAppointments = [
        CANC_CARLOS,
        cancelado({
          id: 'canc-terca',
          start_time: '2026-08-18T13:00:00.000Z',
          customer: { id: 'cust-7', name: 'Da Terça', phone: '11933332222' },
        }),
      ];
      render(<Agenda />);
      await screen.findByRole('button', { name: /Cancelados.*1/i });

      fireEvent.click(screen.getByText('Semana'));

      const painel = await abrirPainel();
      expect(screen.getByRole('button', { name: /Cancelados.*1/i })).toBeInTheDocument();
      expect(within(painel).getByText('Marcos Desistente')).toBeInTheDocument();
      expect(within(painel).queryByText('Da Terça')).not.toBeInTheDocument();
    });

    it('mostra quem cancelou em cada entrada, sem adivinhar quando a autoria é desconhecida', async () => {
      mockCanceledAppointments = [
        cancelado({
          id: 'canc-a',
          canceled_by: 'customer',
          customer: { id: 'c-a', name: 'Ana Autora', phone: '11900000001' },
        }),
        cancelado({
          id: 'canc-b',
          canceled_by: 'shop',
          start_time: '2026-08-16T14:00:00.000Z',
          customer: { id: 'c-b', name: 'Bruno Autor', phone: '11900000002' },
        }),
        cancelado({
          id: 'canc-c',
          canceled_by: null,
          start_time: '2026-08-16T15:00:00.000Z',
          customer: { id: 'c-c', name: 'Caio Antigo', phone: '11900000003' },
        }),
      ];
      render(<Agenda />);

      const painel = await abrirPainel();
      const entrada = (nome: string) => within(painel).getByText(nome).closest('li') as HTMLElement;

      expect(within(entrada('Ana Autora')).getByText('Cliente')).toBeInTheDocument();
      expect(within(entrada('Bruno Autor')).getByText('Barbearia')).toBeInTheDocument();
      expect(within(entrada('Caio Antigo')).getByText('Desconhecido')).toBeInTheDocument();
    });

    it('não cai quando o cancelado é de um encaixe de balcão sem cliente cadastrado', async () => {
      mockCanceledAppointments = [cancelado({ id: 'canc-balcao', customer: null, customer_id: null })];
      render(<Agenda />);

      const painel = await abrirPainel();

      expect(within(painel).getByText('Cliente Balcão')).toBeInTheDocument();
      expect(within(painel).getByRole('button', { name: /Chamar no WhatsApp/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Cancelados.*1/i })).toBeInTheDocument();
    });

    it('desabilita o atalho de WhatsApp quando o cliente não tem telefone, em vez de não fazer nada', async () => {
      const abrirJanela = vi.spyOn(window, 'open').mockImplementation(() => null);
      mockCanceledAppointments = [
        cancelado({ customer: { id: 'cust-6', name: 'Sem Telefone', phone: '' } }),
      ];
      render(<Agenda />);

      const painel = await abrirPainel();
      const botao = within(painel).getByRole('button', { name: /Chamar no WhatsApp/i });
      fireEvent.click(botao);

      expect(botao).toBeDisabled();
      expect(abrirJanela).not.toHaveBeenCalled();
      abrirJanela.mockRestore();
    });

    it('sem cancelamento no dia, mostra o estado vazio', async () => {
      render(<Agenda />);

      const painel = await abrirPainel();

      expect(screen.getByRole('button', { name: /Cancelados.*0/i })).toBeInTheDocument();
      expect(within(painel).getByText('Nenhum cancelamento neste dia')).toBeInTheDocument();
    });

    it('distingue falha de carregamento de dia sem cancelamento', async () => {
      mockAppointmentsFail = true;
      render(<Agenda />);
      await waitFor(() =>
        expect(mockAddToast).toHaveBeenCalledWith('Erro ao carregar os agendamentos do dia.', 'error')
      );

      const painel = await abrirPainel();

      expect(within(painel).getByText('Não foi possível carregar os cancelamentos')).toBeInTheDocument();
      expect(within(painel).queryByText('Nenhum cancelamento neste dia')).not.toBeInTheDocument();
    });

    describe('cancelamento de profissional desativado (spec 044, ticket 13)', () => {
      const PROF_DESATIVADO = { id: 'prof-saiu', name: 'Zeca Saído', is_active: false, phone: '11900000009' };
      const CANC_DESATIVADO = cancelado({
        id: 'canc-desativado',
        professional_id: 'prof-saiu',
        professional: PROF_DESATIVADO,
        customer: { id: 'cust-9', name: 'Cliente Do Zeca', phone: '11900000009' },
      });

      it('mostra o nome e o aviso de desativado, com o filtro de equipe em todos', async () => {
        mockCanceledAppointments = [CANC_DESATIVADO];
        render(<Agenda />);

        expect(await screen.findByRole('button', { name: /Cancelados.*1/i })).toBeInTheDocument();
        const painel = await abrirPainel();
        expect(within(painel).getByText('Cliente Do Zeca')).toBeInTheDocument();
        expect(within(painel).getByText('Zeca Saído')).toBeInTheDocument();
        expect(
          within(painel).getByTitle('Este profissional não faz mais parte da equipe')
        ).toBeInTheDocument();
      });

      it('some do painel e do contador quando o gerente restringe o filtro de equipe a alguns', async () => {
        const user = userEvent.setup();
        mockCanceledAppointments = [CANC_DESATIVADO, CANC_CARLOS];
        render(<Agenda />);
        await screen.findByRole('button', { name: /Cancelados.*2/i });

        await user.click(screen.getByRole('button', { name: /Equipe/i }));
        await user.click(screen.getByRole('menuitemcheckbox', { name: 'Marcos Navalha' }));
        await user.keyboard('{Escape}');

        expect(await screen.findByRole('button', { name: /Cancelados.*1/i })).toBeInTheDocument();
        const painel = await abrirPainel();
        expect(within(painel).getByText('Marcos Desistente')).toBeInTheDocument();
        expect(within(painel).queryByText('Cliente Do Zeca')).not.toBeInTheDocument();
      });

      it('o profissional desativado não entra na lista de opções do filtro de equipe', async () => {
        const user = userEvent.setup();
        mockCanceledAppointments = [CANC_DESATIVADO];
        render(<Agenda />);
        await screen.findByRole('button', { name: /Cancelados.*1/i });

        await user.click(screen.getByRole('button', { name: /Equipe/i }));

        expect(screen.queryByRole('menuitemcheckbox', { name: 'Zeca Saído' })).not.toBeInTheDocument();
      });
    });
  });
});

