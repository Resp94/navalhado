import { dateInZone, shiftCalendarDate } from '../../lib/timezone';
import { getPaymentCategory } from './types';
import type { DailyFinancialSummary, PaymentCategory } from './types';

export interface DailyFinancialAggregationQuery {
  startDate: string;
  endDate: string;
  timeZone: string;
}

export interface ClosedComandaFinancialRow {
  id: string;
  total_amount: number | string;
  closed_at: string | null;
}

export interface PaidFinancialRow {
  id: string;
  payment_method: string;
  amount: number | string;
  paid_at: string;
}

const DAILY_METHOD_CATEGORIES: PaymentCategory[] = ['dinheiro', 'pix', 'cartao', 'outros'];

function isLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function createEmptySummary(date: string): DailyFinancialSummary {
  return {
    date,
    realized_revenue: 0,
    received_total: 0,
    by_method: {
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      outros: 0,
    },
    closed_comandas_count: 0,
    payment_count: 0,
  };
}

export function aggregateDailyFinancialSummary(
  query: DailyFinancialAggregationQuery,
  closedComandas: ClosedComandaFinancialRow[],
  payments: PaidFinancialRow[],
): DailyFinancialSummary[] {
  if (
    !isLocalDate(query.startDate) ||
    !isLocalDate(query.endDate) ||
    query.startDate > query.endDate
  ) {
    throw new Error('O período financeiro diário é inválido.');
  }

  const byDate = new Map<string, DailyFinancialSummary>();
  let currentDate = query.startDate;
  while (currentDate <= query.endDate) {
    byDate.set(currentDate, createEmptySummary(currentDate));
    currentDate = shiftCalendarDate(currentDate, 1);
  }

  for (const comanda of closedComandas) {
    if (!comanda.closed_at) continue;
    const localDate = dateInZone(new Date(comanda.closed_at), query.timeZone);
    const summary = byDate.get(localDate);
    if (!summary) continue;

    summary.realized_revenue += Number(comanda.total_amount) || 0;
    summary.closed_comandas_count += 1;
  }

  for (const payment of payments) {
    const localDate = dateInZone(new Date(payment.paid_at), query.timeZone);
    const summary = byDate.get(localDate);
    if (!summary) continue;

    const amount = Number(payment.amount) || 0;
    const category = getPaymentCategory(payment.payment_method);
    summary.received_total += amount;
    summary.by_method[category] += amount;
    summary.payment_count += 1;
  }

  return [...byDate.values()].map((summary) => ({
    ...summary,
    realized_revenue: Number(summary.realized_revenue.toFixed(2)),
    received_total: Number(summary.received_total.toFixed(2)),
    by_method: Object.fromEntries(
      DAILY_METHOD_CATEGORIES.map((category) => [category, Number(summary.by_method[category].toFixed(2))]),
    ) as Record<PaymentCategory, number>,
  }));
}
