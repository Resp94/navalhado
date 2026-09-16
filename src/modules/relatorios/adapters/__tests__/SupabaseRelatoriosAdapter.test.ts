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

describe('SupabaseRelatoriosAdapter.obterEquipeEServicos', () => {
  it('chama get_team_services_report com o contrato atual e converte números', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        timezone: 'America/Sao_Paulo',
        business_today: '2026-06-15',
        period: { start: '2026-06-01', end: '2026-06-15' },
        data_quality: { status: 'confirmed', confirmed_comandas: 3, estimated_comandas: 0, legacy_comandas: 0 },
        professionals: [
          {
            professional_id: 'prof-1',
            name: 'Carlos',
            is_active: true,
            archived: false,
            net: '300.00',
            gross: '320.00',
            share: 0.625,
            attendances: 2,
            services_quantity: 3,
            products_net: '50.00',
            average_ticket: '150.00',
            commission: '30.00',
          },
          {
            professional_id: 'prof-2',
            name: 'Bruna (arquivada)',
            is_active: false,
            archived: true,
            net: '180.00',
            gross: '180.00',
            share: 0.375,
            attendances: 0,
            services_quantity: 0,
            products_net: '180.00',
            average_ticket: null,
            commission: '18.00',
          },
        ],
        services: [
          {
            service_id: 'svc-1',
            name: 'Corte',
            category: 'Cabelo',
            archived: false,
            quantity: 3,
            net: '270.00',
            share: 1,
            average_unit_net: '90.00',
          },
        ],
        totals: { net: '480.00', services_net: '270.00', attendances: 2 },
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterEquipeEServicos({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_team_services_report', {
      p_tenant_id: 'tenant-1',
      p_start_date: '2026-06-01',
      p_end_date: '2026-06-15',
      p_professional_id: null,
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.data_quality.status).toBe('confirmed');
    expect(result.totals).toEqual({ net: 480, services_net: 270, attendances: 2 });
    expect(result.professionals).toEqual([
      {
        professional_id: 'prof-1',
        name: 'Carlos',
        is_active: true,
        archived: false,
        net: 300,
        gross: 320,
        share: 0.625,
        attendances: 2,
        services_quantity: 3,
        products_net: 50,
        average_ticket: 150,
        commission: 30,
      },
      {
        professional_id: 'prof-2',
        name: 'Bruna (arquivada)',
        is_active: false,
        archived: true,
        net: 180,
        gross: 180,
        share: 0.375,
        attendances: 0,
        services_quantity: 0,
        products_net: 180,
        average_ticket: null,
        commission: 18,
      },
    ]);
    expect(result.services).toEqual([
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
    ]);
  });

  it('passa p_professional_id quando informado', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    await new SupabaseRelatoriosAdapter().obterEquipeEServicos({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      professionalId: 'prof-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_team_services_report', {
      p_tenant_id: 'tenant-1',
      p_start_date: '2026-06-01',
      p_end_date: '2026-06-15',
      p_professional_id: 'prof-1',
    });
  });

  it('preserva share e average_ticket/average_unit_net nulos sem coagir para zero', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        professionals: [
          {
            professional_id: 'prof-1',
            name: 'Sem venda',
            is_active: true,
            archived: false,
            net: 0,
            gross: 0,
            share: null,
            attendances: 0,
            services_quantity: 0,
            products_net: 0,
            average_ticket: null,
            commission: 0,
          },
        ],
        services: [
          {
            service_id: 'svc-1',
            name: 'Corte',
            category: 'Cabelo',
            archived: false,
            quantity: 0,
            net: 0,
            share: null,
            average_unit_net: null,
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterEquipeEServicos({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    });

    expect(result.professionals[0].share).toBeNull();
    expect(result.professionals[0].average_ticket).toBeNull();
    expect(result.services[0].share).toBeNull();
    expect(result.services[0].average_unit_net).toBeNull();
  });

  it('preenche campos ausentes com zero, string vazia ou lista vazia', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    const result = await new SupabaseRelatoriosAdapter().obterEquipeEServicos({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
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
    expect(result.professionals).toEqual([]);
    expect(result.services).toEqual([]);
    expect(result.totals).toEqual({ net: 0, services_net: 0, attendances: 0 });
  });

  it('lança erro quando a RPC devolve erro', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Acesso negado.' } });

    await expect(
      new SupabaseRelatoriosAdapter().obterEquipeEServicos({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
      })
    ).rejects.toThrow('Acesso negado.');
  });
});

describe('SupabaseRelatoriosAdapter.obterAgenda', () => {
  it('chama get_schedule_report com o contrato atual e converte números', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
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
          attendance_rate: 0.8571,
          cancellation_rate: 0.2,
        },
        previous_status_totals: {
          total: 8,
          completed: 5,
          no_show: 1,
          canceled: 1,
          unresolved: 1,
          future: 0,
          attendance_rate: 0.8333,
          cancellation_rate: 0.1429,
        },
        by_origin: [
          {
            origin: 'manual',
            total: 5,
            completed: 3,
            no_show: 1,
            canceled: 1,
            unresolved: 0,
            attendance_rate: 0.75,
          },
        ],
        by_professional: [
          {
            professional_id: 'prof-1',
            name: 'Carlos',
            is_active: true,
            archived: false,
            total: 5,
            completed: 3,
            no_show: 1,
            canceled: 1,
            unresolved: 0,
            attendance_rate: 0.75,
          },
        ],
        cancellation_reasons: [{ reason: 'cliente desistiu', count: 2 }],
        heatmap: {
          hours: [9, 10, 11],
          cells: [
            { weekday: 1, hour: 9, count: 3 },
            { weekday: 1, hour: 10, count: 1 },
          ],
        },
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterAgenda({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_schedule_report', {
      p_tenant_id: 'tenant-1',
      p_start_date: '2026-06-01',
      p_end_date: '2026-06-15',
      p_professional_id: null,
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.status_totals).toEqual({
      total: 10,
      completed: 6,
      no_show: 1,
      canceled: 2,
      unresolved: 1,
      future: 0,
      attendance_rate: 0.8571,
      cancellation_rate: 0.2,
    });
    expect(result.by_origin).toEqual([
      { origin: 'manual', total: 5, completed: 3, no_show: 1, canceled: 1, unresolved: 0, attendance_rate: 0.75 },
    ]);
    expect(result.by_professional).toEqual([
      {
        professional_id: 'prof-1',
        name: 'Carlos',
        is_active: true,
        archived: false,
        total: 5,
        completed: 3,
        no_show: 1,
        canceled: 1,
        unresolved: 0,
        attendance_rate: 0.75,
      },
    ]);
    expect(result.cancellation_reasons).toEqual([{ reason: 'cliente desistiu', count: 2 }]);
    expect(result.heatmap).toEqual({
      hours: [9, 10, 11],
      cells: [
        { weekday: 1, hour: 9, count: 3 },
        { weekday: 1, hour: 10, count: 1 },
      ],
    });
  });

  it('passa p_professional_id quando informado', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    await new SupabaseRelatoriosAdapter().obterAgenda({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      professionalId: 'prof-1',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_schedule_report', {
      p_tenant_id: 'tenant-1',
      p_start_date: '2026-06-01',
      p_end_date: '2026-06-15',
      p_professional_id: 'prof-1',
    });
  });

  it('preserva attendance_rate e cancellation_rate nulos (denominador zero) sem coagir para zero', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        status_totals: { attendance_rate: null, cancellation_rate: null },
        previous_status_totals: { attendance_rate: null, cancellation_rate: null },
        by_origin: [{ origin: 'online', total: 0, completed: 0, no_show: 0, canceled: 0, unresolved: 0, attendance_rate: null }],
        by_professional: [
          {
            professional_id: 'prof-1',
            name: 'Carlos',
            is_active: true,
            archived: false,
            total: 0,
            completed: 0,
            no_show: 0,
            canceled: 0,
            unresolved: 0,
            attendance_rate: null,
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterAgenda({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    });

    expect(result.status_totals.attendance_rate).toBeNull();
    expect(result.status_totals.cancellation_rate).toBeNull();
    expect(result.previous_status_totals.attendance_rate).toBeNull();
    expect(result.previous_status_totals.cancellation_rate).toBeNull();
    expect(result.by_origin[0].attendance_rate).toBeNull();
    expect(result.by_professional[0].attendance_rate).toBeNull();
  });

  it('preenche campos ausentes com zero, string vazia ou lista vazia', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    const result = await new SupabaseRelatoriosAdapter().obterAgenda({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.business_today).toBe('');
    expect(result.period).toEqual({ start: '', end: '' });
    expect(result.previous_period).toEqual({ start: '', end: '' });
    expect(result.status_totals).toEqual({
      total: 0,
      completed: 0,
      no_show: 0,
      canceled: 0,
      unresolved: 0,
      future: 0,
      attendance_rate: null,
      cancellation_rate: null,
    });
    expect(result.by_origin).toEqual([]);
    expect(result.by_professional).toEqual([]);
    expect(result.cancellation_reasons).toEqual([]);
    expect(result.heatmap).toEqual({ hours: [], cells: [] });
  });

  it('lança erro quando a RPC devolve erro', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Acesso negado.' } });

    await expect(
      new SupabaseRelatoriosAdapter().obterAgenda({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
      })
    ).rejects.toThrow('Acesso negado.');
  });

  it('chama get_customers_without_return com o contrato atual e converte números', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        timezone: 'America/Sao_Paulo',
        business_today: '2026-06-15',
        totals: { without_return: 3, within_return: 10, no_visit_ever: 2 },
        bands: { up_to_15: 1, d16_30: 1, d31_60: 1, over_60: 0 },
        items: [
          {
            customer_id: 'cust-1',
            name: 'Ana',
            phone: '11999998888',
            has_phone: true,
            last_visit_date: '2026-05-01',
            last_service_name: 'Corte',
            last_professional_name: 'Carlos',
            return_period_days: 20,
            days_since: 45,
            days_overdue: 25,
          },
        ],
        total_count: 3,
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterClientesSemRetorno({
      tenantId: 'tenant-1',
      limit: 20,
      offset: 0,
    });

    expect(mockRpc).toHaveBeenCalledWith('get_customers_without_return', {
      p_tenant_id: 'tenant-1',
      p_overdue_band: null,
      p_professional_id: null,
      p_limit: 20,
      p_offset: 0,
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.business_today).toBe('2026-06-15');
    expect(result.totals).toEqual({ without_return: 3, within_return: 10, no_visit_ever: 2 });
    expect(result.bands).toEqual({ up_to_15: 1, d16_30: 1, d31_60: 1, over_60: 0 });
    expect(result.total_count).toBe(3);
    expect(result.items).toEqual([
      {
        customer_id: 'cust-1',
        name: 'Ana',
        phone: '11999998888',
        has_phone: true,
        last_visit_date: '2026-05-01',
        last_service_name: 'Corte',
        last_professional_name: 'Carlos',
        return_period_days: 20,
        days_since: 45,
        days_overdue: 25,
      },
    ]);
  });

  it('passa p_overdue_band e p_professional_id quando informados', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    await new SupabaseRelatoriosAdapter().obterClientesSemRetorno({
      tenantId: 'tenant-1',
      overdueBand: 'over_60',
      professionalId: 'prof-1',
      limit: 20,
      offset: 20,
    });

    expect(mockRpc).toHaveBeenCalledWith('get_customers_without_return', {
      p_tenant_id: 'tenant-1',
      p_overdue_band: 'over_60',
      p_professional_id: 'prof-1',
      p_limit: 20,
      p_offset: 20,
    });
  });

  it('preserva phone, last_service_name e last_professional_name nulos sem coagir para string vazia', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        items: [
          {
            customer_id: 'cust-2',
            name: 'Bruno',
            phone: null,
            has_phone: false,
            last_visit_date: '2026-05-10',
            last_service_name: null,
            last_professional_name: null,
            return_period_days: 20,
            days_since: 30,
            days_overdue: 10,
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterClientesSemRetorno({
      tenantId: 'tenant-1',
      limit: 20,
      offset: 0,
    });

    expect(result.items[0].phone).toBeNull();
    expect(result.items[0].has_phone).toBe(false);
    expect(result.items[0].last_service_name).toBeNull();
    expect(result.items[0].last_professional_name).toBeNull();
  });

  it('preenche campos ausentes com zero, string vazia ou lista vazia', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    const result = await new SupabaseRelatoriosAdapter().obterClientesSemRetorno({
      tenantId: 'tenant-1',
      limit: 20,
      offset: 0,
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.business_today).toBe('');
    expect(result.totals).toEqual({ without_return: 0, within_return: 0, no_visit_ever: 0 });
    expect(result.bands).toEqual({ up_to_15: 0, d16_30: 0, d31_60: 0, over_60: 0 });
    expect(result.items).toEqual([]);
    expect(result.total_count).toBe(0);
  });

  it('lança erro quando a RPC devolve erro (Clientes sem Retorno)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Acesso negado.' } });

    await expect(
      new SupabaseRelatoriosAdapter().obterClientesSemRetorno({
        tenantId: 'tenant-1',
        limit: 20,
        offset: 0,
      })
    ).rejects.toThrow('Acesso negado.');
  });
});

