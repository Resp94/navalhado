import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EquipeServicosPage } from '../EquipeServicosPage';
import { RelatoriosRepository } from '../../../../modules/relatorios/RelatoriosRepository';
import type {
  ObterEquipeEServicosInput,
  RelatorioEquipeServicos,
  RelatoriosAdapter,
} from '../../../../modules/relatorios/types';
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
  private handler: (input: ObterEquipeEServicosInput) => Promise<RelatorioEquipeServicos>;

  constructor(handler: (input: ObterEquipeEServicosInput) => Promise<RelatorioEquipeServicos>) {
    this.handler = handler;
  }

  obterFaturamentoPorPeriodo(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterEquipeEServicos(input: ObterEquipeEServicosInput): Promise<RelatorioEquipeServicos> {
    return this.handler(input);
  }

  obterAgenda(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }

  obterClientesSemRetorno(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }
}

function respostaBase(overrides: Partial<RelatorioEquipeServicos> = {}): RelatorioEquipeServicos {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: '2026-06-15',
    period: { start: '2026-06-01', end: '2026-06-15' },
    data_quality: { status: 'confirmed', confirmed_comandas: 2, estimated_comandas: 0, legacy_comandas: 0 },
    professionals: [
      {
        professional_id: 'prof-1',
        name: 'Carlos',
        is_active: true,
        archived: false,
        net: 200,
        gross: 220,
        share: 0.4,
        attendances: 2,
        services_quantity: 2,
        products_net: 20,
        average_ticket: 100,
        commission: 20,
      },
      {
        professional_id: 'prof-2',
        name: 'Bruna',
        is_active: false,
        archived: false,
        net: 300,
        gross: 320,
        share: 0.6,
        attendances: 1,
        services_quantity: 1,
        products_net: 0,
        average_ticket: 300,
        commission: 30,
      },
    ],
    services: [
      {
        service_id: 'svc-1',
        name: 'Corte',
        category: 'Cabelo',
        archived: false,
        quantity: 3,
        net: 270,
        share: 1,
        average_unit_net: 90,
      },
    ],
    totals: { net: 500, services_net: 270, attendances: 3 },
    ...overrides,
  };
}

