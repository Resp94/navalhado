import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FluxoCaixaRepository, FluxoCaixaValidationError } from '../FluxoCaixaRepository';
import type { IFluxoCaixaAdapter } from '../types';

const estimateFixture = {
  status: 'ok' as const,
  weeks_used: 8,
  weekday_averages: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 },
};

const undatedCommitmentsFixture = {
  commission_open: 0,
  tips_open: 0,
  advances_open: 0,
  net_due: 0,
};

describe('FluxoCaixaRepository', () => {
  const mockAdapter: IFluxoCaixaAdapter = {
    obterFluxoCaixaProjetado: vi.fn(),
  };

  const repository = new FluxoCaixaRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repassa ao adaptador um pedido válido', async () => {
    vi.mocked(mockAdapter.obterFluxoCaixaProjetado).mockResolvedValueOnce({
      timezone: 'America/Sao_Paulo',
      business_today: '2026-06-10',
      estimate: estimateFixture,
      undated_commitments: undatedCommitmentsFixture,
      buckets: [],
    });

    const result = await repository.obterFluxoCaixaProjetado({
      tenantId: 'tenant-1',
      startDate: '2026-06-10',
      endDate: '2026-06-15',
      granularity: 'day',
      today: '2026-06-10',
    });

    expect(mockAdapter.obterFluxoCaixaProjetado).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      startDate: '2026-06-10',
      endDate: '2026-06-15',
      granularity: 'day',
    });
    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('rejeita sem tenant informado', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: '',
        startDate: '2026-06-10',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-10',
      })
    ).rejects.toThrow(FluxoCaixaValidationError);
    expect(mockAdapter.obterFluxoCaixaProjetado).not.toHaveBeenCalled();
  });

  it('rejeita datas ausentes', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-10',
      })
    ).rejects.toThrow('As datas de início e fim do período são obrigatórias.');
  });

  it('rejeita fim antes do início', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2026-06-15',
        endDate: '2026-06-10',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser anterior à data inicial.');
  });

  it('rejeita início depois de hoje', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2026-06-16',
        endDate: '2026-06-20',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data inicial não pode ser posterior a hoje.');
  });

  it('rejeita início mais de 365 dias antes de hoje', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2025-06-10',
        endDate: '2025-06-20',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data inicial não pode ser mais de 365 dias antes de hoje.');
  });

  it('rejeita fim mais de 365 dias depois de hoje', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2026-06-10',
        endDate: '2027-06-20',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser mais de 365 dias depois de hoje.');
  });

  it('rejeita período acima de 366 dias', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2025-07-01',
        endDate: '2026-07-05',
        granularity: 'month',
        today: '2026-06-15',
      })
    ).rejects.toThrow('O período não pode ter mais de 366 dias.');
  });

  it('rejeita granularidade desconhecida', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2026-06-10',
        endDate: '2026-06-12',
        granularity: 'year' as any,
        today: '2026-06-15',
      })
    ).rejects.toThrow('Granularidade desconhecida. Use dia, semana ou mês.');
  });

  it('rejeita granularidade diária acima de 92 dias', async () => {
    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A granularidade diária só é permitida em períodos de até 92 dias.');
  });

  it('aceita granularidade semanal em período acima de 92 dias', async () => {
    vi.mocked(mockAdapter.obterFluxoCaixaProjetado).mockResolvedValueOnce({
      timezone: 'America/Sao_Paulo',
      business_today: '2026-06-15',
      estimate: estimateFixture,
      undated_commitments: undatedCommitmentsFixture,
      buckets: [],
    });

    await expect(
      repository.obterFluxoCaixaProjetado({
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-06-15',
        granularity: 'week',
        today: '2026-06-15',
      })
    ).resolves.toBeTruthy();
  });
});
