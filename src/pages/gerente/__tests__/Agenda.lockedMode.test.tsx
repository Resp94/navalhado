import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Agenda } from '../Agenda';

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

const PROF_ME = { id: 'prof-me', name: 'Diego Barbeiro', is_active: true, phone: '11999990001', weekly_schedule: null };
const PROF_OUTRO = { id: 'prof-outro', name: 'Marcos Titular', is_active: true, phone: '11999990002', weekly_schedule: null };
const SERVICE = { id: 'serv-1', name: 'Corte Tradicional', price: 50, duration_minutes: 30 };
const CUSTOMER_ME = { id: 'cust-1', name: 'Pedro Cliente', phone: '11988887777' };
const CUSTOMER_OUTRO = { id: 'cust-2', name: 'Cliente do Marcos', phone: '11988880000' };

// Domingo, 12:00 em São Paulo.
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
  customer: CUSTOMER_ME,
  service: SERVICE,
  ...overrides,
});

const tables: Record<string, () => unknown> = {};

// Construtor encadeável que registra os filtros de cada consulta e responde a qualquer ponto da cadeia.
const makeBuilder = (table: string) => {
  const query = { table, filters: [] as Array<[string, unknown]> };
  queries.push(query);
  const naoIguais: Array<[string, unknown]> = [];
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

describe('Agenda em modo travado ao profissional (spec 045, ticket 01)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    queries.length = 0;
    tables.professionals = () => [PROF_ME, PROF_OUTRO];
    tables.services = () => [SERVICE];
    tables.customers = () => [CUSTOMER_ME, CUSTOMER_OUTRO];
    tables.professional_services = () => [];
    tables.appointments = () => [
      appointmentRow(),
      appointmentRow({
        id: 'app-2',
        professional_id: 'prof-outro',
        customer: CUSTOMER_OUTRO,
        start_time: '2026-08-16T13:00:00.000Z',
        end_time: '2026-08-16T13:30:00.000Z',
      }),
    ];
    tables.blocked_slots = () => [];
    mockFrom.mockImplementation((table: string) => makeBuilder(table));
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra só o Agendamento do profissional travado, escondendo o de outro profissional', async () => {
    render(
      <MemoryRouter>
        <Agenda lockedProfessionalId="prof-me" onLockedAppointmentAction={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Pedro Cliente')).toBeInTheDocument());
    expect(screen.queryByText('Cliente do Marcos')).not.toBeInTheDocument();
  });

  it('esconde o filtro de equipe, a alternância Dia/Semana e o botão de Espera', async () => {
    render(
      <MemoryRouter>
        <Agenda lockedProfessionalId="prof-me" onLockedAppointmentAction={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Pedro Cliente')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Filtrar Equipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dia$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Semana$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Espera$/i })).not.toBeInTheDocument();
  });

  it('clicar no Agendamento aciona o callback do modo travado, sem abrir o Checkout de Comanda', async () => {
    const onLockedAppointmentAction = vi.fn();
    render(
      <MemoryRouter>
        <Agenda lockedProfessionalId="prof-me" onLockedAppointmentAction={onLockedAppointmentAction} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByTestId('appointment-card').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByTestId('appointment-card')[0]);

    expect(onLockedAppointmentAction).toHaveBeenCalledWith(expect.objectContaining({ id: 'app-1' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('o Encaixe do cabeçalho desktop trava o profissional, sem opção "Tanto faz" (regressão do code review)', async () => {
    render(
      <MemoryRouter>
        <Agenda lockedProfessionalId="prof-me" onLockedAppointmentAction={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Pedro Cliente')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Encaixe$/i }));

    const professionalSelect = await screen.findByLabelText('Profissional');
    expect(professionalSelect).toHaveValue('prof-me');
    expect(within(professionalSelect).queryByRole('option', { name: 'Tanto faz' })).not.toBeInTheDocument();
  });

  it('o Bloquear horário do cabeçalho desktop trava o profissional, sem opção de outro profissional', async () => {
    render(
      <MemoryRouter>
        <Agenda lockedProfessionalId="prof-me" onLockedAppointmentAction={vi.fn()} />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Pedro Cliente')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^Bloquear$/i }));

    const professionalSelect = await screen.findByLabelText('Profissional *');
    expect(professionalSelect).toHaveValue('prof-me');
    expect(within(professionalSelect).queryByRole('option', { name: 'Marcos Titular' })).not.toBeInTheDocument();
  });

  it('sem o modo travado, o filtro de equipe, a alternância Dia/Semana e a Espera continuam disponíveis', async () => {
    render(
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByText('Pedro Cliente').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Filtrar Equipe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Dia$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Semana$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Espera$/i })).toBeInTheDocument();
    expect(screen.getAllByText('Cliente do Marcos').length).toBeGreaterThan(0);
  });
});
