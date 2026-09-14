import { render, screen, waitFor } from '@testing-library/react';
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
});
