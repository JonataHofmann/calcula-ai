import { LinkedCreditCard, type CreateLinkedCreditCardData } from './linked-credit-card';
import { InvalidPluggyItemError } from './errors';

const base: CreateLinkedCreditCardData = {
  id: 'card-1',
  bankConnectionId: 'conn-1',
  userId: 'user-a',
  pluggyAccountId: 'pluggy-card-1',
  brand: 'Visa',
  lastDigits: '5678',
  creditLimit: '1000.00',
  availableLimit: '800.00',
  currentBalance: '-200.00',
};

describe('LinkedCreditCard aggregate', () => {
  describe('create', () => {
    it('starts with no apiCreditCardId', () => {
      const c = LinkedCreditCard.create(base);
      expect(c.apiCreditCardId).toBeNull();
    });

    it('rejects lastDigits that are not exactly 4 digits', () => {
      expect(() => LinkedCreditCard.create({ ...base, lastDigits: '567' })).toThrow(
        InvalidPluggyItemError,
      );
    });

    it('rejects a non-numeric currentBalance', () => {
      expect(() => LinkedCreditCard.create({ ...base, currentBalance: 'abc' })).toThrow(
        InvalidPluggyItemError,
      );
    });
  });

  describe('linkApiCreditCard', () => {
    it('records the services/api CreditCard id and bumps updatedAt', () => {
      const c = LinkedCreditCard.create({ ...base, now: new Date('2026-08-01T00:00:00Z') });
      c.linkApiCreditCard('api-card-1', new Date('2026-08-02T00:00:00Z'));
      expect(c.apiCreditCardId).toBe('api-card-1');
      expect(c.updatedAt).toEqual(new Date('2026-08-02T00:00:00Z'));
    });
  });

  describe('updateSnapshot', () => {
    it('replaces balance/limit fields, leaves apiCreditCardId untouched', () => {
      const c = LinkedCreditCard.create(base);
      c.linkApiCreditCard('api-card-1');
      c.updateSnapshot({ currentBalance: '-250.00', creditLimit: '1200.00', availableLimit: '700.00' });
      expect(c.currentBalance).toBe('-250.00');
      expect(c.creditLimit).toBe('1200.00');
      expect(c.availableLimit).toBe('700.00');
      expect(c.apiCreditCardId).toBe('api-card-1');
    });
  });
});
