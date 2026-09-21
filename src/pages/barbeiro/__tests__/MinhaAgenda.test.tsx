import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MinhaAgenda } from '../MinhaAgenda';

const { mockAddToast, mockOutletContext, mockRpc, mockFrom, queries } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
  queries: [] as Array<{ table: string; filters: Array<[string, unknown]> }>,
  mockOutletContext: {
    tenantId: 'tenant-1',
    tenantName: 'Barbearia Alpha',
    logoUrl: null,
    timezone: 'America/Sao_Paulo',
    slotIntervalMinutes: 30,
    professionalId: 'prof-me',
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
  return { ...actual, useOutletContext: () => mockOutletContext };
});

vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
    removeChannel: vi.fn(),
  },
}));

const ME = { id: 'prof-me', name: 'Diego Barbeiro', is_active: true, phone: '11999990001', weekly_schedule: null };
const SERVICE = { id: 'serv-1', name: 'Corte Tradicional', price: 50, duration_minutes: 30 };
const CUSTOMER = { id: 'cust-1', name: 'Pedro Cliente', phone: '11988887777' };

// Domingo, 12:00 em São Paulo. O Agendamento das 09:00 já começou.
const NOW = new Date('2026-08-16T15:00:00.000Z');

const appointmentRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  start_time: '2026-08-16T12:00:00.000Z',
  end_time: '2026-08-16T12:30:00.000Z',
  status: 'confirmed',
  payment_status: 'pending',
  is_fitting: false,
  notes: null,
  origin: 'manual',
  professional_id: 'prof-me',
  customer: CUSTOMER,
  service: SERVICE,
  ...overrides,
});

const tables: Record<string, () => unknown> = {};

// Construtor encadeável que registra os filtros de cada consulta e responde a qualquer ponto da cadeia.
const makeBuilder = (table: string) => {
  const query = { table, filters: [] as Array<[string, unknown]> };
  queries.push(query);
  const naoIguais: Array<[string, unknown]> = [];
  // eq e neq aplicam de verdade nas linhas que têm a coluna; sem isso, a leitura de ativos e a de
  // cancelados devolveriam as mesmas linhas e nenhum teste distinguiria uma da outra.
  const filtrar = (dados: unknown) =>
    Array.isArray(dados)
      ? dados.filter(
          (linha: Record<string, unknown>) =>
            query.filters.every(([coluna, valor]) => !(coluna in linha) || linha[coluna] === valor) &&
            naoIguais.every(([coluna, valor]) => !(coluna in linha) || linha[coluna] !== valor)
        )
      : dados;
  const result = () => ({ data: filtrar(tables[table]?.() ?? []), error: null });
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'is', 'gte', 'lt', 'order']) {
    builder[method] = () => builder;
  }
  builder.eq = (column: string, value: unknown) => {
    query.filters.push([column, value]);
    return builder;
  };
  builder.neq = (column: string, value: unknown) => {
    naoIguais.push([column, value]);
    return builder;
  };
  builder.maybeSingle = () => Promise.resolve({ data: tables[table]?.() ?? null, error: null });
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return builder;
};

