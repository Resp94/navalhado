import { shiftCalendarDate } from '../../lib/timezone';
import { calendarExtentInDays } from '../fluxo-caixa/calendario';
import type { RelatoriosGranularity } from './types';

/**
 * Aritmética de calendário compartilhada com o Fluxo de Caixa Projetado
 * (`calendarExtentInDays`, `MS_PER_DAY`/`parseDateOnly` via `RelatoriosRepository`):
 * é pura e já exportada por `../fluxo-caixa/calendario`, então este módulo
 * importa de lá em vez de duplicar a mesma conta de dias.
 */

export type RelatoriosPeriodShortcutId =
  | 'este_mes'
  | 'mes_passado'
  | 'ultimos_30'
  | 'ultimos_90'
  | 'este_ano'
  | 'personalizado';

export const RELATORIOS_DEFAULT_SHORTCUT: RelatoriosPeriodShortcutId = 'este_mes';

const SHORTCUTS: RelatoriosPeriodShortcutId[] = [
  'este_mes',
  'mes_passado',
  'ultimos_30',
  'ultimos_90',
  'este_ano',
  'personalizado',
];

const GRANULARITIES: RelatoriosGranularity[] = ['day', 'week', 'month'];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RelatoriosPeriodRange {
  startDate: string;
  endDate: string;
  granularity: RelatoriosGranularity;
}

export interface RelatoriosPeriodoState extends RelatoriosPeriodRange {
  shortcut: RelatoriosPeriodShortcutId;
}

function firstDayOfMonth(date: string): string {
  const [year, month] = date.split('-');
  return `${year}-${month}-01`;
}

function firstDayOfYear(date: string): string {
  const [year] = date.split('-');
  return `${year}-01-01`;
}

/** Último dia do mês anterior a `date` (dia 0 do mês corrente, em UTC). */
function lastDayOfPreviousMonth(date: string): string {
  const [yearStr, monthStr] = date.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  return new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
}

/**
 * Atalhos de período do Módulo de Relatórios (spec 038, seção "Período").
 * Recebem sempre `today` já resolvido no fuso do tenant (tipicamente via
 * `dateInZone(new Date(), tenant.timezone)`), nunca a data local do
 * navegador.
 */
export function getRelatoriosPeriodShortcutRange(
  shortcut: RelatoriosPeriodShortcutId,
  today: string
): RelatoriosPeriodRange {
  switch (shortcut) {
    case 'este_mes':
      return { startDate: firstDayOfMonth(today), endDate: today, granularity: 'day' };
    case 'mes_passado': {
      const lastDay = lastDayOfPreviousMonth(today);
      return { startDate: firstDayOfMonth(lastDay), endDate: lastDay, granularity: 'day' };
    }
    case 'ultimos_30':
      return { startDate: shiftCalendarDate(today, -29), endDate: today, granularity: 'day' };
    case 'ultimos_90':
      return { startDate: shiftCalendarDate(today, -89), endDate: today, granularity: 'week' };
    case 'este_ano':
      return { startDate: firstDayOfYear(today), endDate: today, granularity: 'month' };
    case 'personalizado':
      // Ponto de partida ao entrar em "personalizado" pela primeira vez, sem
      // atalho anterior: o próprio gestor escolhe as datas em seguida.
      return { startDate: today, endDate: today, granularity: 'day' };
    default: {
      const exhaustiveCheck: never = shortcut;
      throw new Error(`Atalho de período desconhecido: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Sugestão de granularidade para um período personalizado, dentro dos
 * limites do banco: a granularidade diária só é aceita em períodos de até
 * 92 dias. Acima disso, sugere semana até 184 dias e mês daí em diante,
 * pelo mesmo critério do Fluxo de Caixa Projetado.
 */
export function suggestRelatoriosGranularity(startDate: string, endDate: string): RelatoriosGranularity {
  const extent = calendarExtentInDays(startDate, endDate);
  if (extent <= 92) return 'day';
  if (extent <= 184) return 'week';
  return 'month';
}

/**
 * Verdadeiro quando `granularity` ainda cabe no período, sem recalcular a
 * sugestão inteira -- usado para preservar a granularidade escolhida à mão
 * pelo gestor no modo personalizado quando ele só ajusta as datas.
 */
export function isRelatoriosGranularityWithinLimits(
  granularity: RelatoriosGranularity,
  startDate: string,
  endDate: string
): boolean {
  if (granularity !== 'day') return true;
  return calendarExtentInDays(startDate, endDate) <= 92;
}

const PARAM_SHORTCUT = 'periodo';
const PARAM_START = 'inicio';
const PARAM_END = 'fim';
const PARAM_GRANULARITY = 'granularidade';

/**
 * Lê o período dos parâmetros de busca da URL (spec 038: "o período
 * escolhido fica na URL... e é preservado ao navegar entre as páginas").
 * Qualquer parâmetro ausente, desconhecido ou incoerente (datas fora do
 * formato AAAA-MM-DD, fim antes do início) faz o período cair no atalho
 * padrão -- nunca lança erro, porque a URL pode ter sido editada ou
 * compartilhada por engano.
 */
export function readRelatoriosPeriodoFromSearchParams(
  searchParams: URLSearchParams,
  today: string
): RelatoriosPeriodoState {
  const rawShortcut = searchParams.get(PARAM_SHORTCUT);
  const shortcut = SHORTCUTS.includes(rawShortcut as RelatoriosPeriodShortcutId)
    ? (rawShortcut as RelatoriosPeriodShortcutId)
    : null;

  if (shortcut && shortcut !== 'personalizado') {
    return { shortcut, ...getRelatoriosPeriodShortcutRange(shortcut, today) };
  }

  if (shortcut === 'personalizado') {
    const rawStart = searchParams.get(PARAM_START);
    const rawEnd = searchParams.get(PARAM_END);
    const rawGranularity = searchParams.get(PARAM_GRANULARITY);

    const datesValid =
      !!rawStart && !!rawEnd && ISO_DATE_RE.test(rawStart) && ISO_DATE_RE.test(rawEnd) && rawEnd >= rawStart;

    if (datesValid) {
      const granularity = GRANULARITIES.includes(rawGranularity as RelatoriosGranularity)
        ? (rawGranularity as RelatoriosGranularity)
        : suggestRelatoriosGranularity(rawStart as string, rawEnd as string);
      return { shortcut: 'personalizado', startDate: rawStart as string, endDate: rawEnd as string, granularity };
    }
  }

  return { shortcut: RELATORIOS_DEFAULT_SHORTCUT, ...getRelatoriosPeriodShortcutRange(RELATORIOS_DEFAULT_SHORTCUT, today) };
}

/**
 * Escreve o período nos parâmetros de busca, preservando os demais
 * parâmetros já presentes na URL (ex.: os de outra página do módulo).
 * Devolve uma nova instância -- não muta `searchParams`.
 */
export function writeRelatoriosPeriodoToSearchParams(
  searchParams: URLSearchParams,
  state: RelatoriosPeriodoState
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  next.set(PARAM_SHORTCUT, state.shortcut);
  next.set(PARAM_GRANULARITY, state.granularity);
  if (state.shortcut === 'personalizado') {
    next.set(PARAM_START, state.startDate);
    next.set(PARAM_END, state.endDate);
  } else {
    next.delete(PARAM_START);
    next.delete(PARAM_END);
  }
  return next;
}
