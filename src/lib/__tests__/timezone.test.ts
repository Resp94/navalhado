import { describe, expect, it, vi } from 'vitest';
import { dateInZone, formatTimeInZone, localDateTimeToIso, localDayUtcRange, shiftCalendarDate } from '../timezone';

describe('timezone helpers', () => {
  it('converts a Manaus calendar day to the correct UTC range', () => {
    expect(localDayUtcRange('2026-07-15', 'America/Manaus')).toEqual({
      start: '2026-07-15T04:00:00.000Z',
      endExclusive: '2026-07-16T04:00:00.000Z',
    });
  });

  it('converts a tenant-local appointment time to UTC', () => {
    expect(localDateTimeToIso('2026-07-15', '09:30', 'America/Manaus'))
      .toBe('2026-07-15T13:30:00.000Z');
  });

  it('formats an instant in the tenant timezone', () => {
    expect(formatTimeInZone('2026-07-15T13:30:00.000Z', 'America/Manaus'))
      .toBe('09:30');
  });

  it('reuses the time formatter of a timezone instead of building one per call', () => {
    // Uma lista de milhares de linhas (a Exportação de Dados) formata uma hora por linha: criar um Intl.DateTimeFormat a cada
    // chamada custa dezenas de microssegundos cada. O fuso é um que nenhum outro teste usa, para o cache começar vazio.
    const original = Intl.DateTimeFormat;
    const construtor = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (...args: ConstructorParameters<typeof original>) {
      return new original(...args);
    } as unknown as typeof Intl.DateTimeFormat);
    try {
      expect(formatTimeInZone('2026-07-15T13:30:00.000Z', 'America/Cuiaba')).toBe('09:30');
      expect(formatTimeInZone('2026-07-15T18:45:00.000Z', 'America/Cuiaba')).toBe('14:45');
      expect(construtor).toHaveBeenCalledTimes(1);
    } finally {
      construtor.mockRestore();
    }
  });

  it('derives the tenant calendar date near a UTC boundary', () => {
    expect(dateInZone(new Date('2026-07-16T02:00:00.000Z'), 'America/Manaus'))
      .toBe('2026-07-15');
  });

  it('shifts calendar dates without depending on the machine timezone', () => {
    expect(shiftCalendarDate('2026-07-31', 1)).toBe('2026-08-01');
  });
});
