import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FluxoCaixaTab } from '../FluxoCaixaTab';
import { FluxoCaixaRepository } from '../../../../modules/fluxo-caixa/FluxoCaixaRepository';
import type {
  FluxoCaixaProjetado,
  IFluxoCaixaAdapter,
  ObterFluxoCaixaInput,
} from '../../../../modules/fluxo-caixa/types';

vi.mock('react-router-dom', () => ({
  useOutletContext: () => ({
    tenantId: 'tenant-test-id',
    tenantName: 'Barbearia Estilo',
    timezone: 'America/Sao_Paulo',
  }),
  Link: ({ children, to, ...rest }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

class FakeFluxoCaixaAdapter implements IFluxoCaixaAdapter {
  constructor(private resposta: FluxoCaixaProjetado) {}

  async obterFluxoCaixaProjetado(_input: ObterFluxoCaixaInput): Promise<FluxoCaixaProjetado> {
    return this.resposta;
  }
}

function respostaBase(overrides: Partial<FluxoCaixaProjetado> = {}): FluxoCaixaProjetado {
  return {
    timezone: 'America/Sao_Paulo',
    business_today: '2026-06-10',
    estimate: { status: 'ok', weeks_used: 8, weekday_averages: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
    undated_commitments: { commission_open: 0, tips_open: 0, advances_open: 0, net_due: 0 },
    buckets: [],
    ...overrides,
  };
}

describe('FluxoCaixaTab (adaptador simulado)', () => {
  it('mostra o rótulo "estimado" visível para uma entrada estimada futura (ticket 03/037)', async () => {
    const resposta = respostaBase({
      estimate: { status: 'ok', weeks_used: 8, weekday_averages: { mon: 0, tue: 50, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
      buckets: [
        {
          start_date: '2026-06-16',
          end_date: '2026-06-16',
          kind: 'future',
          inflow_realized: 0,
          inflow_estimated: 50,
          outflow_realized: 0,
          pending_flow: 50,
          detail: {
            inflow_by_method: { dinheiro: 0, pix: 0, cartao: 0, outros: 0 },
            payouts_by_professional: [],
            advances_by_professional: [],
            estimated_days: 1,
            closed_days: 0,
          },
        },
      ],
    });

    const repository = new FluxoCaixaRepository(new FakeFluxoCaixaAdapter(resposta));
    render(<FluxoCaixaTab repository={repository} />);

    await waitFor(() => {
      expect(screen.getAllByText('estimado').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('R$ 50,00').length).toBeGreaterThan(0);
  });

  it('mostra o aviso de histórico insuficiente quando o status da estimativa não é "ok" (ticket 03/037)', async () => {
    const resposta = respostaBase({
      estimate: { status: 'insufficient_history', weeks_used: 2, weekday_averages: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 } },
      buckets: [
        {
          start_date: '2026-06-16',
          end_date: '2026-06-16',
          kind: 'future',
          inflow_realized: 0,
          inflow_estimated: null,
          outflow_realized: 0,
          pending_flow: 0,
          detail: {
            inflow_by_method: { dinheiro: 0, pix: 0, cartao: 0, outros: 0 },
            payouts_by_professional: [],
            advances_by_professional: [],
            estimated_days: 1,
            closed_days: 0,
          },
        },
      ],
    });

    const repository = new FluxoCaixaRepository(new FakeFluxoCaixaAdapter(resposta));
    render(<FluxoCaixaTab repository={repository} />);

    await waitFor(() => {
      expect(screen.getAllByText('Histórico insuficiente para estimar entradas').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('histórico insuficiente').length).toBeGreaterThan(0);
  });

  it('o campo de saldo troca o rótulo da curva de Resultado Acumulado para Saldo Projetado e volta (ticket 04/037)', async () => {
    const resposta = respostaBase({
      buckets: [
        {
          start_date: '2026-06-10',
          end_date: '2026-06-10',
          kind: 'current',
          inflow_realized: 100,
          inflow_estimated: 0,
          outflow_realized: 20,
          pending_flow: 30,
          detail: {
            inflow_by_method: { dinheiro: 0, pix: 100, cartao: 0, outros: 0 },
            payouts_by_professional: [],
            advances_by_professional: [],
            estimated_days: 0,
            closed_days: 0,
          },
        },
      ],
    });

    const repository = new FluxoCaixaRepository(new FakeFluxoCaixaAdapter(resposta));
    render(<FluxoCaixaTab repository={repository} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Resultado acumulado/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Saldo projetado/i)).not.toBeInTheDocument();

    const campoSaldo = screen.getByLabelText('Saldo disponível hoje, opcional');
    fireEvent.change(campoSaldo, { target: { value: '10000' } });

    await waitFor(() => {
      expect(screen.getAllByText(/Saldo projetado/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Resultado acumulado/i)).not.toBeInTheDocument();

    fireEvent.change(campoSaldo, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getAllByText(/Resultado acumulado/i).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/Saldo projetado/i)).not.toBeInTheDocument();
  });
});
