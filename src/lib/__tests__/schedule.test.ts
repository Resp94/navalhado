import { describe, expect, it } from 'vitest';
import {
  buildFittingAppointmentInterval,
  generateFittingTimeSlots,
  getEffectiveServiceDuration,
  generateProfessionalTimeOptions,
  generateScheduleTimeOptions,
  isValidFittingStartTime,
  isTimeAlignedToSlotInterval,
  normalizeBusinessHours,
} from '../schedule';

describe('schedule fitting slots', () => {
  it('accepts only times aligned to the tenant interval', () => {
    expect(isTimeAlignedToSlotInterval('07:00', 30)).toBe(true);
    expect(isTimeAlignedToSlotInterval('07:30', 30)).toBe(true);
    expect(isTimeAlignedToSlotInterval('22:30', 30)).toBe(true);
    expect(isTimeAlignedToSlotInterval('07:17', 30)).toBe(false);
  });

  it('generates the entire local day from midnight using the configured interval', () => {
    const slots = generateFittingTimeSlots(40);

    expect(slots[0]).toBe('00:00');
    expect(slots.at(-1)).toBe('23:20');
    expect(slots).toHaveLength(36);
    expect(slots).toContain('07:20');
    expect(slots).not.toContain('07:17');
  });

  it('normalizes Friday to 20:00 and restricts schedule options to business hours', () => {
    const hours = normalizeBusinessHours({
      sexta: { active: true, open: '09:00', close: '20:00' },
    });

    expect(hours.sexta).toEqual({ active: true, open: '09:00', close: '20:00' });
    const options = generateScheduleTimeOptions(hours.sexta.open!, hours.sexta.close!, 30);
    expect(options[0]).toBe('09:00');
    expect(options).toContain('19:30');
    expect(options).toContain('20:00');
    expect(options).not.toContain('08:30');
    expect(options).not.toContain('20:30');
  });

  it('keeps professional schedule options independent from the appointment grid interval', () => {
    const options = generateProfessionalTimeOptions('09:00', '19:00');

    expect(options).toContain('12:00');
    expect(options).toContain('14:00');
    expect(options).toContain('18:55');
    expect(options).not.toContain('19:05');
  });

  it('uses the enabled professional duration override and falls back to the service duration', () => {
    const services = [
      { service_id: 'service-1', custom_duration_minutes: 45, is_enabled: true },
      { service_id: 'service-2', custom_duration_minutes: 20, is_enabled: false },
    ];

    expect(getEffectiveServiceDuration(60, 'service-1', services)).toBe(45);
    expect(getEffectiveServiceDuration(60, 'service-2', services)).toBe(60);
    expect(getEffectiveServiceDuration(60, 'service-3', services)).toBe(60);
  });

  it('diferencia horário de encaixe pela grade de horário personalizado', () => {
    expect(isValidFittingStartTime('18:00', 'grid', 40)).toBe(true);
    expect(isValidFittingStartTime('18:10', 'grid', 40)).toBe(false);
    expect(isValidFittingStartTime('18:10', 'custom', 40)).toBe(true);
    expect(isValidFittingStartTime('25:00', 'custom', 40)).toBe(false);
  });

  it('constrói o intervalo persistível no timezone e não trunca no fechamento', () => {
    const interval = buildFittingAppointmentInterval({
      date: '2026-08-31',
      time: '18:10',
      timeZone: 'America/Manaus',
      durationMinutes: 60,
      mode: 'custom',
      slotIntervalMinutes: 40,
    });

    expect(interval.startIso).toBe('2026-08-31T22:10:00.000Z');
    expect(interval.endIso).toBe('2026-08-31T23:10:00.000Z');
    expect(interval.startLocal).toEqual({ date: '2026-08-31', time: '18:10' });
    expect(interval.endLocal).toEqual({ date: '2026-08-31', time: '19:10' });
  });

  it('rejeita horário desalinhado quando o modo de grade é usado', () => {
    expect(() => buildFittingAppointmentInterval({
      date: '2026-08-31',
      time: '18:10',
      timeZone: 'America/Manaus',
      durationMinutes: 60,
      mode: 'grid',
      slotIntervalMinutes: 40,
    })).toThrow('FITTING_TIME_NOT_ALIGNED');
  });
});
