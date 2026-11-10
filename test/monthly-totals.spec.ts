import { monthCount, startOfMonths, utcOffset } from 'src/utils/monthly-totals';

describe('monthly totals parameters', () => {
  it('accepts only real offsets', () => {
    expect(utcOffset('+01:00')).toBe('+01:00');
    expect(utcOffset('-05:30')).toBe('-05:30');
    expect(utcOffset('Africa/Accra')).toBe('+00:00');
    expect(utcOffset({ $gt: 1 })).toBe('+00:00');
  });

  it('keeps the count between 1 and 24', () => {
    expect(monthCount(undefined)).toBe(12);
    expect(monthCount('6')).toBe(6);
    expect(monthCount('99')).toBe(24);
    expect(monthCount('-3')).toBe(12);
  });

  it('starts at the first of the month, counting back in the zone', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(startOfMonths(now, 1, '+00:00').toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(startOfMonths(now, 12, '+00:00').toISOString()).toBe('2025-12-01T00:00:00.000Z');
    // Lagos midnight on 1 Nov is 23:00 UTC on 31 Oct.
    expect(startOfMonths(now, 1, '+01:00').toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });

  it('uses the zone to tell which month "now" is in', () => {
    // 23:30 UTC on 31 Oct is already November at +01:00.
    const now = new Date('2026-10-31T23:30:00Z');
    expect(startOfMonths(now, 1, '+01:00').toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(startOfMonths(now, 1, '+00:00').toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});
