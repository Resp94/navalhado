import { describe, expect, it } from 'vitest';
import { aggregateDailyFinancialSummary } from '../dailyFinancial';

describe('aggregateDailyFinancialSummary', () => {
  it('separa faturamento de recebimentos e não duplica comanda com pagamento dividido', () => {
    const result = aggregateDailyFinancialSummary(
      {
        startDate: '2026-08-28',
        endDate: '2026-08-29',
        timeZone: 'America/Manaus',
      },
      [
        { id: 'comanda-1', total_amount: '80.00', closed_at: '2026-08-29T02:30:00.000Z' },
      ],
      [
        { id: 'payment-1', payment_method: 'pix', amount: '30.00', paid_at: '2026-08-29T02:40:00.000Z' },
        { id: 'payment-2', payment_method: 'cash', amount: '50.00', paid_at: '2026-08-29T04:10:00.000Z' },
      ],
    );

    expect(result).toEqual([
      expect.objectContaining({
        date: '2026-08-28',
        realized_revenue: 80,
        received_total: 30,
        closed_comandas_count: 1,
        payment_count: 1,
        by_method: expect.objectContaining({ pix: 30, dinheiro: 0 }),
      }),
      expect.objectContaining({
        date: '2026-08-29',
        realized_revenue: 0,
        received_total: 50,
        closed_comandas_count: 0,
        payment_count: 1,
        by_method: expect.objectContaining({ dinheiro: 50, pix: 0 }),
      }),
    ]);
  });

  it('converte fechamento e pagamento para o fuso do tenant', () => {
    const result = aggregateDailyFinancialSummary(
      {
        startDate: '2026-08-28',
        endDate: '2026-08-28',
        timeZone: 'America/Sao_Paulo',
      },
      [{ id: 'comanda-1', total_amount: 40, closed_at: '2026-08-29T02:30:00.000Z' }],
      [{ id: 'payment-1', payment_method: 'credit_card', amount: 40, paid_at: '2026-08-29T02:45:00.000Z' }],
    );

    expect(result[0]).toMatchObject({
      date: '2026-08-28',
      realized_revenue: 40,
      received_total: 40,
      by_method: expect.objectContaining({ cartao: 40 }),
    });
  });

  it('rejeita intervalo local inválido', () => {
    expect(() =>
      aggregateDailyFinancialSummary(
        { startDate: '2026-08-30', endDate: '2026-08-29', timeZone: 'America/Manaus' },
        [],
        [],
      ),
    ).toThrow('O período financeiro diário é inválido.');
  });
});
