import { describe, expect, it } from 'vitest';
import {
  generateFittingTimeSlots,
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
});
