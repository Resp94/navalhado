/**
 * Aritmética de calendário compartilhada do Fluxo de Caixa Projetado (spec
 * 037): único ponto que converte uma data 'AAAA-MM-DD' em instante UTC e
 * conta dias entre duas datas. `FluxoCaixaRepository` (limites de período)
 * e `periodo.ts` (sugestão de granularidade) consomem daqui, para que as
 * duas contagens nunca divirjam.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseDateOnly(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Data inválida. Use o formato AAAA-MM-DD: ${value}`);
  }
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/** Extensão do período em dias, inclusive nas duas pontas. */
export function calendarExtentInDays(startDate: string, endDate: string): number {
  return Math.round((parseDateOnly(endDate) - parseDateOnly(startDate)) / MS_PER_DAY) + 1;
}
