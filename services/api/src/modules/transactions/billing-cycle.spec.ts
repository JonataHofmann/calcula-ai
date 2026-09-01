import { invoiceDueDate, invoiceDueDateForPurchase } from './billing-cycle';

/** ISO calendar day (UTC) of a Date, for concise assertions. */
function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe('invoiceDueDateForPurchase', () => {
  describe('closing after due day (closing=25, due=5): due lands next month', () => {
    const due = (purchase: string) =>
      day(invoiceDueDateForPurchase(new Date(purchase), 25, 5));

    it('purchase on/before closing → invoice due the following month', () => {
      expect(due('2026-01-20T00:00:00.000Z')).toBe('2026-02-05');
    });

    it('purchase after closing → invoice due one more month out', () => {
      expect(due('2026-01-26T00:00:00.000Z')).toBe('2026-03-05');
    });

    it('purchase exactly on the closing day still closes this month', () => {
      expect(due('2026-01-25T00:00:00.000Z')).toBe('2026-02-05');
    });

    it('rolls the year over from December', () => {
      expect(due('2026-12-20T00:00:00.000Z')).toBe('2027-01-05');
      expect(due('2026-12-26T00:00:00.000Z')).toBe('2027-02-05');
    });
  });

  describe('closing before due day (closing=5, due=15): due lands in the closing month', () => {
    const due = (purchase: string) =>
      day(invoiceDueDateForPurchase(new Date(purchase), 5, 15));

    it('purchase on/before closing → invoice due same month', () => {
      expect(due('2026-01-03T00:00:00.000Z')).toBe('2026-01-15');
    });

    it('purchase after closing → invoice due next month', () => {
      expect(due('2026-01-10T00:00:00.000Z')).toBe('2026-02-15');
    });
  });

  describe('end-of-month clamping', () => {
    // closing=5, due=31: a purchase after closing (Jan 10) closes in Feb; due day 31 clamps to Feb 28.
    it('clamps the due day to the due month last day', () => {
      expect(day(invoiceDueDateForPurchase(new Date('2026-01-10T00:00:00.000Z'), 5, 31))).toBe(
        '2026-02-28',
      );
    });
  });
});

describe('invoiceDueDate (imported statement, unchanged)', () => {
  it('places the due day within the reference month', () => {
    expect(day(invoiceDueDate('2026-08', 5))).toBe('2026-08-05');
  });

  it('clamps to the month last day', () => {
    expect(day(invoiceDueDate('2026-02', 31))).toBe('2026-02-28');
  });
});