describe('EquipeServicosPage', () => {
  it('mostra o ranking de profissionais na ordem devolvida pela API (sem clique de ordenação)', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Ranking de profissionais')).toBeInTheDocument();
    });

    const linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Bruna/));
    expect(within(linhas[0]).getByText('Carlos')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Bruna')).toBeInTheDocument();
  });

  it('reordena a tabela de profissionais ao clicar no cabeçalho da coluna Líquido', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Ranking de profissionais')).toBeInTheDocument();
    });

    // Ordem original: Carlos (200) antes de Bruna (300).
    let linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Bruna/));
    expect(within(linhas[0]).getByText('Carlos')).toBeInTheDocument();

    // Primeiro clique em "Líquido" ordena decrescente: Bruna (300) primeiro.
    fireEvent.click(screen.getByRole('button', { name: /^Líquido/ }));

    linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Bruna/));
    expect(within(linhas[0]).getByText('Bruna')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Carlos')).toBeInTheDocument();

    // Segundo clique inverte para crescente: Carlos (200) primeiro.
    fireEvent.click(screen.getByRole('button', { name: /^Líquido/ }));

    linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Bruna/));
    expect(within(linhas[0]).getByText('Carlos')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Bruna')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há profissional nem serviço no período', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase({ professionals: [], services: [] }));
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Nenhum item no período')).toBeInTheDocument();
    });
  });

  it('mostra o aviso "Comissão gerada, não paga" e os botões de Exportar CSV das duas tabelas', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/Comissão gerada, não paga/)).toBeInTheDocument();
    });

    const botoes = screen.getAllByRole('button', { name: /exportar csv/i });
    expect(botoes.length).toBe(2);
  });

  it('troca de filtro de profissional na tabela de serviços chama o repositório com p_professional_id (professionalId) definido', async () => {
    const handler = vi.fn(async (_input: ObterEquipeEServicosInput) => respostaBase());
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: undefined }));
    });

    const select = screen.getByRole('combobox', { name: /filtrar por profissional/i });
    fireEvent.change(select, { target: { value: 'prof-1' } });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: 'prof-1' }));
    });
  });

  it('mostra profissionais e serviços arquivados/inativos marcados', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        professionals: [
          {
            professional_id: 'prof-3',
            name: 'Daniel',
            is_active: true,
            archived: true,
            net: 50,
            gross: 50,
            share: 0.1,
            attendances: 0,
            services_quantity: 0,
            products_net: 50,
            average_ticket: null,
            commission: 5,
          },
        ],
        services: [
          {
            service_id: 'svc-2',
            name: 'Barba (descontinuada)',
            category: 'Barba',
            archived: true,
            quantity: 1,
            net: 30,
            share: 1,
            average_unit_net: 30,
          },
        ],
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      // "Daniel" aparece na linha da tabela e também como opção do filtro de profissional.
      expect(screen.getAllByText('Daniel').length).toBeGreaterThan(0);
    });

    const badges = screen.getAllByText('Arquivado');
    expect(badges.length).toBe(2);
  });

  it('mantém profissional com ticket médio nulo por último ao ordenar por Ticket médio, em qualquer direção', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        professionals: [
          {
            professional_id: 'prof-1',
            name: 'Carlos',
            is_active: true,
            archived: false,
            net: 200,
            gross: 220,
            share: 0.4,
            attendances: 2,
            services_quantity: 2,
            products_net: 20,
            average_ticket: 100,
            commission: 20,
          },
          {
            professional_id: 'prof-4',
            name: 'Eduarda',
            is_active: true,
            archived: false,
            net: 40,
            gross: 40,
            share: 0.08,
            attendances: 0,
            services_quantity: 0,
            products_net: 40,
            average_ticket: null,
            commission: 4,
          },
        ],
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Ranking de profissionais')).toBeInTheDocument();
    });

    // Primeiro clique em "Ticket médio" ordena decrescente por padrão --
    // Eduarda (average_ticket nulo) deve ficar por último, não primeiro.
    fireEvent.click(screen.getByRole('button', { name: /^Ticket médio/ }));
    let linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Eduarda/));
    expect(within(linhas[0]).getByText('Carlos')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Eduarda')).toBeInTheDocument();

    // Segundo clique inverte para crescente -- nulo continua por último.
    fireEvent.click(screen.getByRole('button', { name: /^Ticket médio/ }));
    linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Carlos|Eduarda/));
    expect(within(linhas[0]).getByText('Carlos')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Eduarda')).toBeInTheDocument();
  });

  it('reseta o filtro de profissional quando o profissional escolhido some da lista após trocar o período', async () => {
    const handler = vi.fn(async (_input: ObterEquipeEServicosInput) => respostaBase());
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    const { rerender } = render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Ranking de profissionais')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox', { name: /filtrar por profissional/i }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'prof-1' } });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: 'prof-1' }));
    });

    // Período muda e a nova resposta não tem mais "prof-1" (ex.: sem item
    // nesse novo período) -- o filtro deve voltar para "Todos os
    // profissionais" (estado vazio), não continuar filtrando por um id que
    // já não aparece na lista.
    handler.mockImplementation(async () => respostaBase({ professionals: [respostaBase().professionals[1]] }));
    mockOutletContext = {
      ...mockOutletContext,
      periodo: { startDate: '2026-07-01', endDate: '2026-07-15', granularity: 'day', today: '2026-07-15' },
    };
    rerender(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ professionalId: undefined }));
    });
    expect((screen.getByRole('combobox', { name: /filtrar por profissional/i }) as HTMLSelectElement).value).toBe(
      ''
    );
  });

  it('reordena o ranking de serviços entre líquido e quantidade, sem nova ida ao repositório', async () => {
    const handler = vi.fn(async (_input: ObterEquipeEServicosInput) =>
      respostaBase({
        services: [
          { service_id: 'svc-1', name: 'Corte', category: 'Cabelo', archived: false, quantity: 1, net: 270, share: 0.6, average_unit_net: 270 },
          { service_id: 'svc-2', name: 'Sobrancelha', category: 'Estética', archived: false, quantity: 5, net: 100, share: 0.4, average_unit_net: 20 },
        ],
      })
    );
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Ranking de serviços')).toBeInTheDocument();
    });

    // Padrão (API já ordena por líquido desc): Corte (270) antes de Sobrancelha (100).
    let linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Corte|Sobrancelha/));
    expect(within(linhas[0]).getByText('Corte')).toBeInTheDocument();

    const chamadasAntes = handler.mock.calls.length;
    fireEvent.click(screen.getByRole('tab', { name: 'Por quantidade' }));

    // Sobrancelha tem mais quantidade (5 x 1) e passa a vir primeiro --
    // reordenação local, sem nova chamada ao repositório.
    linhas = screen.getAllByRole('row').filter((row) => within(row).queryByText(/Corte|Sobrancelha/));
    expect(within(linhas[0]).getByText('Sobrancelha')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('Corte')).toBeInTheDocument();
    expect(handler.mock.calls.length).toBe(chamadasAntes);
  });

  it('mostra erro com botão de tentar de novo quando a consulta falha', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => {
      throw new Error('Falha de rede');
    });
    const repository = new RelatoriosRepository(adapter);

    render(<EquipeServicosPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar o relatório de Equipe e Serviços.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
  });
});
