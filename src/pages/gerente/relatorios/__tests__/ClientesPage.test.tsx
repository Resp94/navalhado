import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClientesPage } from '../ClientesPage';
import { RelatoriosRepository } from '../../../../modules/relatorios/RelatoriosRepository';
import type { ObterClientesInput, RelatorioClientes, RelatoriosAdapter } from '../../../../modules/relatorios/types';
import type { RelatoriosOutletContextType } from '../RelatoriosLayout';

const mockOutletContext: RelatoriosOutletContextType = {
  tenantId: 'tenant-1',
  tenantName: 'Barbearia Navalha',
  logoUrl: null,
  timezone: 'America/Sao_Paulo',
  periodo: { startDate: '2026-06-01', endDate: '2026-06-15', granularity: 'day', today: '2026-06-15' },
} as RelatoriosOutletContextType;

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useOutletContext: () => mockOutletContext,
  useNavigate: () => mockNavigate,
}));

class FakeRelatoriosAdapter implements RelatoriosAdapter {
  private handler: (input: ObterClientesInput) => Promise<RelatorioClientes>;

  constructor(handler: (input: ObterClientesInput) => Promise<RelatorioClientes>) {
    this.handler = handler;
  }

  obterFaturamentoPorPeriodo(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterEquipeEServicos(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterAgenda(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterClientesSemRetorno(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterClientes(input: ObterClientesInput): Promise<RelatorioClientes> {
    return this.handler(input);
  }
}

function umaVisitaBase(overrides: Partial<RelatorioClientes['single_visit_customers'][number]> = {}) {
  return {
    customer_id: 'cust-1',
    name: 'Ana Souza',
    phone: '11999998888',
    visit_date: '2026-06-10',
    professional_name: 'Carlos',
    ...overrides,
  };
}

function respostaBase(overrides: Partial<RelatorioClientes> = {}): RelatorioClientes {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: '2026-06-15',
    period: { start: '2026-06-01', end: '2026-06-15' },
    previous_period: { start: '2026-05-17', end: '2026-05-31' },
    visitors: {
      unique_customers: 10,
      new_customers: 4,
      returning_customers: 6,
      new_single_visit: 1,
      unidentified_attendances: 2,
    },
    previous_visitors: {
      unique_customers: 8,
      new_customers: 3,
      returning_customers: 5,
      unidentified_attendances: 1,
    },
    buckets: [{ start_date: '2026-06-01', end_date: '2026-06-15', new_customers: 4, returning_customers: 6 }],
    single_visit_customers: [umaVisitaBase()],
    registrations: {
      total: 6,
      provisional: 2,
      by_registration_origin: [
        { origin: 'balcao', total: 2, with_visit: 0 },
        { origin: 'agenda', total: 1, with_visit: 1 },
        { origin: 'online', total: 1, with_visit: 0 },
        { origin: 'canal_cliente', total: 1, with_visit: 0 },
        { origin: 'whatsapp_bot', total: 1, with_visit: 1 },
      ],
      by_acquisition_channel: [
        { channel: 'instagram', total: 3, with_visit: 1 },
        { channel: 'Não informado', total: 2, with_visit: 0 },
        { channel: 'Google', total: 1, with_visit: 1 },
      ],
      acquisition_channel_filled_share: 0.6667,
    },
    ...overrides,
  };
}

describe('ClientesPage', () => {
  it('mostra os cartões de totais e a lista de Clientes de Uma Visita', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesPage repository={repository} />);

    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeInTheDocument());
    expect(screen.getByText('Clientes únicos')).toBeInTheDocument();
    expect(screen.getByText('Clientes novos')).toBeInTheDocument();
    expect(screen.getByText('Clientes recorrentes')).toBeInTheDocument();
    expect(screen.getByText('Novos de uma visita só')).toBeInTheDocument();
    expect(screen.getByText('Sem cliente identificado')).toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há Visita nem atendimento sem cliente no período', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        visitors: {
          unique_customers: 0,
          new_customers: 0,
          returning_customers: 0,
          new_single_visit: 0,
          unidentified_attendances: 0,
        },
        buckets: [],
        single_visit_customers: [],
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesPage repository={repository} />);

    await waitFor(() =>
      expect(screen.getByText('Nenhum cliente visitou a barbearia neste período')).toBeInTheDocument()
    );
  });

  it('mostra o estado vazio de Clientes de Uma Visita quando a lista vem vazia, sem esconder os cartões', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase({ single_visit_customers: [] }));
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesPage repository={repository} />);

    await waitFor(() => expect(screen.getByText('Clientes únicos')).toBeInTheDocument());
    expect(screen.getByText('Nenhum Cliente de Uma Visita neste período')).toBeInTheDocument();
  });

  it('destaca "Não informado" no canal de aquisição com o percentual preenchido', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesPage repository={repository} />);

    await waitFor(() => expect(screen.getByText('Origem dos clientes')).toBeInTheDocument());

    expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0);
    expect(screen.getByText('66,7%')).toBeInTheDocument();
    // O texto "Canal preenchido em X% dos cadastros do período." é quebrado
    // em três nós (o percentual vem dentro de um <strong>), então o
    // matcher padrão de texto do RTL não casa a string inteira -- comparação
    // via `textContent` do parágrafo inteiro.
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === 'p' &&
          element.textContent === 'Canal preenchido em 66,7% dos cadastros do período.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Canal de aquisição é um dado declarado pelo cliente, sem preenchimento automático. Para reduzir "Não informado", peça para completar o canal de aquisição na Central 360º do cliente.'
      )
    ).toBeInTheDocument();
  });

  it('mostra o estado vazio de Origem dos clientes quando não há cadastro no período, sem esconder as outras seções', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        registrations: {
          total: 0,
          provisional: 0,
          by_registration_origin: [],
          by_acquisition_channel: [],
          acquisition_channel_filled_share: null,
        },
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesPage repository={repository} />);

    await waitFor(() => expect(screen.getByText('Clientes únicos')).toBeInTheDocument());
    expect(screen.getByText('Nenhum cadastro no período')).toBeInTheDocument();
  });

  it('mostra erro com botão de tentar de novo', async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error('falhou'));
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesPage repository={repository} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});
