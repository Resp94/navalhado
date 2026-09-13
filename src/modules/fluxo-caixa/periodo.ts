import { shiftCalendarDate } from '../../lib/timezone';
import { calendarExtentInDays } from './calendario';
import type { FluxoCaixaGranularity } from './types';

export type FluxoCaixaPeriodShortcutId = 'next_30_days' | 'this_month' | 'next_3_months' | 'next_12_months';

export interface FluxoCaixaPeriodRange {
  startDate: string;
  endDate: string;
  granularity: FluxoCaixaGranularity;
}

function firstDayOfMonth(date: string): string {
  const [year, month] = date.split('-');
  return `${year}-${month}-01`;
}

function lastDayOfMonth(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  // Dia 0 do mês seguinte é o último dia do mês corrente (aritmética de
  // calendário em UTC, sem depender do fuso do navegador).
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Atalhos de período do Fluxo de Caixa Projetado (spec 037, seção "Períodos
 * e agrupamento"). Recebem sempre `today` já resolvido no fuso do tenant
 * (tipicamente via `dateInZone(new Date(), tenant.timezone)`), nunca a data
 * local do navegador.
 */
export function getFluxoCaixaPeriodShortcutRange(
  shortcut: FluxoCaixaPeriodShortcutId,
  today: string
): FluxoCaixaPeriodRange {
  switch (shortcut) {
    case 'next_30_days':
      return { startDate: today, endDate: shiftCalendarDate(today, 29), granularity: 'day' };
    case 'this_month':
      return { startDate: firstDayOfMonth(today), endDate: lastDayOfMonth(today), granularity: 'day' };
    case 'next_3_months':
      return { startDate: today, endDate: shiftCalendarDate(today, 89), granularity: 'week' };
    case 'next_12_months':
      return { startDate: today, endDate: shiftCalendarDate(today, 364), granularity: 'month' };
    default: {
      const exhaustiveCheck: never = shortcut;
      throw new Error(`Atalho de período desconhecido: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Sugestão de granularidade para um período personalizado, dentro dos
 * limites do banco: a granularidade diária só é aceita em períodos de até
 * 92 dias. Acima disso, sugere semana até 184 dias (por volta de 26
 * agrupamentos) e mês daí em diante, para manter tabela e gráfico legíveis.
 */
export function suggestFluxoCaixaGranularity(startDate: string, endDate: string): FluxoCaixaGranularity {
  const extent = calendarExtentInDays(startDate, endDate);
  if (extent <= 92) return 'day';
  if (extent <= 184) return 'week';
  return 'month';
}

/**
 * Verdadeiro quando `granularity` ainda cabe no período, sem recalcular a
 * sugestão inteira -- usado para preservar a granularidade que o gestor
 * escolheu manualmente no modo personalizado quando ele só ajusta as
 * datas, e só cair para a sugestão quando a escolha atual deixar de ser
 * válida (ex.: granularidade diária num período que passou de 92 dias).
 */
export function isGranularityWithinLimits(
  granularity: FluxoCaixaGranularity,
  startDate: string,
  endDate: string
): boolean {
  if (granularity !== 'day') return true;
  return calendarExtentInDays(startDate, endDate) <= 92;
}
