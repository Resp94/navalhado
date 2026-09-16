import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FaturamentoPage } from '../FaturamentoPage';
import { RelatoriosRepository } from '../../../../modules/relatorios/RelatoriosRepository';
import type { ObterFaturamentoPorPeriodoInput, RelatorioFaturamento, RelatoriosAdapter } from '../../../../modules/relatorios/types';
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
  private handler: (input: ObterFaturamentoPorPeriodoInput) => Promise<RelatorioFaturamento>;

  constructor(handler: (input: ObterFaturamentoPorPeriodoInput) => Promise<RelatorioFaturamento>) {
    this.handler = handler;
  }

  obterFaturamentoPorPeriodo(input: ObterFaturamentoPorPeriodoInput): Promise<RelatorioFaturamento> {
    return this.handler(input);
  }
}

function respostaBase(overrides: Partial<RelatorioFaturamento> = {}): RelatorioFaturamento {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: '2026-06-15',
    period: { start: '2026-06-01', end: '2026-06-15' },
    previous_period: { start: '2026-05-17', end: '2026-05-31' },
    data_quality: { status: 'confirmed', confirmed_comandas: 2, estimated_comandas: 0, legacy_comandas: 0 },
    totals: {
      gross: 500,
      discounts: 20,
      net: 480,
      services_net: 400,
      products_net: 80,
      tips: 30,
      closed_comandas: 2,
      received_total: 450,
    },
    previous_totals: {
      gross: 300,
      discounts: 10,
      net: 290,
      services_net: 250,
      products_net: 40,
      tips: 15,
      closed_comandas: 2,
      received_total: 280,
    },
    received_by_method: [
      { method: 'pix', label: 'PIX', amount: 250, payments_count: 3, share: 0.5556 },
      { method: 'credit_card', label: 'Crédito', amount: 150, payments_count: 2, share: 0.3333 },
      { method: 'debit_card', label: 'Débito', amount: 0, payments_count: 0, share: 0 },
      { method: 'cash', label: 'Dinheiro', amount: 50, payments_count: 1, share: 0.1111 },
      { method: 'other', label: 'Outros', amount: 0, payments_count: 0, share: 0 },
    ],
    buckets: [
      {
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        gross: 200,
        discounts: 0,
        net: 200,
        services_net: 180,
        products_net: 20,
        tips: 10,
        closed_comandas: 1,
        received: 190,
        received_by_method: [
          { method: 'pix', label: 'PIX', amount: 190, payments_count: 2 },
          { method: 'credit_card', label: 'Crédito', amount: 0, payments_count: 0 },
          { method: 'debit_card', label: 'Débito', amount: 0, payments_count: 0 },
          { method: 'cash', label: 'Dinheiro', amount: 0, payments_count: 0 },
          { method: 'other', label: 'Outros', amount: 0, payments_count: 0 },
        ],
      },
    ],
    ...overrides,
  };
}

describe('FaturamentoPage', () => {
  it('mostra o aviso de qualidade do dado quando não é confirmado', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({ data_quality: { status: 'estimated', confirmed_comandas: 0, estimated_comandas: 2, legacy_comandas: 0 } })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/dados deste período é estimada/i)).toBeInTheDocument();
    });
  });

  it('não mostra aviso de qualidade quando o status é confirmado', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/R\$\s*480,00/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/dados deste período/i)).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando não há Comanda fechada no período', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        totals: {
          gross: 0,
          discounts: 0,
          net: 0,
          services_net: 0,
          products_net: 0,
          tips: 0,
          closed_comandas: 0,
          received_total: 0,
        },
        buckets: [],
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma Comanda fechada neste período')).toBeInTheDocument();
    });
  });

  it('troca de atalho (via contexto de período) chama o repositório com as datas certas', async () => {
    const handler = vi.fn(async (_input: ObterFaturamentoPorPeriodoInput) => respostaBase());
    const adapter = new FakeRelatoriosAdapter(handler);
    const repository = new RelatoriosRepository(adapter);

    const { rerender } = render(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-06-01', endDate: '2026-06-15', granularity: 'day' })
      );
    });

    mockOutletContext = {
      ...mockOutletContext,
      periodo: { startDate: '2026-05-01', endDate: '2026-05-31', granularity: 'day', today: '2026-06-15' },
    };
    rerender(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: '2026-05-01', endDate: '2026-05-31', granularity: 'day' })
      );
    });
  });

  it('mostra as 5 formas de pagamento sempre, mesmo com valor zero', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => respostaBase());
    const repository = new RelatoriosRepository(adapter);

    render(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Recebido por forma de pagamento')).toBeInTheDocument();
    });

    // Rótulos das 5 formas aparecem como texto (barra + tabela = 2x cada).
    expect(screen.getAllByText('PIX').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Crédito').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Débito').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dinheiro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Outros').length).toBeGreaterThan(0);

    // Débito e Outros têm valor zero no fake, mas ainda aparecem.
    expect(screen.getAllByText(/R\$\s*0,00/).length).toBeGreaterThan(0);
  });

  it('mostra "--" na participação quando o período fechou Comandas mas não teve recebimento (share nulo)', async () => {
    const adapter = new FakeRelatoriosAdapter(async () =>
      respostaBase({
        totals: {
          gross: 500,
          discounts: 20,
          net: 480,
          services_net: 400,
          products_net: 80,
          tips: 30,
          closed_comandas: 2,
          received_total: 0,
        },
        received_by_method: [
          { method: 'pix', label: 'PIX', amount: 0, payments_count: 0, share: null },
          { method: 'credit_card', label: 'Crédito', amount: 0, payments_count: 0, share: null },
          { method: 'debit_card', label: 'Débito', amount: 0, payments_count: 0, share: null },
          { method: 'cash', label: 'Dinheiro', amount: 0, payments_count: 0, share: null },
          { method: 'other', label: 'Outros', amount: 0, payments_count: 0, share: null },
        ],
      })
    );
    const repository = new RelatoriosRepository(adapter);

    render(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Recebido por forma de pagamento')).toBeInTheDocument();
    });

    // "--" aparece na barra e na tabela para cada uma das 5 formas.
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(5);
    // Nunca "0%" quando share é nulo.
    expect(screen.queryByText('0,0%')).not.toBeInTheDocument();
  });

  it('mostra erro com botão de tentar de novo quando a consulta falha', async () => {
    const adapter = new FakeRelatoriosAdapter(async () => {
      throw new Error('Falha de rede');
    });
    const repository = new RelatoriosRepository(adapter);

    render(<FaturamentoPage repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Não foi possível carregar o faturamento por período.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
  });
});
