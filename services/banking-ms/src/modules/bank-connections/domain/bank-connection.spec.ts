import { BankConnection, type CreateBankConnectionData } from './bank-connection';
import { InvalidPluggyItemError } from './errors';

const base: CreateBankConnectionData = {
  id: 'conn-1',
  userId: 'user-a',
  pluggyItemId: 'item-1',
  institutionId: 'inst-1',
  institutionName: 'Banco Teste',
};

describe('BankConnection aggregate', () => {
  describe('create', () => {
    it('starts active with no lastSyncedAt', () => {
      const c = BankConnection.create(base);
      expect(c.status).toBe('active');
      expect(c.lastSyncedAt).toBeNull();
    });

    it('rejects empty pluggyItemId', () => {
      expect(() => BankConnection.create({ ...base, pluggyItemId: '  ' })).toThrow(
        InvalidPluggyItemError,
      );
    });

    it('rejects empty institutionId', () => {
      expect(() => BankConnection.create({ ...base, institutionId: '' })).toThrow(
        InvalidPluggyItemError,
      );
    });

    it('rejects empty institutionName', () => {
      expect(() => BankConnection.create({ ...base, institutionName: '' })).toThrow(
        InvalidPluggyItemError,
      );
    });
  });

  describe('status transitions', () => {
    it('active -> needs_attention -> active', () => {
      const c = BankConnection.create(base);
      c.markNeedsAttention();
      expect(c.status).toBe('needs_attention');
      c.markActive();
      expect(c.status).toBe('active');
    });

    it('active -> disconnected is terminal (markActive/markNeedsAttention are no-ops after)', () => {
      const c = BankConnection.create(base);
      c.disconnect();
      expect(c.status).toBe('disconnected');
      c.markActive();
      expect(c.status).toBe('disconnected');
      c.markNeedsAttention();
      expect(c.status).toBe('disconnected');
    });

    it('disconnect is idempotent', () => {
      const c = BankConnection.create(base);
      c.disconnect();
      c.disconnect();
      expect(c.status).toBe('disconnected');
    });
  });

  describe('recordSync', () => {
    it('sets lastSyncedAt and updatedAt', () => {
      const c = BankConnection.create(base);
      const now = new Date(Date.UTC(2026, 0, 15));
      c.recordSync(now);
      expect(c.lastSyncedAt).toEqual(now);
      expect(c.updatedAt).toEqual(now);
    });
  });

  describe('restore', () => {
    it('rehydrates without re-validating invariants', () => {
      const c = BankConnection.restore({
        ...base,
        status: 'disconnected',
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      expect(c.status).toBe('disconnected');
    });
  });
});
