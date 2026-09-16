import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RelatoriosRepository, RelatoriosValidationError } from '../RelatoriosRepository';
import type { RelatoriosAdapter } from '../types';

function mockAdapterFactory(): RelatoriosAdapter {
  return {
    obterFaturamentoPorPeriodo: vi.fn(),
    obterEquipeEServicos: vi.fn(),
    obterAgenda: vi.fn(),
    obterClientesSemRetorno: vi.fn(),
    obterClientes: vi.fn(),
  };
}

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
    average_ticket: 100,
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
    average_ticket: null,
    received_total: 0,
  },
  received_by_method: [],
  buckets: [],
  ticket_by_professional: [],
};

describe('RelatoriosRepository', () => {
  const mockAdapter: RelatoriosAdapter = {
    obterFaturamentoPorPeriodo: vi.fn(),
    obterEquipeEServicos: vi.fn(),
    obterAgenda: vi.fn(),
    obterClientesSemRetorno: vi.fn(),
    obterClientes: vi.fn(),
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

const equipeServicosFixture = {
  timezone: 'America/Sao_Paulo',
  business_today: '2026-06-15',
  period: { start: '2026-06-01', end: '2026-06-15' },
  data_quality: { status: 'confirmed' as const, confirmed_comandas: 1, estimated_comandas: 0, legacy_comandas: 0 },
  professionals: [],
  services: [],
  totals: { net: 0, services_net: 0, attendances: 0 },
};

describe('RelatoriosRepository.obterEquipeEServicos', () => {
  const mockAdapter: RelatoriosAdapter = {
    obterFaturamentoPorPeriodo: vi.fn(),
    obterEquipeEServicos: vi.fn(),
    obterAgenda: vi.fn(),
    obterClientesSemRetorno: vi.fn(),
    obterClientes: vi.fn(),
  };

  const repository = new RelatoriosRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repassa ao adaptador um pedido válido, sem professionalId quando não informado', async () => {
    vi.mocked(mockAdapter.obterEquipeEServicos).mockResolvedValueOnce(equipeServicosFixture);

    const result = await repository.obterEquipeEServicos({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      today: '2026-06-15',
    });

    expect(mockAdapter.obterEquipeEServicos).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      professionalId: undefined,
    });
    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('repassa professionalId quando informado', async () => {
    vi.mocked(mockAdapter.obterEquipeEServicos).mockResolvedValueOnce(equipeServicosFixture);

    await repository.obterEquipeEServicos({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      professionalId: 'prof-1',
      today: '2026-06-15',
    });

    expect(mockAdapter.obterEquipeEServicos).toHaveBeenCalledWith(
      expect.objectContaining({ professionalId: 'prof-1' })
    );
  });

  it('rejeita sem tenant informado', async () => {
    await expect(
      repository.obterEquipeEServicos({
        tenantId: '',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).rejects.toThrow(RelatoriosValidationError);
    expect(mockAdapter.obterEquipeEServicos).not.toHaveBeenCalled();
  });

  it('rejeita datas ausentes', async () => {
    await expect(
      repository.obterEquipeEServicos({
        tenantId: 'tenant-1',
        startDate: '',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).rejects.toThrow('As datas de início e fim do período são obrigatórias.');
  });

  it('rejeita fim antes do início', async () => {
    await expect(
      repository.obterEquipeEServicos({
        tenantId: 'tenant-1',
        startDate: '2026-06-15',
        endDate: '2026-06-01',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser anterior à data inicial.');
  });

  it('rejeita fim depois de hoje', async () => {
    await expect(
      repository.obterEquipeEServicos({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-20',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser posterior a hoje.');
  });

  it('rejeita início mais de 730 dias antes de hoje', async () => {
    await expect(
      repository.obterEquipeEServicos({
        tenantId: 'tenant-1',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data inicial não pode ser mais de 730 dias antes de hoje.');
  });

  it('rejeita período acima de 366 dias', async () => {
    await expect(
      repository.obterEquipeEServicos({
        tenantId: 'tenant-1',
        startDate: '2025-06-01',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).rejects.toThrow('O período não pode ter mais de 366 dias.');
  });

  it('aceita período de até 366 dias sem exigir granularidade (relatório sem agrupamento)', async () => {
    vi.mocked(mockAdapter.obterEquipeEServicos).mockResolvedValueOnce(equipeServicosFixture);

    await expect(
      repository.obterEquipeEServicos({
        tenantId: 'tenant-1',
        startDate: '2025-06-16',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).resolves.toBeTruthy();
  });
});

const agendaFixture = {
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
  by_origin: [],
  by_professional: [],
  cancellation_reasons: [],
  heatmap: { hours: [], cells: [] },
};

describe('RelatoriosRepository.obterAgenda', () => {
  const mockAdapter: RelatoriosAdapter = mockAdapterFactory();

  const repository = new RelatoriosRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repassa ao adaptador um pedido válido, sem professionalId quando não informado', async () => {
    vi.mocked(mockAdapter.obterAgenda).mockResolvedValueOnce(agendaFixture);

    const result = await repository.obterAgenda({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      today: '2026-06-15',
    });

    expect(mockAdapter.obterAgenda).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      professionalId: undefined,
    });
    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('repassa professionalId quando informado', async () => {
    vi.mocked(mockAdapter.obterAgenda).mockResolvedValueOnce(agendaFixture);

    await repository.obterAgenda({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      professionalId: 'prof-1',
      today: '2026-06-15',
    });

    expect(mockAdapter.obterAgenda).toHaveBeenCalledWith(expect.objectContaining({ professionalId: 'prof-1' }));
  });

  it('rejeita sem tenant informado', async () => {
    await expect(
      repository.obterAgenda({
        tenantId: '',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).rejects.toThrow(RelatoriosValidationError);
    expect(mockAdapter.obterAgenda).not.toHaveBeenCalled();
  });

  it('rejeita datas ausentes', async () => {
    await expect(
      repository.obterAgenda({
        tenantId: 'tenant-1',
        startDate: '',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).rejects.toThrow('As datas de início e fim do período são obrigatórias.');
  });

  it('rejeita fim antes do início', async () => {
    await expect(
      repository.obterAgenda({
        tenantId: 'tenant-1',
        startDate: '2026-06-15',
        endDate: '2026-06-01',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser anterior à data inicial.');
  });

  it('rejeita fim depois de hoje', async () => {
    await expect(
      repository.obterAgenda({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-20',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data final não pode ser posterior a hoje.');
  });

  it('rejeita início mais de 730 dias antes de hoje', async () => {
    await expect(
      repository.obterAgenda({
        tenantId: 'tenant-1',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A data inicial não pode ser mais de 730 dias antes de hoje.');
  });

  it('rejeita período acima de 366 dias', async () => {
    await expect(
      repository.obterAgenda({
        tenantId: 'tenant-1',
        startDate: '2025-06-01',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).rejects.toThrow('O período não pode ter mais de 366 dias.');
  });

  it('aceita período de até 366 dias sem exigir granularidade (relatório sem agrupamento)', async () => {
    vi.mocked(mockAdapter.obterAgenda).mockResolvedValueOnce(agendaFixture);

    await expect(
      repository.obterAgenda({
        tenantId: 'tenant-1',
        startDate: '2025-06-16',
        endDate: '2026-06-15',
        today: '2026-06-15',
      })
    ).resolves.toBeTruthy();
  });
});

const clientesSemRetornoFixture = {
  timezone: 'America/Sao_Paulo',
  business_today: '2026-06-15',
  totals: { without_return: 0, within_return: 0, no_visit_ever: 0 },
  bands: { up_to_15: 0, d16_30: 0, d31_60: 0, over_60: 0 },
  items: [],
  total_count: 0,
};

describe('RelatoriosRepository.obterClientesSemRetorno', () => {
  const mockAdapter: RelatoriosAdapter = {
    obterFaturamentoPorPeriodo: vi.fn(),
    obterEquipeEServicos: vi.fn(),
    obterAgenda: vi.fn(),
    obterClientesSemRetorno: vi.fn(),
    obterClientes: vi.fn(),
  };

  const repository = new RelatoriosRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repassa ao adaptador um pedido válido, sem período (fotografia de hoje)', async () => {
    vi.mocked(mockAdapter.obterClientesSemRetorno).mockResolvedValueOnce(clientesSemRetornoFixture);

    const result = await repository.obterClientesSemRetorno({
      tenantId: 'tenant-1',
      limit: 20,
      offset: 0,
    });

    expect(mockAdapter.obterClientesSemRetorno).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      overdueBand: undefined,
      professionalId: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual(clientesSemRetornoFixture);
  });

  it('repassa a faixa de atraso e o profissional quando informados', async () => {
    vi.mocked(mockAdapter.obterClientesSemRetorno).mockResolvedValueOnce(clientesSemRetornoFixture);

    await repository.obterClientesSemRetorno({
      tenantId: 'tenant-1',
      overdueBand: 'over_60',
      professionalId: 'prof-1',
      limit: 20,
      offset: 40,
    });

    expect(mockAdapter.obterClientesSemRetorno).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      overdueBand: 'over_60',
      professionalId: 'prof-1',
      limit: 20,
      offset: 40,
    });
  });

  it('rejeita tenantId ausente', async () => {
    await expect(repository.obterClientesSemRetorno({ tenantId: '', limit: 20, offset: 0 })).rejects.toThrow(
      'ID da unidade (tenant) é obrigatório.'
    );
  });

  it.each([0, -1, 101, 1.5])('rejeita limite inválido (%s)', async (limit) => {
    await expect(repository.obterClientesSemRetorno({ tenantId: 'tenant-1', limit, offset: 0 })).rejects.toThrow(
      'O limite deve estar entre 1 e 100.'
    );
  });

  it('aceita limite nos extremos (1 e 100)', async () => {
    vi.mocked(mockAdapter.obterClientesSemRetorno).mockResolvedValue(clientesSemRetornoFixture);

    await expect(
      repository.obterClientesSemRetorno({ tenantId: 'tenant-1', limit: 1, offset: 0 })
    ).resolves.toBeTruthy();
    await expect(
      repository.obterClientesSemRetorno({ tenantId: 'tenant-1', limit: 100, offset: 0 })
    ).resolves.toBeTruthy();
  });

  it.each([-1, -10, 1.5])('rejeita deslocamento inválido (%s)', async (offset) => {
    await expect(repository.obterClientesSemRetorno({ tenantId: 'tenant-1', limit: 20, offset })).rejects.toThrow(
      'O deslocamento não pode ser negativo.'
    );
  });

  it('rejeita faixa de atraso desconhecida', async () => {
    await expect(
      repository.obterClientesSemRetorno({
        tenantId: 'tenant-1',
        overdueBand: 'inexistente' as any,
        limit: 20,
        offset: 0,
      })
    ).rejects.toThrow('Faixa de atraso desconhecida. Use até 15, 16 a 30, 31 a 60 ou mais de 60 dias.');
  });
});

const clientesFixture = {
  timezone: 'America/Sao_Paulo',
  business_today: '2026-06-15',
  period: { start: '2026-06-01', end: '2026-06-15' },
  previous_period: { start: '2026-05-17', end: '2026-05-31' },
  visitors: { unique_customers: 0, new_customers: 0, returning_customers: 0, new_single_visit: 0, unidentified_attendances: 0 },
  previous_visitors: { unique_customers: 0, new_customers: 0, returning_customers: 0, unidentified_attendances: 0 },
  buckets: [],
  single_visit_customers: [],
};

describe('RelatoriosRepository.obterClientes', () => {
  const mockAdapter: RelatoriosAdapter = mockAdapterFactory();

  const repository = new RelatoriosRepository(mockAdapter);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('repassa ao adaptador um pedido válido (mesma validação de período e granularidade do Faturamento)', async () => {
    vi.mocked(mockAdapter.obterClientes).mockResolvedValueOnce(clientesFixture);

    const result = await repository.obterClientes({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
      today: '2026-06-15',
    });

    expect(mockAdapter.obterClientes).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });
    expect(result.timezone).toBe('America/Sao_Paulo');
  });

  it('rejeita sem tenant informado', async () => {
    await expect(
      repository.obterClientes({
        tenantId: '',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow(RelatoriosValidationError);
    expect(mockAdapter.obterClientes).not.toHaveBeenCalled();
  });

  it('rejeita datas ausentes', async () => {
    await expect(
      repository.obterClientes({
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
      repository.obterClientes({
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
      repository.obterClientes({
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
      repository.obterClientes({
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
      repository.obterClientes({
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
      repository.obterClientes({
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
      repository.obterClientes({
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-06-15',
        granularity: 'day',
        today: '2026-06-15',
      })
    ).rejects.toThrow('A granularidade diária só é permitida em períodos de até 92 dias.');
  });

  it('aceita granularidade semanal em período acima de 92 dias', async () => {
    vi.mocked(mockAdapter.obterClientes).mockResolvedValueOnce(clientesFixture);

    await expect(
      repository.obterClientes({
        tenantId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-06-15',
        granularity: 'week',
        today: '2026-06-15',
      })
    ).resolves.toBeTruthy();
  });
});
