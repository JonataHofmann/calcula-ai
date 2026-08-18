import {
  toCents,
  fromCents,
  splitInstallments,
  addMonthClamped,
  nextOccurrence,
} from './recurrence';

describe('recurrence/money helpers', () => {
  describe('toCents / fromCents', () => {
    it('round-trips decimal money strings without float drift', () => {
      expect(toCents('100.00')).toBe(10000);
      expect(toCents('0.05')).toBe(5);
      expect(toCents('1234.56')).toBe(123456);
      expect(fromCents(10000)).toBe('100.00');
      expect(fromCents(5)).toBe('0.05');
      expect(fromCents(123456)).toBe('1234.56');
    });

    it('handles missing/short fraction', () => {
      expect(toCents('10')).toBe(1000);
      expect(toCents('10.5')).toBe(1050);
    });
  });

  describe('splitInstallments', () => {
    it('sum of parcels always equals the total', () => {
      const parcels = splitInstallments(10000, 3);
      expect(parcels).toHaveLength(3);
      const sum = parcels.reduce((acc, p) => acc + toCents(p), 0);
      expect(sum).toBe(10000);
    });

    it('last parcel absorbs the remainder', () => {
      const parcels = splitInstallments(10000, 3);
      expect(parcels).toEqual(['33.33', '33.33', '33.34']);
    });

    it('handles an even split', () => {
      expect(splitInstallments(9000, 3)).toEqual(['30.00', '30.00', '30.00']);
    });

    it('rejects count < 1', () => {
      expect(() => splitInstallments(1000, 0)).toThrow();
    });
  });

  describe('addMonthClamped', () => {
    it('preserves day-of-month across a normal month', () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      expect(addMonthClamped(d, 1).toISOString()).toBe('2026-02-15T00:00:00.000Z');
    });

    it('clamps Jan 31 -> Feb 28 (non-leap)', () => {
      const d = new Date(Date.UTC(2026, 0, 31));
      const next = addMonthClamped(d, 1);
      expect(next.getUTCMonth()).toBe(1);
      expect(next.getUTCDate()).toBe(28);
    });

    it('clamps Jan 31 -> Feb 29 (leap year)', () => {
      const d = new Date(Date.UTC(2028, 0, 31));
      const next = addMonthClamped(d, 1);
      expect(next.getUTCMonth()).toBe(1);
      expect(next.getUTCDate()).toBe(29);
    });

    it('rolls over the year on +n months', () => {
      const d = new Date(Date.UTC(2026, 10, 15));
      expect(addMonthClamped(d, 3).toISOString()).toBe('2027-02-15T00:00:00.000Z');
    });
  });

  describe('nextOccurrence', () => {
    it('returns dueDate + 1 month when no endDate', () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      expect(nextOccurrence(d)?.toISOString()).toBe('2026-02-15T00:00:00.000Z');
    });

    it('returns null when the next occurrence passes endDate', () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      const end = new Date(Date.UTC(2026, 0, 31));
      expect(nextOccurrence(d, end)).toBeNull();
    });

    it('returns the occurrence when it lands exactly on endDate', () => {
      const d = new Date(Date.UTC(2026, 0, 15));
      const end = new Date(Date.UTC(2026, 1, 15));
      expect(nextOccurrence(d, end)?.toISOString()).toBe('2026-02-15T00:00:00.000Z');
    });
  });
});
