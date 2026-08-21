import { LinkedAccount, type CreateLinkedAccountData } from './linked-account';
import { InvalidPluggyItemError } from './errors';

const base: CreateLinkedAccountData = {
  id: 'acc-1',
  bankConnectionId: 'conn-1',
  userId: 'user-a',
  pluggyAccountId: 'pluggy-acc-1',
  type: 'CHECKING_ACCOUNT',
  displayName: 'Conta corrente',
  balance: '100.00',
};

describe('LinkedAccount aggregate', () => {
  describe('create', () => {
    it('starts with no apiAccountId', () => {
      const a = LinkedAccount.create(base);
      expect(a.apiAccountId).toBeNull();
    });

    it('rejects empty displayName', () => {
      expect(() => LinkedAccount.create({ ...base, displayName: '  ' })).toThrow(
        InvalidPluggyItemError,
      );
    });

    it('rejects a non-numeric balance', () => {
      expect(() => LinkedAccount.create({ ...base, balance: 'abc' })).toThrow(
        InvalidPluggyItemError,
      );
    });
  });

  describe('linkApiAccount', () => {
    it('records the services/api Account id and bumps updatedAt', () => {
      const a = LinkedAccount.create({ ...base, now: new Date('2026-08-01T00:00:00Z') });
      a.linkApiAccount('api-account-1', new Date('2026-08-02T00:00:00Z'));
      expect(a.apiAccountId).toBe('api-account-1');
      expect(a.updatedAt).toEqual(new Date('2026-08-02T00:00:00Z'));
    });
  });

  describe('updateSnapshot', () => {
    it('replaces displayName and balance, leaves apiAccountId untouched', () => {
      const a = LinkedAccount.create(base);
      a.linkApiAccount('api-account-1');
      a.updateSnapshot({ displayName: 'Conta nova', balance: '150.00' });
      expect(a.displayName).toBe('Conta nova');
      expect(a.balance).toBe('150.00');
      expect(a.apiAccountId).toBe('api-account-1');
    });
  });
});