describe('Minha Agenda do barbeiro', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    queries.length = 0;
    mockOutletContext.professionalId = 'prof-me';
    tables.professionals = () => ME;
    tables.services = () => [SERVICE];
    tables.customers = () => [CUSTOMER];
    tables.professional_services = () => [];
    tables.appointments = () => [appointmentRow()];
    tables.blocked_slots = () => [];
    mockFrom.mockImplementation((table: string) => makeBuilder(table));
    mockRpc.mockResolvedValue({
      data: { appointment_id: 'app-1', status: 'canceled', customer_id: null, professional_id: 'prof-me' },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderAgenda = async () => {
    render(<MinhaAgenda />);
    await waitFor(() => expect(screen.getByText('Pedro Cliente')).toBeInTheDocument());
  };

  it('mostra só o profissional dele e o Agendamento do dia, no formato da agenda do gestor', async () => {
    await renderAgenda();

    expect(screen.getByText('Diego')).toBeInTheDocument();
    expect(screen.getByText('11988887777')).toBeInTheDocument();
    expect(screen.getByText(/CORTE TRADICIONAL - R\$ 50\.00/i)).toBeInTheDocument();
  });

  it('não oferece Iniciar, Finalizar, cobrança nem os totais estimados', async () => {
    await renderAgenda();

    expect(screen.queryByRole('button', { name: /^Iniciar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Finalizar$/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Faturamento')).not.toBeInTheDocument();
    expect(screen.queryByText('Minha Comissão')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cobrar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lista de Espera/i)).not.toBeInTheDocument();
  });

  it('consulta a agenda pela barbearia e pelo profissional do vínculo do usuário', async () => {
    await renderAgenda();

    const appointmentQuery = queries.find((q) => q.table === 'appointments');
    expect(appointmentQuery?.filters).toEqual(
      expect.arrayContaining([
        ['tenant_id', 'tenant-1'],
        ['professional_id', 'prof-me'],
      ])
    );
    const professionalQuery = queries.find((q) => q.table === 'professionals');
    expect(professionalQuery?.filters).toEqual(
      expect.arrayContaining([
        ['id', 'prof-me'],
        ['tenant_id', 'tenant-1'],
      ])
    );
  });

  it('sem cadastro de profissional vinculado, mostra o aviso e não consulta agendamentos', async () => {
    mockOutletContext.professionalId = '';

    render(<MinhaAgenda />);

    expect(screen.getByText('Acesso não vinculado')).toBeInTheDocument();
    expect(queries.some((q) => q.table === 'appointments')).toBe(false);
  });

  it('o toque no card abre as ações: reagendar, não compareceu e cancelar', async () => {
    await renderAgenda();

    fireEvent.click(screen.getByTitle('Toque para ver as ações do agendamento'));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('button', { name: /Chamar no WhatsApp/i })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /^Reagendar$/i })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Marcar não compareceu/i })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /Cancelar agendamento/i })).toBeInTheDocument();
  });

  it('cancela o Agendamento pela RPC com o motivo e a barbearia do vínculo', async () => {
    await renderAgenda();

    fireEvent.click(screen.getByTitle('Toque para ver as ações do agendamento'));
    const sheet = await screen.findByRole('dialog');
    fireEvent.click(within(sheet).getByRole('button', { name: /Cancelar agendamento/i }));

    fireEvent.change(await screen.findByLabelText(/Motivo do Cancelamento/i), {
      target: { value: 'Cliente desistiu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sim, Cancelar Horário/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('cancel_appointment_by_manager', {
        p_appointment_id: 'app-1',
        p_tenant_id: 'tenant-1',
        p_reason: 'Cliente desistiu',
      });
    });
    expect(mockAddToast).toHaveBeenCalledWith('Agendamento cancelado com sucesso.', 'success');
  });

  it('marca não compareceu pela RPC quando o horário já passou', async () => {
    mockRpc.mockResolvedValue({ data: { appointment_id: 'app-1', status: 'no_show' }, error: null });
    await renderAgenda();

    fireEvent.click(screen.getByRole('button', { name: /Marcar Pedro Cliente como não compareceu/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sim, não compareceu/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('mark_appointment_no_show', {
        p_appointment_id: 'app-1',
        p_tenant_id: 'tenant-1',
      });
    });
  });

  it('não oferece não compareceu antes do horário de início', async () => {
    tables.appointments = () => [
      appointmentRow({ start_time: '2026-08-16T20:00:00.000Z', end_time: '2026-08-16T20:30:00.000Z' }),
    ];
    await renderAgenda();

    expect(screen.queryByRole('button', { name: /Marcar Pedro Cliente como não compareceu/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Toque para ver as ações do agendamento'));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).queryByRole('button', { name: /Marcar não compareceu/i })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /^Reagendar$/i })).toBeInTheDocument();
  });

  it('reagenda com o profissional travado nele', async () => {
    await renderAgenda();

    fireEvent.click(screen.getByTitle('Toque para ver as ações do agendamento'));
    const sheet = await screen.findByRole('dialog');
    fireEvent.click(within(sheet).getByRole('button', { name: /^Reagendar$/i }));

    const professionalSelect = await screen.findByLabelText('Profissional');
    expect(professionalSelect).toBeDisabled();
    expect(professionalSelect).toHaveValue('prof-me');
  });

  it('cria Agendamento só na própria agenda: sem "Tanto faz" e com o profissional dele na RPC', async () => {
    mockRpc.mockResolvedValue({
      data: {
        appointment_id: 'app-new',
        status: 'confirmed',
        customer_id: null,
        professional_id: 'prof-me',
        start_time: '2026-08-16T20:00:00.000Z',
        end_time: '2026-08-16T20:30:00.000Z',
        is_fitting: false,
      },
      error: null,
    });
    await renderAgenda();

    fireEvent.click(screen.getByRole('button', { name: /Novo agendamento/i }));

    const professionalSelect = await screen.findByLabelText('Profissional');
    expect(within(professionalSelect).queryByRole('option', { name: 'Tanto faz' })).not.toBeInTheDocument();
    expect(professionalSelect).toHaveValue('prof-me');

    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'cust-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar agendamento/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'create_appointment_by_manager',
        expect.objectContaining({
          p_tenant_id: 'tenant-1',
          p_professional_id: 'prof-me',
          p_customer_id: 'cust-1',
          p_waiting_list_id: null,
        })
      );
    });
  });

  it('cria encaixe com cliente novo pela RPC', async () => {
    mockRpc.mockResolvedValue({
      data: {
        appointment_id: 'app-new',
        status: 'confirmed',
        customer_id: 'cust-new',
        professional_id: 'prof-me',
        start_time: '2026-08-16T15:00:00.000Z',
        end_time: '2026-08-16T15:30:00.000Z',
        is_fitting: true,
      },
      error: null,
    });
    await renderAgenda();

    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Novo cadastro/i }));
    fireEvent.change(screen.getByLabelText('Nome do cliente'), { target: { value: 'Cliente Novo' } });
    fireEvent.change(screen.getByLabelText('WhatsApp ou celular'), { target: { value: '11955550181' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar encaixe na agenda/i }));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        'create_appointment_by_manager',
        expect.objectContaining({
          p_professional_id: 'prof-me',
          p_new_customer_name: 'Cliente Novo',
          p_new_customer_phone: '11955550181',
          p_is_fitting: true,
        })
      );
    });
  });

  it('esconde os serviços que o profissional não executa', async () => {
    tables.services = () => [SERVICE, { id: 'serv-2', name: 'Barba', price: 30, duration_minutes: 30 }];
    tables.professional_services = () => [
      { professional_id: 'prof-me', service_id: 'serv-2', custom_duration_minutes: null, is_enabled: false },
    ];
    await renderAgenda();

    fireEvent.click(screen.getByRole('button', { name: /Novo agendamento/i }));

    const serviceSelect = await screen.findByLabelText('Serviço');
    expect(within(serviceSelect).getByRole('option', { name: 'Corte Tradicional' })).toBeInTheDocument();
    expect(within(serviceSelect).queryByRole('option', { name: 'Barba' })).not.toBeInTheDocument();
  });
  describe('selo de Agendamento vindo da Lista de Espera (spec 043, ticket 07)', () => {
    it('marca no cartão do barbeiro o Agendamento que o gerente criou a partir da fila', async () => {
      tables.appointments = () => [appointmentRow({ from_waiting_list: true })];

      await renderAgenda();

      expect(screen.getByTitle('Veio da Lista de Espera')).toBeInTheDocument();
    });

    it('não marca o Agendamento que não veio da fila', async () => {
      tables.appointments = () => [appointmentRow({ from_waiting_list: false })];

      await renderAgenda();

      expect(screen.queryByTitle('Veio da Lista de Espera')).not.toBeInTheDocument();
    });
  });

  describe('Bloqueios de Horário lidos à parte (spec 043, ticket 08)', () => {
    const BLOQUEIO_ALMOCO = {
      id: 'blk-1',
      tenant_id: 'tenant-1',
      professional_id: 'prof-me',
      start_time: '2026-08-16T16:00:00.000Z',
      end_time: '2026-08-16T17:00:00.000Z',
      reason: 'Almoço',
      is_all_day: false,
    };

    it('mostra o Bloqueio de Horário do dia junto do Agendamento', async () => {
      tables.blocked_slots = () => [BLOQUEIO_ALMOCO];

      await renderAgenda();
      expect(screen.getByText(/Bloqueio: Almoço/)).toBeInTheDocument();
    });

    it('a falha na leitura de Bloqueios não esconde os Agendamentos nem acusa erro de atendimento', async () => {
      tables.blocked_slots = () => {
        throw new Error('falha de rede');
      };
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});

      await renderAgenda();

      expect(mockAddToast).not.toHaveBeenCalledWith('Não foi possível carregar seus atendimentos.', 'error');
      consoleErro.mockRestore();
    });

    it('a falha na leitura de Agendamentos mantém os Bloqueios e avisa o erro de atendimento', async () => {
      tables.blocked_slots = () => [BLOQUEIO_ALMOCO];
      tables.appointments = () => {
        throw new Error('falha de rede');
      };
      const consoleErro = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<MinhaAgenda />);

      await waitFor(() =>
        expect(mockAddToast).toHaveBeenCalledWith('Não foi possível carregar seus atendimentos.', 'error')
      );
      expect(screen.getByText(/Bloqueio: Almoço/)).toBeInTheDocument();
      consoleErro.mockRestore();
    });
  });

  describe('cancelados do dia (spec 043, ticket 04)', () => {
    const CANCELADO_COM_MOTIVO = appointmentRow({
      id: 'app-c1',
      status: 'canceled',
      start_time: '2026-08-16T13:00:00.000Z',
      customer: { id: 'cust-2', name: 'Marcos Desistente', phone: '11977776666' },
      cancellation_reason: 'Imprevisto no trabalho',
    });
    const CANCELADO_SEM_MOTIVO = appointmentRow({
      id: 'app-c2',
      status: 'canceled',
      start_time: '2026-08-16T14:00:00.000Z',
      customer: { id: 'cust-3', name: 'Lucas Esquecido', phone: '11966665555' },
      cancellation_reason: null,
    });

    const abrirPainel = async () => {
      fireEvent.click(screen.getByRole('button', { name: /Cancelados/i }));
      return await screen.findByRole('dialog', { name: /Cancelados do dia/i });
    };

    it('mostra no cabeçalho o contador de cancelamentos do dia, sem pôr cancelado na grade', async () => {
      tables.appointments = () => [appointmentRow(), CANCELADO_COM_MOTIVO, CANCELADO_SEM_MOTIVO];

      await renderAgenda();

      expect(screen.getByRole('button', { name: /Cancelados.*2/i })).toBeInTheDocument();
      expect(screen.queryByText('Marcos Desistente')).not.toBeInTheDocument();
      expect(screen.queryByText('Lucas Esquecido')).not.toBeInTheDocument();
    });

    it('abre o painel com horário, cliente, serviço, profissional e o motivo por extenso', async () => {
      tables.appointments = () => [appointmentRow(), CANCELADO_COM_MOTIVO];
      await renderAgenda();

      const painel = await abrirPainel();

      expect(within(painel).getByText('Marcos Desistente')).toBeInTheDocument();
      expect(within(painel).getByText('10:00')).toBeInTheDocument();
      expect(within(painel).getByText('Corte Tradicional')).toBeInTheDocument();
      expect(within(painel).getByText('Diego Barbeiro')).toBeInTheDocument();
      expect(within(painel).getByText('Imprevisto no trabalho')).toBeInTheDocument();
    });

    it('nunca deixa o motivo em branco: sem motivo registrado mostra o aviso', async () => {
      tables.appointments = () => [appointmentRow(), CANCELADO_SEM_MOTIVO];
      await renderAgenda();

      const painel = await abrirPainel();

      expect(within(painel).getByText('Lucas Esquecido')).toBeInTheDocument();
      expect(within(painel).getByText('Sem motivo informado')).toBeInTheDocument();
    });

    it('mostra quem cancelou em cada entrada, sem adivinhar quando a autoria é desconhecida', async () => {
      tables.appointments = () => [
        appointmentRow(),
        appointmentRow({
          id: 'app-a',
          status: 'canceled',
          start_time: '2026-08-16T13:00:00.000Z',
          customer: { id: 'c-a', name: 'Ana Autora', phone: '11900000001' },
          canceled_by: 'customer',
        }),
        appointmentRow({
          id: 'app-b',
          status: 'canceled',
          start_time: '2026-08-16T14:00:00.000Z',
          customer: { id: 'c-b', name: 'Bruno Autor', phone: '11900000002' },
          canceled_by: 'shop',
        }),
        appointmentRow({
          id: 'app-c',
          status: 'canceled',
          start_time: '2026-08-16T15:00:00.000Z',
          customer: { id: 'c-c', name: 'Caio Antigo', phone: '11900000003' },
          canceled_by: null,
        }),
      ];
      await renderAgenda();

      const painel = await abrirPainel();
      const entrada = (nome: string) => within(painel).getByText(nome).closest('li') as HTMLElement;

      expect(within(entrada('Ana Autora')).getByText('Cliente')).toBeInTheDocument();
      expect(within(entrada('Bruno Autor')).getByText('Barbearia')).toBeInTheDocument();
      expect(within(entrada('Caio Antigo')).getByText('Desconhecido')).toBeInTheDocument();
    });

    it('não cai quando o cancelado é de um encaixe de balcão sem cliente cadastrado', async () => {
      tables.appointments = () => [
        appointmentRow(),
        appointmentRow({ id: 'app-balcao', status: 'canceled', customer: null, cancellation_reason: 'Desistiu' }),
      ];
      await renderAgenda();

      const painel = await abrirPainel();

      expect(within(painel).getByText('Cliente Balcão')).toBeInTheDocument();
      expect(within(painel).getByText('Desistiu')).toBeInTheDocument();
    });

    it('sem cancelamento no dia, mostra o estado vazio', async () => {
      tables.appointments = () => [appointmentRow()];
      await renderAgenda();

      const painel = await abrirPainel();

      expect(within(painel).getByText('Nenhum cancelamento neste dia')).toBeInTheDocument();
    });

    it('distingue falha de carregamento de dia sem cancelamento', async () => {
      tables.appointments = () => {
        throw new Error('falha de rede');
      };
      render(<MinhaAgenda />);
      await waitFor(() =>
        expect(mockAddToast).toHaveBeenCalledWith('Não foi possível carregar seus atendimentos.', 'error')
      );

      const painel = await abrirPainel();

      expect(within(painel).getByText('Não foi possível carregar os cancelamentos')).toBeInTheDocument();
      expect(within(painel).queryByText('Nenhum cancelamento neste dia')).not.toBeInTheDocument();
    });

    it('acompanha a troca do dia: o contador e o painel passam a mostrar os cancelados do dia novo', async () => {
      let diaAtual = 1;
      tables.appointments = () =>
        diaAtual === 1 ? [appointmentRow(), CANCELADO_COM_MOTIVO] : [appointmentRow()];
      await renderAgenda();
      expect(screen.getByRole('button', { name: /Cancelados.*1/i })).toBeInTheDocument();

      diaAtual = 2;
      fireEvent.click(screen.getByLabelText('Próximo dia'));

      expect(await screen.findByRole('button', { name: /Cancelados.*0/i })).toBeInTheDocument();
      const painel = await abrirPainel();
      expect(within(painel).getByText('Nenhum cancelamento neste dia')).toBeInTheDocument();
      expect(within(painel).queryByText('Marcos Desistente')).not.toBeInTheDocument();
    });

    it('pede os cancelados só do próprio profissional na mesma leitura da agenda', async () => {
      tables.appointments = () => [appointmentRow(), CANCELADO_COM_MOTIVO];
      await renderAgenda();

      const consultas = queries.filter((q) => q.table === 'appointments');
      expect(consultas.some((q) => q.filters.some(([c, v]) => c === 'status' && v === 'canceled'))).toBe(true);
      expect(consultas.every((q) => q.filters.some(([c, v]) => c === 'professional_id' && v === 'prof-me'))).toBe(true);
    });
  });
});
