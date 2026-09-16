import { describe, expect, it } from 'vitest';
import {
  RELATORIOS_DEFAULT_SHORTCUT,
  getRelatoriosPeriodShortcutRange,
  isRelatoriosGranularityWithinLimits,
  readRelatoriosPeriodoFromSearchParams,
  suggestRelatoriosGranularity,
  writeRelatoriosPeriodoToSearchParams,
} from '../periodo';
import { dateInZone } from '../../../lib/timezone';

describe('getRelatoriosPeriodShortcutRange', () => {
  it('este mês vai do 1º dia do mês a hoje, granularidade dia', () => {
    const range = getRelatoriosPeriodShortcutRange('este_mes', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-06-01', endDate: '2026-06-10', granularity: 'day' });
  });

  it('mês passado vai do mês civil anterior inteiro, granularidade dia', () => {
    const range = getRelatoriosPeriodShortcutRange('mes_passado', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-05-01', endDate: '2026-05-31', granularity: 'day' });
  });

  it('mês passado em janeiro cai em dezembro do ano anterior', () => {
    const range = getRelatoriosPeriodShortcutRange('mes_passado', '2026-01-15');
    expect(range).toEqual({ startDate: '2025-12-01', endDate: '2025-12-31', granularity: 'day' });
  });

  it('últimos 30 dias vai de hoje-29 a hoje, granularidade dia', () => {
    const range = getRelatoriosPeriodShortcutRange('ultimos_30', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-05-12', endDate: '2026-06-10', granularity: 'day' });
  });

  it('últimos 90 dias vai de hoje-89 a hoje, granularidade semana', () => {
    const range = getRelatoriosPeriodShortcutRange('ultimos_90', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-03-13', endDate: '2026-06-10', granularity: 'week' });
  });

  it('este ano vai de 1º de janeiro a hoje, granularidade mês', () => {
    const range = getRelatoriosPeriodShortcutRange('este_ano', '2026-06-10');
    expect(range).toEqual({ startDate: '2026-01-01', endDate: '2026-06-10', granularity: 'month' });
  });

  it('virada de mês: este mês em fevereiro (ano não bissexto) vai até o dia 28', () => {
    const range = getRelatoriosPeriodShortcutRange('mes_passado', '2026-03-01');
    expect(range).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28', granularity: 'day' });
  });

  it('virada de ano: mês passado em janeiro de um ano bissexto ainda cai em dezembro anterior', () => {
    const range = getRelatoriosPeriodShortcutRange('mes_passado', '2028-01-05');
    expect(range).toEqual({ startDate: '2027-12-01', endDate: '2027-12-31', granularity: 'day' });
  });

  it('usa o dia de hoje do fuso do tenant, mesmo num instante em que o dia UTC já é outro', () => {
    // 2026-06-09 23:30 em America/Sao_Paulo (UTC-3) é 2026-06-10 02:30 UTC:
    // o dia UTC já virou, mas o dia local do tenant ainda é o dia anterior.
    const instant = new Date('2026-06-10T02:30:00.000Z');
    const todayInTenantZone = dateInZone(instant, 'America/Sao_Paulo');

    expect(todayInTenantZone).toBe('2026-06-09');

    const range = getRelatoriosPeriodShortcutRange('ultimos_30', todayInTenantZone);
    expect(range.endDate).toBe('2026-06-09');
    expect(range.endDate).not.toBe(instant.toISOString().slice(0, 10));
  });
});

describe('suggestRelatoriosGranularity / isRelatoriosGranularityWithinLimits', () => {
  it('sugere dia para períodos de até 92 dias', () => {
    expect(suggestRelatoriosGranularity('2026-06-01', '2026-08-31')).toBe('day');
  });

  it('sugere semana para períodos entre 93 e 184 dias', () => {
    expect(suggestRelatoriosGranularity('2026-01-01', '2026-06-01')).toBe('week');
  });

  it('sugere mês para períodos acima de 184 dias', () => {
    expect(suggestRelatoriosGranularity('2026-01-01', '2026-12-31')).toBe('month');
  });

  it('granularidade diária deixa de caber acima de 92 dias', () => {
    expect(isRelatoriosGranularityWithinLimits('day', '2026-01-01', '2026-01-10')).toBe(true);
    expect(isRelatoriosGranularityWithinLimits('day', '2026-01-01', '2026-12-31')).toBe(false);
  });

  it('semana e mês sempre cabem', () => {
    expect(isRelatoriosGranularityWithinLimits('week', '2026-01-01', '2026-12-31')).toBe(true);
    expect(isRelatoriosGranularityWithinLimits('month', '2026-01-01', '2026-12-31')).toBe(true);
  });
});

describe('período na URL', () => {
  const today = '2026-06-10';

  it('escreve e lê de volta um atalho', () => {
    const params = writeRelatoriosPeriodoToSearchParams(new URLSearchParams(), {
      shortcut: 'ultimos_90',
      startDate: '2026-03-13',
      endDate: '2026-06-10',
      granularity: 'week',
    });
    const state = readRelatoriosPeriodoFromSearchParams(params, today);
    expect(state).toEqual({
      shortcut: 'ultimos_90',
      startDate: '2026-03-13',
      endDate: '2026-06-10',
      granularity: 'week',
    });
  });

  it('escreve e lê de volta um período personalizado', () => {
    const params = writeRelatoriosPeriodoToSearchParams(new URLSearchParams(), {
      shortcut: 'personalizado',
      startDate: '2026-02-01',
      endDate: '2026-02-20',
      granularity: 'day',
    });
    const state = readRelatoriosPeriodoFromSearchParams(params, today);
    expect(state).toEqual({
      shortcut: 'personalizado',
      startDate: '2026-02-01',
      endDate: '2026-02-20',
      granularity: 'day',
    });
  });

  it('preserva outros parâmetros já presentes na URL', () => {
    const initial = new URLSearchParams('aba=resumo');
    const params = writeRelatoriosPeriodoToSearchParams(initial, {
      shortcut: 'este_mes',
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      granularity: 'day',
    });
    expect(params.get('aba')).toBe('resumo');
  });

  it('parâmetro de atalho desconhecido cai no padrão', () => {
    const state = readRelatoriosPeriodoFromSearchParams(new URLSearchParams('periodo=inexistente'), today);
    expect(state.shortcut).toBe(RELATORIOS_DEFAULT_SHORTCUT);
    expect(state).toEqual({ shortcut: RELATORIOS_DEFAULT_SHORTCUT, ...getRelatoriosPeriodShortcutRange(RELATORIOS_DEFAULT_SHORTCUT, today) });
  });

  it('personalizado com datas inválidas cai no padrão', () => {
    const state = readRelatoriosPeriodoFromSearchParams(
      new URLSearchParams('periodo=personalizado&inicio=2026-06-20&fim=2026-06-01'),
      today
    );
    expect(state.shortcut).toBe(RELATORIOS_DEFAULT_SHORTCUT);
  });

  it('personalizado sem datas cai no padrão', () => {
    const state = readRelatoriosPeriodoFromSearchParams(new URLSearchParams('periodo=personalizado'), today);
    expect(state.shortcut).toBe(RELATORIOS_DEFAULT_SHORTCUT);
  });

  it('sem nenhum parâmetro cai no padrão (este mês)', () => {
    const state = readRelatoriosPeriodoFromSearchParams(new URLSearchParams(), today);
    expect(state).toEqual({ shortcut: 'este_mes', ...getRelatoriosPeriodShortcutRange('este_mes', today) });
  });
});
