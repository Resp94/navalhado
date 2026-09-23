import { dateInZone, localDayUtcRange, shiftCalendarDate } from '../../lib/timezone';

export type PeriodoComissao = 'today' | '7days' | 'month';

export interface IntervaloComissao {
  /** Início do primeiro dia do período, em ISO 8601. */
  startIso: string;
  /** O instante da consulta: a comissão só nasce no fechamento, então nada existe depois dele. */
  endIso: string;
}

/**
 * Recorte de "hoje", "7 dias" e "mês" no fuso da barbearia, não no do navegador: o dia da barbearia
 * é o mesmo para o barbeiro, para o gestor e para o banco.
 */
export const intervaloDeComissao = (periodo: PeriodoComissao, agora: Date, timezone: string): IntervaloComissao => {
  const hoje = dateInZone(agora, timezone);
  const primeiroDia =
    periodo === 'today' ? hoje : periodo === '7days' ? shiftCalendarDate(hoje, -7) : `${hoje.slice(0, 8)}01`;

  return { startIso: localDayUtcRange(primeiroDia, timezone).start, endIso: agora.toISOString() };
};
