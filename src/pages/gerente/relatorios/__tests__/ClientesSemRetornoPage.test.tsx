import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClientesSemRetornoPage } from '../ClientesSemRetornoPage';
import { RelatoriosRepository } from '../../../../modules/relatorios/RelatoriosRepository';
import type {
  ObterClientesSemRetornoInput,
  RelatorioClientesSemRetorno,
  RelatoriosAdapter,
} from '../../../../modules/relatorios/types';
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

// A página busca a lista de profissionais direto em `professionals` (sem
// hook de módulo dedicado -- ver comentário do componente); o mock
// devolve uma lista vazia por padrão para não travar em uma Promise
// pendente.
vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

class FakeRelatoriosAdapter implements RelatoriosAdapter {
  private handler: (input: ObterClientesSemRetornoInput) => Promise<RelatorioClientesSemRetorno>;

  constructor(handler: (input: ObterClientesSemRetornoInput) => Promise<RelatorioClientesSemRetorno>) {
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

  obterClientesSemRetorno(input: ObterClientesSemRetornoInput): Promise<RelatorioClientesSemRetorno> {
    return this.handler(input);
  }

  obterClientes(): Promise<never> {
    throw new Error('Não usado neste teste.');
  }
}

function itemBase(overrides: Partial<RelatorioClientesSemRetorno['items'][number]> = {}) {
  return {
    customer_id: 'cust-1',
    name: 'Ana Souza',
    phone: '11999998888',
    has_phone: true,
    last_visit_date: '2026-05-01',
    last_service_name: 'Corte',
    last_professional_name: 'Carlos',
    return_period_days: 20,
    days_since: 45,
    days_overdue: 25,
    ...overrides,
  };
}

function respostaBase(overrides: Partial<RelatorioClientesSemRetorno> = {}): RelatorioClientesSemRetorno {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: '2026-06-15',
    totals: { without_return: 1, within_return: 5, no_visit_ever: 2 },
    bands: { up_to_15: 0, d16_30: 1, d31_60: 0, over_60: 0 },
    items: [itemBase()],
    total_count: 1,
    ...overrides,
  };
}

describe('ClientesSemRetornoPage', () => {
  it('mostra os cartões de totais e a lista paginada', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesSemRetornoPage repository={repository} />);

    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeInTheDocument());
    expect(screen.getByText('Sem retorno')).toBeInTheDocument();
    expect(screen.getByText('Dentro do prazo')).toBeInTheDocument();
    expect(screen.getByText('Nunca veio')).toBeInTheDocument();
  });

  it('pede a próxima página convertendo em offset (limit fixo de 20)', async () => {
    const handler = vi.fn(async (input: ObterClientesSemRetornoInput) =>
      respostaBase({ total_count: 45, items: [itemBase({ customer_id: `cust-pagina-${input.offset}` })] })
    );
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesSemRetornoPage repository={repository} />);

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(handler).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));

    const proximaPagina = await screen.findByRole('button', { name: /próxima página/i });
    proximaPagina.click();

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
    expect(handler).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 20 }));
  });

  it('WhatsApp indisponível sem telefone: some o botão e mostra o badge "Sem telefone"', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        items: [
          itemBase({ customer_id: 'cust-com-fone', name: 'Com Telefone', has_phone: true, phone: '11999998888' }),
          itemBase({ customer_id: 'cust-sem-fone', name: 'Sem Telefone', has_phone: false, phone: null }),
        ],
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesSemRetornoPage repository={repository} />);

    await waitFor(() => expect(screen.getByText('Com Telefone')).toBeInTheDocument());
    expect(screen.getByText('Sem Telefone')).toBeInTheDocument();
    expect(screen.getByText('Sem telefone')).toBeInTheDocument();

    expect(screen.getAllByRole('link', { name: /whatsapp para/i })).toHaveLength(1);
    expect(screen.getByRole('link', { name: /whatsapp para com telefone/i })).toHaveAttribute(
      'href',
      'https://wa.me/5511999998888'
    );
    expect(screen.queryByRole('link', { name: /whatsapp para sem telefone/i })).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há cliente sem retorno e nenhum filtro está ativo', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        totals: { without_return: 0, within_return: 8, no_visit_ever: 0 },
        bands: { up_to_15: 0, d16_30: 0, d31_60: 0, over_60: 0 },
        items: [],
        total_count: 0,
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesSemRetornoPage repository={repository} />);

    await waitFor(() => expect(screen.getByText('Nenhum cliente sem retorno hoje')).toBeInTheDocument());
  });

  it('mostra erro com botão de tentar de novo', async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error('falhou'));
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    render(<ClientesSemRetornoPage repository={repository} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});
