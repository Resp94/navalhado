import { describe, expect, it } from 'vitest';
import {
  generateFittingTimeSlots,
  getEffectiveServiceDuration,
  generateProfessionalTimeOptions,
  generateScheduleTimeOptions,
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
});
