import { describe, it, expect } from 'vitest';
import { calculateLTVMetrics } from '../utils';
import type { ComandaHistoricoCliente, HistoricoVisitasCliente } from '../types';

const TZ = 'America/Sao_Paulo';

function appointment(overrides: Partial<HistoricoVisitasCliente>): HistoricoVisitasCliente {
  return {
    id: 'a1',
    start_time: '2026-03-10T13:00:00Z',
    status: 'completed',
    payment_status: 'paid',
    service_name: 'Corte',
    service_price: 50,
    professional_name: 'Barbeiro 1',
    ...overrides,
  };
}

function comanda(overrides: Partial<ComandaHistoricoCliente>): ComandaHistoricoCliente {
  return {
    id: 'cmd1',
    comanda_number: 1,
    appointment_id: null,
    status: 'fechada',
    total_final: 80,
    tip_amount: 0,
    closed_at: '2026-03-10T14:00:00Z',
    created_at: '2026-03-10T13:00:00Z',
    items: [],
    ...overrides,
  };
}

describe('calculateLTVMetrics (Central 360º)', () => {
  it('usa Comandas com o status gravado pelo banco (fechada)', () => {
    const metrics = calculateLTVMetrics('c1', [], [comanda({ total_final: 80 })], TZ);

    expect(metrics.totalSpend).toBe(80);
    expect(metrics.totalVisits).toBe(1);
  });

  it('ignora Comandas abertas e canceladas', () => {
    const metrics = calculateLTVMetrics(
      'c1',
      [],
      [
        comanda({ id: 'aberta', status: 'aberta', closed_at: null, total_final: 40 }),
        comanda({ id: 'cancelada', status: 'cancelada', closed_at: null, total_final: 60 }),
      ],
      TZ
    );

    expect(metrics.totalSpend).toBe(0);
    expect(metrics.totalVisits).toBe(0);
  });

  it('não soma gorjeta ao total gasto', () => {
    // total_amount no banco = subtotal 80 - desconto 10 + gorjeta 20 = 90
    const metrics = calculateLTVMetrics('c1', [], [comanda({ total_final: 90, tip_amount: 20 })], TZ);

    expect(metrics.totalSpend).toBe(70);
    expect(metrics.averageTicket).toBe(70);
  });

  it('usa o valor da Comanda fechada, e não o preço do serviço, quando o Agendamento tem Comanda', () => {
    const metrics = calculateLTVMetrics(
      'c1',
      [appointment({ id: 'a1', service_price: 50 })],
      [comanda({ appointment_id: 'a1', total_final: 80 })],
      TZ
    );

    expect(metrics.totalSpend).toBe(80);
  });

  it('conta Agendamento concluído e Comanda fechada no mesmo dia de negócio como uma Visita', () => {
    const metrics = calculateLTVMetrics(
      'c1',
      [appointment({ id: 'a1', start_time: '2026-03-10T13:00:00Z' })],
      // Comanda de balcão, sem vínculo, fechada às 22:30 locais (01:30 UTC do dia seguinte)
      [comanda({ appointment_id: null, closed_at: '2026-03-11T01:30:00Z', total_final: 30 })],
      TZ
    );

    expect(metrics.totalVisits).toBe(1);
    expect(metrics.lastVisitDate).toBe('2026-03-10');
  });

  it('conta Agendamento concluído sem Comanda fechada como Visita, estimando pelo preço do serviço', () => {
    const metrics = calculateLTVMetrics(
      'c1',
      [
        appointment({ id: 'a1', start_time: '2026-03-01T13:00:00Z', service_price: 50 }),
        appointment({ id: 'a2', start_time: '2026-03-15T13:00:00Z', service_price: 45 }),
      ],
      [comanda({ appointment_id: 'a1', closed_at: '2026-03-01T14:00:00Z', total_final: 60 })],
      TZ
    );

    expect(metrics.totalVisits).toBe(2);
    expect(metrics.totalSpend).toBe(105);
    expect(metrics.averageTicket).toBe(52.5);
  });

  it('calcula o intervalo médio e a última Visita pelos dias de negócio do tenant', () => {
    const metrics = calculateLTVMetrics(
      'c1',
      [],
      [
        // 23:00 locais do dia 1º (02:00 UTC do dia 2)
        comanda({ id: 'x1', closed_at: '2026-03-02T02:00:00Z' }),
        // 09:00 locais do dia 21
        comanda({ id: 'x2', closed_at: '2026-03-21T12:00:00Z' }),
      ],
      TZ
    );

    expect(metrics.totalVisits).toBe(2);
    expect(metrics.averageDaysBetweenVisits).toBe(20);
    expect(metrics.lastVisitDate).toBe('2026-03-21');
  });

  it('ignora Agendamentos não concluídos', () => {
    const metrics = calculateLTVMetrics(
      'c1',
      [appointment({ status: 'confirmed' }), appointment({ id: 'a2', status: 'canceled' })],
      [],
      TZ
    );

    expect(metrics.totalVisits).toBe(0);
    expect(metrics.lastVisitDate).toBeNull();
  });
});
