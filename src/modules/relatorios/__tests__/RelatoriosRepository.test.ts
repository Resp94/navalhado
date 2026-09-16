import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RelatoriosRepository, RelatoriosValidationError } from '../RelatoriosRepository';
import type { RelatoriosAdapter } from '../types';

const faturamentoFixture = {
  timezone: 'America/Sao_Paulo',
  business_today: '2026-06-15',
  period: { start: '2026-06-01', end: '2026-06-15' },
  previous_period: { start: '2026-05-17', end: '2026-05-31' },
  data_quality: { status: 'confirmed' as const, confirmed_comandas: 1, estimated_comandas: 0, legacy_comandas: 0 },
  totals: {
    gross: 100,
    discounts: 0,
    net: 100,
    services_net: 100,
    products_net: 0,
    tips: 0,
    closed_comandas: 1,
    received_total: 100,
  },
  previous_totals: {
    gross: 0,
    discounts: 0,
    net: 0,
    services_net: 0,
    products_net: 0,
    tips: 0,
    closed_comandas: 0,
    received_total: 0,
  },
  received_by_method: [],
  buckets: [],
};

describe('RelatoriosRepository', () => {
  const mockAdapter: RelatoriosAdapter = {
    obterFaturamentoPorPeriodo: vi.fn(),
  };

  const repository = new RelatoriosRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repassa ao adaptador um pedido válido', async () => {
    vi.mocked(mockAdapter.obterFaturamentoPorPeriodo).mockResolvedValueOnce(faturamentoFixture);

    const result = await repository.obterFaturamentoPorPeriodo({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
      today: '2026-06-15',
    });

    expect(mockAdapter.obterFaturamentoPorPeriodo).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });
    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('rejeita sem tenant informado', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: '',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow(RelatoriosValidationError);
    expect(mockAdapter.obterFaturamentoPorPeriodo).not.toHaveBeenCalled();
  });

  it('rejeita datas ausentes', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('As datas de início e fim do período são obrigatórias.');
  });

  it('rejeita fim antes do início', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2026-06-15',
        endDate: '2026-06-01',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser anterior à data inicial.');
  });

  it('rejeita fim depois de hoje', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-20',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser posterior a hoje.');
  });

  it('rejeita início mais de 730 dias antes de hoje', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data inicial não pode ser mais de 730 dias antes de hoje.');
  });

  it('rejeita período acima de 366 dias', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2025-06-01',
        endDate: '2026-06-15',
        granularity: 'month',
        today: '2026-06-15',
      })
    ).rejects.toThrow('O período não pode ter mais de 366 dias.');
  });

  it('rejeita granularidade desconhecida', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-10',
        granularity: 'year' as any,
        today: '2026-06-15',
      })
    ).rejects.toThrow('Granularidade desconhecida. Use dia, semana ou mês.');
  });

  it('rejeita granularidade diária acima de 92 dias', async () => {
    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A granularidade diária só é permitida em períodos de até 92 dias.');
  });

  it('aceita granularidade semanal em período acima de 92 dias', async () => {
    vi.mocked(mockAdapter.obterFaturamentoPorPeriodo).mockResolvedValueOnce(faturamentoFixture);

    await expect(
      repository.obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-06-15',
        granularity: 'week',
        today: '2026-06-15',
      })
    ).resolves.toBeTruthy();
  });
});
