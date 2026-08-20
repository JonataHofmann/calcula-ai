import { randomUUID } from 'node:crypto';
import { ImportSyncedTransactionUseCase } from './import-synced-transaction';
import type { ImportSyncedTransactionInput } from './import-synced-transaction.schemas';
import {
  ReferenceNotFoundError,
  SyncedImportConflictError,
  TransactionNotFoundError,
} from '../../../domain/errors';
import {
  FakeAccountLookup,
  FakeCardLookup,
  FakeCategoryLookup,
  FakeTransactionRepository,
  USER_A,
} from '../test-fakes';

const DEFAULT_EXPENSE_CATEGORY = randomUUID();
const CHOSEN_CATEGORY = randomUUID();
const ACCOUNT_ID = randomUUID();

function setup() {
  const transactions = new FakeTransactionRepository();
  const categories = new FakeCategoryLookup()
    .addDefault('expense', DEFAULT_EXPENSE_CATEGORY)
    .add(CHOSEN_CATEGORY, 'expense');
  const accounts = new FakeAccountLookup().add(ACCOUNT_ID, USER_A);
  const cards = new FakeCardLookup();
  const useCase = new ImportSyncedTransactionUseCase(transactions, categories, accounts, cards);
  return { useCase, transactions, categories, accounts, cards };
}

const baseInput: Omit<ImportSyncedTransactionInput, 'categoryId'> = {
  userId: USER_A,
  description: 'Supermercado',
  amount: '50.00',
  dueDate: new Date(Date.UTC(2026, 0, 10)).toISOString(),
  type: 'expense',
  accountId: ACCOUNT_ID,
  creditCardId: null,
  source: 'synced',
  externalId: randomUUID(),
  pluggyStatus: 'posted',
};

describe('ImportSyncedTransactionUseCase', () => {
  describe('create', () => {
    it('defaults to the type catch-all category when categoryId is omitted', async () => {
      const { useCase, transactions } = setup();
      const result = await useCase.create(baseInput);
      const stored = await transactions.findById(result.id, USER_A);
      expect(stored?.categoryId).toBe(DEFAULT_EXPENSE_CATEGORY);
    });

    it('uses the given categoryId when provided', async () => {
      const { useCase, transactions } = setup();
      const result = await useCase.create({ ...baseInput, categoryId: CHOSEN_CATEGORY });
      const stored = await transactions.findById(result.id, USER_A);
      expect(stored?.categoryId).toBe(CHOSEN_CATEGORY);
    });

    it('throws ReferenceNotFoundError when no default category exists for the type', async () => {
      const { useCase, categories } = setup();
      categories.addDefault('expense', '');
      await expect(useCase.create(baseInput)).rejects.toBeInstanceOf(ReferenceNotFoundError);
    });

    it('is idempotent by externalId, returning the existing transaction', async () => {
      const { useCase } = setup();
      const first = await useCase.create(baseInput);
      const second = await useCase.create(baseInput);
      expect(second.id).toBe(first.id);
    });

    it('throws SyncedImportConflictError when the same externalId is replayed with a different body', async () => {
      const { useCase } = setup();
      await useCase.create(baseInput);
      await expect(
        useCase.create({ ...baseInput, amount: '999.00' }),
      ).rejects.toBeInstanceOf(SyncedImportConflictError);
    });

    it('does not conflict on pluggyStatus alone, since it is not persisted', async () => {
      const { useCase } = setup();
      const first = await useCase.create(baseInput);
      const second = await useCase.create({ ...baseInput, pluggyStatus: 'pending' });
      expect(second.id).toBe(first.id);
    });

    it('accepts card installment metadata without throwing (US3)', async () => {
      const { useCase, transactions } = setup();
      const result = await useCase.create({
        ...baseInput,
        installmentNumber: 3,
        installmentCount: 12,
      });
      const stored = await transactions.findById(result.id, USER_A);
      expect(stored?.installmentNumber).toBe(3);
      expect(stored?.installmentCount).toBe(12);
    });
  });

  describe('patch', () => {
    it('throws TransactionNotFoundError for an unknown externalId', async () => {
      const { useCase } = setup();
      await expect(useCase.patch(USER_A, 'unknown-external-id', {})).rejects.toBeInstanceOf(
        TransactionNotFoundError,
      );
    });

    it('updates description and amount by externalId', async () => {
      const { useCase, transactions } = setup();
      const created = await useCase.create(baseInput);
      await useCase.patch(USER_A, baseInput.externalId, {
        description: 'Supermercado Central',
        amount: '55.00',
      });
      const stored = await transactions.findById(created.id, USER_A);
      expect(stored?.description).toBe('Supermercado Central');
      expect(stored?.amount).toBe('55.00');
    });

    it('echoes the pending->posted transition without creating a second transaction (FR-009)', async () => {
      const { useCase, transactions } = setup();
      const created = await useCase.create({ ...baseInput, pluggyStatus: 'pending' });
      const result = await useCase.patch(USER_A, baseInput.externalId, { pluggyStatus: 'posted' });
      expect(result.id).toBe(created.id);
      expect(result.pluggyStatus).toBe('posted');
      expect(await transactions.findById(created.id, USER_A)).not.toBeNull();
    });

    it('updates installmentNumber/installmentCount on the same row (US3)', async () => {
      const { useCase, transactions } = setup();
      const created = await useCase.create({
        ...baseInput,
        installmentNumber: 1,
        installmentCount: 12,
      });
      await useCase.patch(USER_A, baseInput.externalId, {
        installmentNumber: 2,
        installmentCount: 12,
      });
      const stored = await transactions.findById(created.id, USER_A);
      expect(stored?.installmentNumber).toBe(2);
      expect(stored?.installmentCount).toBe(12);
    });
  });

  describe('delete', () => {
    it('throws TransactionNotFoundError for an unknown externalId', async () => {
      const { useCase } = setup();
      await expect(useCase.delete(USER_A, 'unknown-external-id')).rejects.toBeInstanceOf(
        TransactionNotFoundError,
      );
    });

    it('removes the transaction by externalId', async () => {
      const { useCase, transactions } = setup();
      const created = await useCase.create(baseInput);
      await useCase.delete(USER_A, baseInput.externalId);
      expect(await transactions.findById(created.id, USER_A)).toBeNull();
    });
  });
});
