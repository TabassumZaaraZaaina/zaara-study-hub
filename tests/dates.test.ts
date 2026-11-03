import { describe, expect, it } from 'vitest';
import { addDays, diffDays, localDate, relativeDay, weekday, isValidISODate } from '@/utils/dates';

describe('Dhaka dates', () => {
  it('uses Asia/Dhaka (UTC+6) for the local day boundary', () => {
    expect(localDate(new Date('2026-11-03T17:59:00Z'))).toBe('2026-11-03');
    expect(localDate(new Date('2026-11-03T18:00:00Z'))).toBe('2026-11-04');
  });
  it('countdown to Mock 2', () => {
    expect(diffDays('2026-11-03', '2026-11-25')).toBe(22);
    expect(relativeDay('2026-11-04', '2026-11-03')).toBe('tomorrow');
  });
  it('arithmetic and validation', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekday('2026-11-03')).toBe(2);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2027-06-01')).toBe(true);
  });
});
