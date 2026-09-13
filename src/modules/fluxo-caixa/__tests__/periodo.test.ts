import { describe, expect, it } from 'vitest';
import { getFluxoCaixaPeriodShortcutRange, suggestFluxoCaixaGranularity } from '../periodo';
import { dateInZone } from '../../../lib/timezone';

describe('getFluxoCaixaPeriodShortcutRange', () => {
  it('próximos 30 dias vai de hoje a hoje + 29, granularidade dia', () => {
    const range = getFluxoCaixaPeriodShortcutRange('next_30_days', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-06-10', endDate: '2026-07-09', granularity: 'day' });
  });

  it('este mês vai do primeiro ao último dia do mês, granularidade dia', () => {
    const range = getFluxoCaixaPeriodShortcutRange('this_month', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-06-01', endDate: '2026-06-30', granularity: 'day' });
  });

  it('próximos 3 meses vai de hoje a hoje + 89, granularidade semana', () => {
    const range = getFluxoCaixaPeriodShortcutRange('next_3_months', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-06-10', endDate: '2026-09-07', granularity: 'week' });
  });

  it('próximos 12 meses vai de hoje a hoje + 364, granularidade mês', () => {
    const range = getFluxoCaixaPeriodShortcutRange('next_12_months', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-06-10', endDate: '2027-06-09', granularity: 'month' });
  });

  it('virada de mês: próximos 30 dias a partir do último dia de janeiro atravessa fevereiro', () => {
    const range = getFluxoCaixaPeriodShortcutRange('next_30_days', '2026-01-31');
    expect(range).toEqual({ startDate: '2026-01-31', endDate: '2026-03-01', granularity: 'day' });
  });

  it('virada de mês: este mês respeita fevereiro (ano não bissexto)', () => {
    const range = getFluxoCaixaPeriodShortcutRange('this_month', '2026-02-15');
    expect(range).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28', granularity: 'day' });
  });

  it('virada de ano: próximos 12 meses a partir de dezembro atravessa o ano seguinte', () => {
    const range = getFluxoCaixaPeriodShortcutRange('next_12_months', '2026-12-20');
    expect(range).toEqual({ startDate: '2026-12-20', endDate: '2027-12-19', granularity: 'month' });
  });

  it('usa o dia de hoje do fuso do tenant, mesmo num instante em que o dia UTC já é outro', () => {
    // 2026-06-09 23:30 em America/Sao_Paulo (UTC-3) é 2026-06-10 02:30 UTC:
    // o dia UTC já virou, mas o dia local do tenant ainda é o dia anterior.
    const instant = new Date('2026-06-10T02:30:00.000Z');
    const todayInTenantZone = dateInZone(instant, 'America/Sao_Paulo');

    expect(todayInTenantZone).toBe('2026-06-09');

    const range = getFluxoCaixaPeriodShortcutRange('next_30_days', todayInTenantZone);
    expect(range.startDate).toBe('2026-06-09');
    expect(range.startDate).not.toBe(instant.toISOString().slice(0, 10));
  });
});

describe('suggestFluxoCaixaGranularity', () => {
  it('sugere dia para períodos de até 92 dias', () => {
    expect(suggestFluxoCaixaGranularity('2026-06-01', '2026-08-31')).toBe('day');
  });

  it('sugere semana para períodos entre 93 e 184 dias', () => {
    expect(suggestFluxoCaixaGranularity('2026-01-01', '2026-06-01')).toBe('week');
  });

  it('sugere mês para períodos acima de 184 dias', () => {
    expect(suggestFluxoCaixaGranularity('2026-01-01', '2026-12-31')).toBe('month');
  });
});