describe('SupabaseRelatoriosAdapter.obterClientes', () => {
  it('chama get_customer_report com o contrato atual e converte números', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        timezone: 'America/Sao_Paulo',
        business_today: '2026-06-15',
        period: { start: '2026-06-01', end: '2026-06-15' },
        previous_period: { start: '2026-05-17', end: '2026-05-31' },
        visitors: {
          unique_customers: 10,
          new_customers: 4,
          returning_customers: 6,
          new_single_visit: 2,
          unidentified_attendances: 1,
        },
        previous_visitors: {
          unique_customers: 8,
          new_customers: 3,
          returning_customers: 5,
          unidentified_attendances: 0,
        },
        buckets: [
          { start_date: '2026-06-01', end_date: '2026-06-07', new_customers: 2, returning_customers: 3 },
          { start_date: '2026-06-08', end_date: '2026-06-15', new_customers: 2, returning_customers: 3 },
        ],
        single_visit_customers: [
          {
            customer_id: 'cust-1',
            name: 'Ana',
            phone: '11999998888',
            visit_date: '2026-06-10',
            professional_name: 'Carlos',
          },
        ],
        registrations: {
          total: 6,
          provisional: 2,
          by_registration_origin: [
            { origin: 'balcao', total: 2, with_visit: 0 },
            { origin: 'agenda', total: 1, with_visit: 1 },
            { origin: 'online', total: 1, with_visit: 0 },
            { origin: 'canal_cliente', total: 1, with_visit: 0 },
            { origin: 'whatsapp_bot', total: 1, with_visit: 1 },
          ],
          by_acquisition_channel: [
            { channel: 'instagram', total: 3, with_visit: 1 },
            { channel: 'Não informado', total: 2, with_visit: 0 },
            { channel: 'Google', total: 1, with_visit: 1 },
          ],
          acquisition_channel_filled_share: 0.6667,
        },
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterClientes({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(mockRpc).toHaveBeenCalledWith('get_customer_report', {
      p_tenant_id: 'tenant-1',
      p_start_date: '2026-06-01',
      p_end_date: '2026-06-15',
      p_granularity: 'day',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.visitors).toEqual({
      unique_customers: 10,
      new_customers: 4,
      returning_customers: 6,
      new_single_visit: 2,
      unidentified_attendances: 1,
    });
    expect(result.previous_visitors).toEqual({
      unique_customers: 8,
      new_customers: 3,
      returning_customers: 5,
      unidentified_attendances: 0,
    });
    expect(result.buckets).toEqual([
      { start_date: '2026-06-01', end_date: '2026-06-07', new_customers: 2, returning_customers: 3 },
      { start_date: '2026-06-08', end_date: '2026-06-15', new_customers: 2, returning_customers: 3 },
    ]);
    expect(result.single_visit_customers).toEqual([
      { customer_id: 'cust-1', name: 'Ana', phone: '11999998888', visit_date: '2026-06-10', professional_name: 'Carlos' },
    ]);
    expect(result.registrations).toEqual({
      total: 6,
      provisional: 2,
      by_registration_origin: [
        { origin: 'balcao', total: 2, with_visit: 0 },
        { origin: 'agenda', total: 1, with_visit: 1 },
        { origin: 'online', total: 1, with_visit: 0 },
        { origin: 'canal_cliente', total: 1, with_visit: 0 },
        { origin: 'whatsapp_bot', total: 1, with_visit: 1 },
      ],
      by_acquisition_channel: [
        { channel: 'instagram', total: 3, with_visit: 1 },
        { channel: 'Não informado', total: 2, with_visit: 0 },
        { channel: 'Google', total: 1, with_visit: 1 },
      ],
      acquisition_channel_filled_share: 0.6667,
    });
  });

  it('preserva acquisition_channel_filled_share nulo (período sem cadastro) sem coagir para zero', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        registrations: {
          total: 0,
          provisional: 0,
          by_registration_origin: [],
          by_acquisition_channel: [],
          acquisition_channel_filled_share: null,
        },
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterClientes({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.registrations.acquisition_channel_filled_share).toBeNull();
    expect(result.registrations.total).toBe(0);
    expect(result.registrations.by_registration_origin).toEqual([]);
    expect(result.registrations.by_acquisition_channel).toEqual([]);
  });

  it('nunca inventa new_single_visit em previous_visitors, mesmo se o backend enviar por engano', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        previous_visitors: {
          unique_customers: 8,
          new_customers: 3,
          returning_customers: 5,
          unidentified_attendances: 0,
          new_single_visit: 999,
        },
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterClientes({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.previous_visitors).not.toHaveProperty('new_single_visit');
    expect(result.previous_visitors).toEqual({
      unique_customers: 8,
      new_customers: 3,
      returning_customers: 5,
      unidentified_attendances: 0,
    });
  });

  it('preserva phone e professional_name nulos em single_visit_customers sem coagir para string vazia', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        single_visit_customers: [
          {
            customer_id: 'cust-2',
            name: 'Bruno',
            phone: null,
            visit_date: '2026-06-11',
            professional_name: null,
          },
        ],
      },
      error: null,
    });

    const result = await new SupabaseRelatoriosAdapter().obterClientes({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.single_visit_customers[0].phone).toBeNull();
    expect(result.single_visit_customers[0].professional_name).toBeNull();
  });

  it('preenche campos ausentes com zero, string vazia ou lista vazia', async () => {
    mockRpc.mockResolvedValueOnce({ data: {}, error: null });

    const result = await new SupabaseRelatoriosAdapter().obterClientes({
      tenantId: 'tenant-1',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      granularity: 'day',
    });

    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.business_today).toBe('');
    expect(result.period).toEqual({ start: '', end: '' });
    expect(result.previous_period).toEqual({ start: '', end: '' });
    expect(result.visitors).toEqual({
      unique_customers: 0,
      new_customers: 0,
      returning_customers: 0,
      new_single_visit: 0,
      unidentified_attendances: 0,
    });
    expect(result.previous_visitors).toEqual({
      unique_customers: 0,
      new_customers: 0,
      returning_customers: 0,
      unidentified_attendances: 0,
    });
    expect(result.buckets).toEqual([]);
    expect(result.single_visit_customers).toEqual([]);
    expect(result.registrations).toEqual({
      total: 0,
      provisional: 0,
      by_registration_origin: [],
      by_acquisition_channel: [],
      acquisition_channel_filled_share: null,
    });
  });

  it('lança erro quando a RPC devolve erro (Clientes)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Acesso negado.' } });

    await expect(
      new SupabaseRelatoriosAdapter().obterClientes({
        tenantId: 'tenant-1',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
        granularity: 'day',
      })
    ).rejects.toThrow('Acesso negado.');
  });
});
