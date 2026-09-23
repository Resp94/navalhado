import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgendaPage } from '../AgendaPage';
import { RelatoriosRepository } from '../../../../modules/relatorios/RelatoriosRepository';
import type { ObterAgendaInput, RelatorioAgenda, RelatoriosAdapter } from '../../../../modules/relatorios/types';
import type { RelatoriosOutletContextType } from '../RelatoriosLayout';

let mockOutletContext: RelatoriosOutletContextType = {
  tenantId: 'tenant-1',
  tenantName: 'Barbearia Navalha',
  logoUrl: null,
  timezone: 'America/Sao_Paulo',
  periodo: { startDate: '2026-06-01', endDate: '2026-06-15', granularity: 'day', today: '2026-06-15' },
};

vi.mock('react-router-dom', () => ({
  useOutletContext: () => mockOutletContext,
}));

class FakeRelatoriosAdapter implements RelatoriosAdapter {
  private handler: (input: ObterAgendaInput) => Promise<RelatorioAgenda>;

  constructor(handler: (input: ObterAgendaInput) => Promise<RelatorioAgenda>) {
    this.handler = handler;
  }

  obterFaturamentoPorPeriodo(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterEquipeEServicos(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterAgenda(input: ObterAgendaInput): Promise<RelatorioAgenda> {
    return this.handler(input);
  }

  obterClientesSemRetorno(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterClientes(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }
}

function respostaBase(overrides: Partial<RelatorioAgenda> = {}): RelatorioAgenda {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: '2026-06-15',
    period: { start: '2026-06-01', end: '2026-06-15' },
    previous_period: { start: '2026-05-16', end: '2026-05-31' },
    status_totals: {
      total: 10,
      completed: 6,
      no_show: 1,
      canceled: 2,
      unresolved: 1,
      future: 0,
      attendance_rate: 6 / 7,
      cancellation_rate: 0.2,
    },
    previous_status_totals: {
      total: 8,
      completed: 5,
      no_show: 1,
      canceled: 1,
      unresolved: 1,
      future: 0,
      attendance_rate: 5 / 6,
      cancellation_rate: 1 / 7,
    },
    by_origin: [
      { origin: 'manual', total: 6, completed: 4, no_show: 1, canceled: 1, unresolved: 0, attendance_rate: 0.8 },
      { origin: 'online', total: 4, completed: 2, no_show: 0, canceled: 1, unresolved: 1, attendance_rate: 1 },
    ],
    by_professional: [
      {
        professional_id: 'prof-1',
        name: 'Carlos',
        is_active: true,
        archived: false,
        total: 6,
        completed: 4,
        no_show: 1,
        canceled: 1,
        unresolved: 0,
        attendance_rate: 0.8,
      },
      {
        professional_id: 'prof-2',
        name: 'Bruna',
        is_active: false,
        archived: false,
        total: 4,
        completed: 2,
        no_show: 0,
        canceled: 1,
        unresolved: 1,
        attendance_rate: 1,
      },
    ],
    cancellation_reasons: {
      shop: [{ reason: 'cliente desistiu', count: 2 }],
      customer: [],
      desconhecida: [],
    },
    waiting_list: { total: 0, completed: 0 },
    heatmap: {
      hours: [9, 10],
      cells: [
        { weekday: 1, hour: 9, count: 3 },
        { weekday: 1, hour: 10, count: 1 },
      ],
    },
    ...overrides,
  };
}

describe('AgendaPage', () => {
  it('mostra o aviso de Agendamento sem Desfecho em destaque, separado dos cartões de taxa', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/agendamento sem desfecho/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent('1 agendamento sem desfecho');
  });

  it('não mostra o aviso de sem desfecho quando não há nenhum', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({ status_totals: { ...respostaBase().status_totals, unresolved: 0 } })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Agendamentos por origem')).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra quantos Agendamentos vieram da Lista de Espera, e quantos desses foram concluídos (spec 044, ticket 17)', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({ waiting_list: { total: 5, completed: 3 } })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Vindos da Lista de Espera')).toBeInTheDocument();
    });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3 concluídos')).toBeInTheDocument();
  });

  it('mostra zero, não vazio, quando não há Agendamento vindo da Lista de Espera no período', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({ waiting_list: { total: 0, completed: 0 } })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Vindos da Lista de Espera')).toBeInTheDocument();
    });
    const cartao = screen.getByText('Vindos da Lista de Espera').closest('.bg-bg-secondary') as HTMLElement;
    expect(within(cartao).getByText('0')).toBeInTheDocument();
    expect(within(cartao).getByText('0 concluídos')).toBeInTheDocument();
  });

  it('mostra "--" para taxa nula mesmo com Agendamento no período (denominador zero de uma das taxas)', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        status_totals: {
          total: 3,
          completed: 0,
          no_show: 0,
          canceled: 0,
          unresolved: 0,
          future: 3,
          attendance_rate: null,
          cancellation_rate: null,
        },
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getAllByText('Taxa de comparecimento').length).toBeGreaterThan(0);
    });
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('troca de filtro de profissional refaz a busca com o parâmetro correto, sem mudar a tabela por profissional (nunca filtrada)', async () => {
    const handler = vi.fn(async (_input: ObterAgendaInput) => respostaBase());
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: undefined }));
    });

    const linhasAntes = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Bruna/));
    expect(linhasAntes).toHaveLength(2);

    const select = screen.getByRole('combobox', { name: /filtrar por profissional/i });
    fireEvent.change(select, { target: { value: 'prof-1' } });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: 'prof-1' }));
    });

    // by_professional é sempre a resposta inteira devolvida pela API --
    // como o fake devolve a mesma resposta, a tabela continua com as
    // mesmas duas linhas depois da troca de filtro.
    const linhasDepois = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Bruna/));
    expect(linhasDepois).toHaveLength(2);
  });

  it('reseta o filtro de profissional quando o profissional escolhido some da lista após trocar o período', async () => {
    const handler = vi.fn(async (_input: ObterAgendaInput) => respostaBase());
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    const { rerender } = render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Agendamentos por profissional')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', { name: /filtrar por profissional/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'prof-1' } });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: 'prof-1' }));
    });

    handler.mockImplementation(async () =>
      respostaBase({ by_professional: [respostaBase().by_professional[1]] })
    );
    mockOutletContext = {
      ...mockOutletContext,
      periodo: { startDate: '2026-07-01', endDate: '2026-07-15', granularity: 'day', today: '2026-07-15' },
    };
    rerender(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: undefined }));
    });
    expect(
      (screen.getByRole('combobox', { name: /filtrar por profissional/i }) as HTMLSelectElement).value
    ).toBe('');
  });

  it('mostra estado vazio quando não há Agendamento no período', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        status_totals: {
          total: 0,
          completed: 0,
          no_show: 0,
          canceled: 0,
          unresolved: 0,
          future: 0,
          attendance_rate: null,
          cancellation_rate: null,
        },
        by_professional: [],
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum Agendamento no período')).toBeInTheDocument();
    });
  });

  it('mostra os quatro botões de Exportar CSV (origem, profissional, motivos e mapa de calor)', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Motivos de cancelamento')).toBeInTheDocument();
    });

    const botoes = screen.getAllByRole('button', { name: /exportar csv/i });
    expect(botoes.length).toBe(4);
  });

  it('mostra o mapa de calor com a contagem exata de cada célula preenchida', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Mapa de calor por dia e horário')).toBeInTheDocument();
    });

    // Grade visual: célula de segunda (weekday 1) às 9h mostra a contagem 3,
    // e às 10h mostra 1, cada uma com aria-label explícito (spec: leitura
    // não pode depender só da cor).
    expect(screen.getByLabelText('Segunda, 9h: 3 agendamentos')).toHaveTextContent('3');
    expect(screen.getByLabelText('Segunda, 10h: 1 agendamento')).toHaveTextContent('1');
    // Uma combinação sem Agendamento (ex.: domingo às 9h) é 0, nunca ausente.
    expect(screen.getByLabelText('Domingo, 9h: 0 agendamentos')).toHaveTextContent('0');
  });

  it('mostra estado vazio no mapa de calor quando heatmap.hours vem vazio', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({ heatmap: { hours: [], cells: [] } })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Sem horas para mostrar')).toBeInTheDocument();
    });
  });

  it('mostra erro com botão de tentar de novo quando a consulta falha', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => {
      throw new Error('Falha de rede');
    });
    const repository = new RelatoriosRepository(adapter);

    render(<AgendaPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar o relatório de Agenda.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
  });
});
