import { SyncedTransaction, type CreateSyncedTransactionData } from './synced-transaction';
import { InvalidPluggyItemError } from './errors';

const base: CreateSyncedTransactionData = {
  id: 'st-1',
  linkedAccountId: 'acc-1',
  linkedCreditCardId: null,
  userId: 'user-a',
  pluggyTransactionId: 'pluggy-tx-1',
  description: 'Supermercado',
  amount: '50.00',
  date: new Date(Date.UTC(2026, 0, 10)),
  direction: 'debit',
  pluggyStatus: 'posted',
};

describe('SyncedTransaction aggregate', () => {
  describe('origin invariant (XOR)', () => {
    it('accepts exactly linkedAccountId', () => {
      expect(() => SyncedTransaction.create(base)).not.toThrow();
    });

    it('accepts exactly linkedCreditCardId', () => {
      expect(() =>
        SyncedTransaction.create({ ...base, linkedAccountId: null, linkedCreditCardId: 'card-1' }),
      ).not.toThrow();
    });

    it('rejects both linkedAccountId and linkedCreditCardId', () => {
      expect(() =>
        SyncedTransaction.create({ ...base, linkedAccountId: 'acc-1', linkedCreditCardId: 'card-1' }),
      ).toThrow(InvalidPluggyItemError);
    });

    it('rejects neither linkedAccountId nor linkedCreditCardId', () => {
      expect(() =>
        SyncedTransaction.create({ ...base, linkedAccountId: null, linkedCreditCardId: null }),
      ).toThrow(InvalidPluggyItemError);
    });
  });

  describe('value invariant', () => {
    it('rejects zero/negative amounts', () => {
      expect(() => SyncedTransaction.create({ ...base, amount: '0.00' })).toThrow(
        InvalidPluggyItemError,
      );
      expect(() => SyncedTransaction.create({ ...base, amount: '-5.00' })).toThrow(
        InvalidPluggyItemError,
      );
    });

    it('rejects empty description', () => {
      expect(() => SyncedTransaction.create({ ...base, description: '   ' })).toThrow(
        InvalidPluggyItemError,
      );
    });
  });

  describe('initial state', () => {
    it('starts pending, unattached to Transactions MS, zero retries', () => {
      const t = SyncedTransaction.create(base);
      expect(t.syncStatus).toBe('pending');
      expect(t.transactionsMsId).toBeNull();
      expect(t.retryCount).toBe(0);
      expect(t.lastError).toBeNull();
    });
  });

  describe('syncStatus transitions', () => {
    it('pending -> processing -> success', () => {
      const t = SyncedTransaction.create(base);
      t.startProcessing();
      expect(t.syncStatus).toBe('processing');
      t.markSuccess('tx-ms-1');
      expect(t.syncStatus).toBe('success');
      expect(t.transactionsMsId).toBe('tx-ms-1');
      expect(t.lastError).toBeNull();
    });

    it('processing -> error increments retryCount and records message', () => {
      const t = SyncedTransaction.create(base);
      t.startProcessing();
      t.markError('boom');
      expect(t.syncStatus).toBe('error');
      expect(t.retryCount).toBe(1);
      expect(t.lastError).toBe('boom');
    });

    it('retry re-arms an errored row to pending without resetting retryCount', () => {
      const t = SyncedTransaction.create(base);
      t.startProcessing();
      t.markError('boom');
      t.retry();
      expect(t.syncStatus).toBe('pending');
      expect(t.retryCount).toBe(1);
    });

    it('repeated errors accumulate retryCount', () => {
      const t = SyncedTransaction.create(base);
      t.markError('e1');
      t.retry();
      t.markError('e2');
      expect(t.retryCount).toBe(2);
    });
  });

  describe('hasReachedRetryLimit', () => {
    it('is false below the limit and true at/above it', () => {
      const t = SyncedTransaction.create(base);
      t.markError('e1');
      expect(t.hasReachedRetryLimit(3)).toBe(false);
      t.retry();
      t.markError('e2');
      t.retry();
      t.markError('e3');
      expect(t.hasReachedRetryLimit(3)).toBe(true);
    });
  });

  describe('restore', () => {
    it('rehydrates without re-validating invariants', () => {
      const t = SyncedTransaction.restore({
        ...base,
        linkedAccountId: null,
        linkedCreditCardId: null,
        syncStatus: 'success',
        transactionsMsId: 'tx-ms-1',
        retryCount: 0,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(t.syncStatus).toBe('success');
    });
  });
});
