import { Transaction, type CreateTransactionData } from './transaction';
import { InvalidTransactionError, AlreadyPaidError } from './errors';

const base: CreateTransactionData = {
  id: 't1',
  userId: 'user-a',
  description: 'Aluguel',
  dueDate: new Date(Date.UTC(2026, 0, 10)),
  amount: '100.00',
  recurrence: 'single',
  type: 'expense',
  categoryId: 'cat-1',
  accountId: 'acc-1',
  creditCardId: null,
};

describe('Transaction aggregate', () => {
  describe('origin invariants (R7)', () => {
    it('accepts an expense with an account', () => {
      expect(() => Transaction.create(base)).not.toThrow();
    });

    it('accepts an expense with a card', () => {
      expect(() =>
        Transaction.create({ ...base, accountId: null, creditCardId: 'card-1' }),
      ).not.toThrow();
    });

    it('rejects an expense with both account and card', () => {
      expect(() =>
        Transaction.create({ ...base, accountId: 'acc-1', creditCardId: 'card-1' }),
      ).toThrow(InvalidTransactionError);
    });

    it('rejects an expense with neither account nor card', () => {
      expect(() =>
        Transaction.create({ ...base, accountId: null, creditCardId: null }),
      ).toThrow(InvalidTransactionError);
    });

    it('rejects income with a card', () => {
      expect(() =>
        Transaction.create({
          ...base,
          type: 'income',
          accountId: 'acc-1',
          creditCardId: 'card-1',
        }),
      ).toThrow(InvalidTransactionError);
    });

    it('rejects income without an account', () => {
      expect(() =>
        Transaction.create({ ...base, type: 'income', accountId: null, creditCardId: null }),
      ).toThrow(InvalidTransactionError);
    });
  });

  describe('value invariant', () => {
    it('rejects zero/negative amounts', () => {
      expect(() => Transaction.create({ ...base, amount: '0.00' })).toThrow(
        InvalidTransactionError,
      );
      expect(() => Transaction.create({ ...base, amount: '-5.00' })).toThrow(
        InvalidTransactionError,
      );
    });

    it('rejects empty description', () => {
      expect(() => Transaction.create({ ...base, description: '   ' })).toThrow(
        InvalidTransactionError,
      );
    });
  });

  describe('recurrence invariants', () => {
    it('rejects single carrying group/installment/end fields', () => {
      expect(() => Transaction.create({ ...base, groupId: 'g1' })).toThrow(
        InvalidTransactionError,
      );
    });

    it('requires installmentCount/number/groupId for installment', () => {
      expect(() =>
        Transaction.create({
          ...base,
          recurrence: 'installment',
          groupId: 'g1',
          installmentCount: 3,
          installmentNumber: 4,
        }),
      ).toThrow(InvalidTransactionError);
    });

    it('accepts a valid installment occurrence', () => {
      expect(() =>
        Transaction.create({
          ...base,
          recurrence: 'installment',
          groupId: 'g1',
          installmentCount: 3,
          installmentNumber: 1,
        }),
      ).not.toThrow();
    });

    it('requires groupId for fixed and rejects endDate < dueDate', () => {
      expect(() =>
        Transaction.create({ ...base, recurrence: 'fixed' }),
      ).toThrow(InvalidTransactionError);
      expect(() =>
        Transaction.create({
          ...base,
          recurrence: 'fixed',
          groupId: 'g1',
          endDate: new Date(Date.UTC(2025, 11, 1)),
        }),
      ).toThrow(InvalidTransactionError);
    });

    it('accepts a fixed with an open end (no endDate)', () => {
      expect(() =>
        Transaction.create({ ...base, recurrence: 'fixed', groupId: 'g1' }),
      ).not.toThrow();
    });
  });

  describe('effectuate (FR-017)', () => {
    it('moves pending -> paid with default amount and given date', () => {
      const t = Transaction.create(base);
      const date = new Date(Date.UTC(2026, 0, 12));
      t.effectuate({ date });
      expect(t.status).toBe('paid');
      expect(t.effectiveDate).toEqual(date);
      expect(t.effectiveAmount).toBe('100.00');
    });

    it('records a custom effective amount but preserves the planned amount', () => {
      const t = Transaction.create(base);
      t.effectuate({ amount: '95.00' });
      expect(t.amount).toBe('100.00');
      expect(t.effectiveAmount).toBe('95.00');
    });

    it('blocks re-effectuating an already-paid transaction', () => {
      const t = Transaction.create(base);
      t.effectuate({});
      expect(() => t.effectuate({})).toThrow(AlreadyPaidError);
    });
  });

  describe('update (R3)', () => {
    it('preserves status/effectiveDate/effectiveAmount when editing a paid row', () => {
      const t = Transaction.create(base);
      const paidDate = new Date(Date.UTC(2026, 0, 12));
      t.effectuate({ date: paidDate, amount: '90.00' });
      t.update({ description: 'Aluguel reajustado', amount: '110.00' });
      expect(t.description).toBe('Aluguel reajustado');
      expect(t.amount).toBe('110.00');
      expect(t.status).toBe('paid');
      expect(t.effectiveDate).toEqual(paidDate);
      expect(t.effectiveAmount).toBe('90.00');
    });

    it('re-checks origin invariant on update', () => {
      const t = Transaction.create(base);
      expect(() => t.update({ creditCardId: 'card-1' })).toThrow(InvalidTransactionError);
    });
  });
});
