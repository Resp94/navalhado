import { describe, expect, it } from 'vitest';
import {
  generateFittingTimeSlots,
  isTimeAlignedToSlotInterval,
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
});
