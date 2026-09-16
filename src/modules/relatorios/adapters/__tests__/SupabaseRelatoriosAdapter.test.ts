import { describe, expect, it, vi } from 'vitest';
import { SupabaseRelatoriosAdapter } from '../SupabaseRelatoriosAdapter';

const { mockRpc } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}));

describe('SupabaseRelatoriosAdapter', () => {
  it('chama get_revenue_report com o contrato atual e converte números', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        timezone: 'America/Sao_Paulo',
        business_today: '2026-06-15',
        period: { start: '2026-06-01', end: '2026-06-15' },
        previous_period: { start: '2026-05-17', end: '2026-05-31' },
        data_quality: { status: 'confirmed', confirmed_comandas: 3, estimated_comandas: 0, legacy_comandas: 0 },
        totals: {
          gross: '500.00',
          discounts: '20.00',
          net: '480.00',
          services_net: '400.00',
          products_net: '80.00',
          tips: '30.00',
          closed_comandas: 3,
          average_ticket: '160.00',
          received_total: '450.00',
        },
        previous_totals: {
          gross: '300.00',
          discounts: '10.00',
          net: '290.00',
          services_net: '250.00',
          products_net: '40.00',
          tips: '15.00',
          closed_comandas: 2,
          average_ticket: '145.00',
          received_total: '280.00',
        },
        received_by_method: [
          { method: 'pix', label: 'PIX', amount: '250.00', payments_count: 3, share: 0.5556 },
          { method: 'credit_card', label: 'Crédito', amount: '150.00', payments_count: 2, share: 0.3333 },
          { method: 'debit_card', label: 'Débito', amount: '0.00', payments_count: 0, share: 0 },
          { method: 'cash', label: 'Dinheiro', amount: '50.00', payments_count: 1, share: 0.1111 },
          { method: 'other', label: 'Outros', amount: '0.00', payments_count: 0, share: 0 },
        ],
        buckets: [
          {
            start_date: '2026-06-01',
            end_date: '2026-06-07',
            gross: '200.00',
            discounts: '0.00',
            net: '200.00',
            services_net: '180.00',
            products_net: '20.00',
            tips: '10.00',
            closed_comandas: 1,
            average_ticket: '200.00',
            received: '190.00',
            received_by_method: [
              { method: 'pix', label: 'PIX', amount: '190.00', payments_count: 2 },
              { method: 'credit_card', label: 'Crédito', amount: '0.00', payments_count: 0 },
              { method: 'debit_card', label: 'Débito', amount: '0.00', payments_count: 0 },
              { method: 'cash', label: 'Dinheiro', amount: '0.00', payments_count: 0 },
              { method: 'other', label: 'Outros', amount: '0.00', payments_count: 0 },
            ],
          },
        ],
        ticket_by_professional: [
          {
            professional_id: 'prof-1',
            name: 'Carlos',
            is_active: true,
            archived: false,
            net: '300.00',
            comandas: 2,
            average_ticket: '150.00',
          },
          {
            professional_id: 'prof-2',
            name: 'Bruna (arquivada)',
            is_active: false,
            archived: true,
            net: '180.00',
            comandas: 1,
            average_ticket: '180.00',
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterFaturamentoPorPeriodo({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_revenue_report', {
      p_tenant_id: 'tenant-1',
      p_start_date: '2026-06-01',
      p_end_date: '2026-06-15',
      p_granularity: 'day',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.data_quality.status).toBe('confirmed');
    expect(result.totals).toEqual({
      gross: 500,
      discounts: 20,
      net: 480,
      services_net: 400,
      products_net: 80,
      tips: 30,
      closed_comandas: 3,
      average_ticket: 160,
      received_total: 450,
    });
    expect(result.received_by_method).toEqual([
      { method: 'pix', label: 'PIX', amount: 250, payments_count: 3, share: 0.5556 },
      { method: 'credit_card', label: 'Crédito', amount: 150, payments_count: 2, share: 0.3333 },
      { method: 'debit_card', label: 'Débito', amount: 0, payments_count: 0, share: 0 },
      { method: 'cash', label: 'Dinheiro', amount: 50, payments_count: 1, share: 0.1111 },
      { method: 'other', label: 'Outros', amount: 0, payments_count: 0, share: 0 },
    ]);
    expect(result.buckets).toHaveLength(1);
    expect(result.buckets[0]).toEqual({
      start_date: '2026-06-01',
      end_date: '2026-06-07',
      gross: 200,
      discounts: 0,
      net: 200,
      services_net: 180,
      products_net: 20,
      tips: 10,
      closed_comandas: 1,
      average_ticket: 200,
      received: 190,
      received_by_method: [
        { method: 'pix', label: 'PIX', amount: 190, payments_count: 2 },
        { method: 'credit_card', label: 'Crédito', amount: 0, payments_count: 0 },
        { method: 'debit_card', label: 'Débito', amount: 0, payments_count: 0 },
        { method: 'cash', label: 'Dinheiro', amount: 0, payments_count: 0 },
        { method: 'other', label: 'Outros', amount: 0, payments_count: 0 },
      ],
    });
    expect(result.ticket_by_professional).toEqual([
      {
        professional_id: 'prof-1',
        name: 'Carlos',
        is_active: true,
        archived: false,
        net: 300,
        comandas: 2,
        average_ticket: 150,
      },
      {
        professional_id: 'prof-2',
        name: 'Bruna (arquivada)',
        is_active: false,
        archived: true,
        net: 180,
        comandas: 1,
        average_ticket: 180,
      },
    ]);
  });

  it('preserva share nulo (período sem recebimento) sem coagir para zero', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        received_by_method: [
          { method: 'pix', label: 'PIX', amount: 0, payments_count: 0, share: null },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterFaturamentoPorPeriodo({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.received_by_method).toEqual([{ method: 'pix', label: 'PIX', amount: 0, payments_count: 0, share: null }]);
  });

  it('preserva average_ticket nulo (agrupamento/período sem Comanda com item reconhecido) sem coagir para zero', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        totals: { average_ticket: null },
        previous_totals: { average_ticket: null },
        buckets: [
          {
            start_date: '2026-06-01',
            end_date: '2026-06-01',
            average_ticket: null,
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterFaturamentoPorPeriodo({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.totals.average_ticket).toBeNull();
    expect(result.previous_totals.average_ticket).toBeNull();
    expect(result.buckets[0].average_ticket).toBeNull();
  });

  it('parseia ticket_by_professional incluindo inativos e arquivados, ordenados como a API devolveu', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ticket_by_professional: [
          {
            professional_id: 'prof-1',
            name: 'Carlos',
            is_active: true,
            archived: false,
            net: 300,
            comandas: 2,
            average_ticket: 150,
          },
          {
            professional_id: 'prof-3',
            name: 'Sem item ainda',
            is_active: true,
            archived: false,
            net: 0,
            comandas: 0,
            average_ticket: null,
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterFaturamentoPorPeriodo({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.ticket_by_professional).toEqual([
      {
        professional_id: 'prof-1',
        name: 'Carlos',
        is_active: true,
        archived: false,
        net: 300,
        comandas: 2,
        average_ticket: 150,
      },
      {
        professional_id: 'prof-3',
        name: 'Sem item ainda',
        is_active: true,
        archived: false,
        net: 0,
        comandas: 0,
        average_ticket: null,
      },
    ]);
  });

  it('preenche campos ausentes com zero, string vazia ou lista vazia', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    const result = await new SupabaseRelatoriosAdapter().obterFaturamentoPorPeriodo({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.business_today).toBe('');
    expect(result.period).toEqual({ start: '', end: '' });
    expect(result.data_quality).toEqual({
      status: 'unavailable',
      confirmed_comandas: 0,
      estimated_comandas: 0,
      legacy_comandas: 0,
    });
    expect(result.totals).toEqual({
      gross: 0,
      discounts: 0,
      net: 0,
      services_net: 0,
      products_net: 0,
      tips: 0,
      closed_comandas: 0,
      average_ticket: null,
      received_total: 0,
    });
    expect(result.received_by_method).toEqual([]);
    expect(result.buckets).toEqual([]);
    expect(result.ticket_by_professional).toEqual([]);
  });

  it('lança erro quando a RPC devolve erro', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Acesso negado.' } });

    await expect(
      new SupabaseRelatoriosAdapter().obterFaturamentoPorPeriodo({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        granularity: 'day',
      })
    ).rejects.toThrow('Acesso negado.');
  });
});
