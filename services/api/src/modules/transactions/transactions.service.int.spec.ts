import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import type {
  CommitInvoiceInput,
  CreateTransactionInput,
  ListTransactionsQuery,
} from '@finance/contracts';
import { TransactionsService } from './transactions.service';
import { ReferenceNotFoundError } from './transactions.types';
import { TransactionEntity } from './entities/transaction.entity';
import { CategoryEntity } from '../categories/entities/category.entity';
import { AccountEntity } from '../accounts/entities/account.entity';
import { CreditCardEntity } from '../cards/entities/credit-card.entity';

/**
 * Integration test against a real Postgres — numeric(18,2)/timestamptz mappings, the atomic
 * installment-group create/delete transactions, and the ILIKE/`amount::text` filter+sort
 * queries only exercise against the real driver. Gated behind TEST_DATABASE_URL so
 * `pnpm test` stays green without a database. Exercised through {@link TransactionsService}
 * (the persistence layer was folded into the service), so reference rows are seeded to satisfy
 * validateReferences before each create.
 */
const url = process.env.TEST_DATABASE_URL;
const maybe = url ? describe : describe.skip;

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '55555555-5555-5555-5555-555555555555';
const CAT_EXPENSE = '22222222-2222-2222-2222-222222222222';
const CAT_INCOME = '44444444-4444-4444-4444-444444444444';
const ACC = '33333333-3333-3333-3333-333333333333';
const CARD_A = '66666666-6666-6666-6666-666666666666';
const CARD_B = '77777777-7777-7777-7777-777777777777';

function categoryEntity(id: string, type: 'expense' | 'income'): CategoryEntity {
  return Object.assign(new CategoryEntity(), {
    id,
    ownerId: null,
    parentId: null,
    name: type === 'income' ? 'Renda' : 'Outros',
    type,
    icon: 'tag',
    color: 'primary',
    isSystem: true,
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    updatedAt: new Date(Date.UTC(2026, 0, 1)),
  });
}

function accountEntity(id: string, userId: string): AccountEntity {
  return Object.assign(new AccountEntity(), {
    id,
    userId,
    name: 'Conta',
    bankId: 'itau',
    icon: 'bank',
    color: 'primary',
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    updatedAt: new Date(Date.UTC(2026, 0, 1)),
  });
}

function creditCardEntity(id: string, userId: string, dueDay: number): CreditCardEntity {
  return Object.assign(new CreditCardEntity(), {
    id,
    userId,
    name: 'Cartão',
    lastDigits: '1234',
    dueDay,
    closingDay: 1,
    limit: '5000.00',
    brandId: 'visa',
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    updatedAt: new Date(Date.UTC(2026, 0, 1)),
  });
}

maybe('TransactionsService (integration)', () => {
  let dataSource: DataSource;
  let service: TransactionsService;
  let txEntities: Repository<TransactionEntity>;

  const base = (): ListTransactionsQuery => ({
    dueFrom: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    dueTo: new Date(Date.UTC(2026, 0, 31, 23, 59, 59)).toISOString(),
    sort: 'dueDate',
    order: 'asc',
  });

  async function seedTx(over: {
    description: string;
    amount: string;
    day: number;
    recurrence?: 'single' | 'fixed' | 'installment';
    type?: 'expense' | 'income';
    notes?: string;
  }) {
    await service.create(USER_A, {
      recurrence: over.recurrence ?? 'single',
      type: over.type ?? 'expense',
      description: over.description,
      dueDate: new Date(Date.UTC(2026, 0, over.day)).toISOString(),
      amount: over.amount,
      categoryId: over.type === 'income' ? CAT_INCOME : CAT_EXPENSE,
      accountId: ACC,
      notes: over.notes,
    } as CreateTransactionInput);
  }

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: [TransactionEntity, CategoryEntity, AccountEntity, CreditCardEntity],
      synchronize: true,
      dropSchema: true,
    });
    await dataSource.initialize();
    txEntities = dataSource.getRepository(TransactionEntity);
    service = new TransactionsService(
      txEntities,
      dataSource.getRepository(CategoryEntity),
      dataSource.getRepository(AccountEntity),
      dataSource.getRepository(CreditCardEntity),
    );

    // Reference rows validateReferences requires (no DB-level FKs — seeded only for the service).
    await dataSource.getRepository(CategoryEntity).save([
      categoryEntity(CAT_EXPENSE, 'expense'),
      categoryEntity(CAT_INCOME, 'income'),
    ]);
    await dataSource.getRepository(AccountEntity).save(accountEntity(ACC, USER_A));
    await dataSource.getRepository(CreditCardEntity).save([
      creditCardEntity(CARD_A, USER_A, 10),
      creditCardEntity(CARD_B, USER_B, 10),
    ]);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await txEntities.clear();
  });

  describe('installment groups', () => {
    it('persists the whole installment group atomically, ordered by due date', async () => {
      const rows = await service.create(USER_A, {
        recurrence: 'installment',
        type: 'expense',
        description: 'Curso',
        dueDate: new Date(Date.UTC(2026, 0, 10)).toISOString(),
        amount: '100.00',
        installmentCount: 4,
        categoryId: CAT_EXPENSE,
        accountId: ACC,
      } as CreateTransactionInput);
      const groupId = rows[0].groupId as string;

      const back = await txEntities.find({ where: { groupId, userId: USER_A }, order: { dueDate: 'ASC' } });
      expect(back).toHaveLength(4);
      expect(back.map((t) => t.installmentNumber)).toEqual([1, 2, 3, 4]);
      expect(back.every((t) => t.amount === '100.00')).toBe(true);
    });

    it('deletes every row in the group (scope=all)', async () => {
      const rows = await service.create(USER_A, {
        recurrence: 'installment',
        type: 'expense',
        description: 'Curso',
        dueDate: new Date(Date.UTC(2026, 0, 10)).toISOString(),
        amount: '100.00',
        installmentCount: 3,
        categoryId: CAT_EXPENSE,
        accountId: ACC,
      } as CreateTransactionInput);
      const groupId = rows[0].groupId as string;

      await service.delete(USER_A, rows[0].id, 'all');
      expect(await txEntities.find({ where: { groupId, userId: USER_A } })).toHaveLength(0);
    });
  });

  describe('filters and sorting', () => {
    beforeEach(async () => {
      await seedTx({ description: 'Aluguel', amount: '1200.00', day: 5, notes: 'casa' });
      await seedTx({ description: 'Curso', amount: '100.00', day: 10, recurrence: 'fixed' });
      await seedTx({ description: 'Salário', amount: '5000.00', day: 1, type: 'income' });
    });

    it('search matches description, notes and amount text', async () => {
      expect((await service.list(USER_A, { ...base(), search: 'alug' })).map((t) => t.description)).toEqual(['Aluguel']);
      expect((await service.list(USER_A, { ...base(), search: 'casa' })).map((t) => t.description)).toEqual(['Aluguel']);
      expect((await service.list(USER_A, { ...base(), search: '5000' })).map((t) => t.description)).toEqual(['Salário']);
    });

    it('amount does a partial (contains) match', async () => {
      expect((await service.list(USER_A, { ...base(), amount: '120' })).map((t) => t.description)).toEqual(['Aluguel']);
    });

    it('filters by recurrence and type', async () => {
      expect((await service.list(USER_A, { ...base(), recurrence: 'fixed' })).map((t) => t.description)).toEqual(['Curso']);
      expect((await service.list(USER_A, { ...base(), type: 'income' })).map((t) => t.description)).toEqual(['Salário']);
    });

    it('sorts by amount ascending and descending', async () => {
      expect((await service.list(USER_A, { ...base(), sort: 'amount', order: 'asc' })).map((t) => t.amount)).toEqual([
        '100.00',
        '1200.00',
        '5000.00',
      ]);
      expect((await service.list(USER_A, { ...base(), sort: 'amount', order: 'desc' })).map((t) => t.amount)).toEqual([
        '5000.00',
        '1200.00',
        '100.00',
      ]);
    });

    it('scopes to the month window', async () => {
      await seedTx({ description: 'Fora', amount: '9.00', day: 5 });
      const feb = await service.list(USER_A, {
        ...base(),
        dueFrom: new Date(Date.UTC(2026, 1, 1)).toISOString(),
        dueTo: new Date(Date.UTC(2026, 1, 28)).toISOString(),
      });
      // Single 'Fora' (Jan) is out of window; the fixed 'Curso' is projected into Feb.
      expect(feb.map((t) => t.description)).toEqual(['Curso']);
    });
  });

  describe('invoice import commit', () => {
    function commitLine(
      over: Partial<CommitInvoiceInput['lines'][number]> = {},
    ): CommitInvoiceInput['lines'][number] {
      return {
        lineId: randomUUID(),
        date: '2026-08-03T00:00:00.000Z',
        description: 'Mercado',
        amount: '50.00',
        installmentNumber: null,
        installmentCount: null,
        uncertain: false,
        suggestedCategoryId: null,
        categoryId: CAT_EXPENSE,
        discarded: false,
        ...over,
      };
    }

    function commit(
      over: Partial<CommitInvoiceInput> = {},
    ): CommitInvoiceInput {
      return {
        creditCardId: CARD_A,
        referenceMonth: '2026-08',
        mode: 'merge',
        lines: [commitLine()],
        ...over,
      };
    }

    async function cardRows() {
      return txEntities.find({ where: { userId: USER_A, creditCardId: CARD_A } });
    }

    it('merges without duplicating on re-import (0% duplicates)', async () => {
      const input = commit({
        lines: [
          commitLine({ description: 'Mercado', amount: '50.00' }),
          commitLine({ description: 'Posto', amount: '80.00' }),
        ],
      });

      expect(await service.commitInvoice(USER_A, input)).toEqual({
        added: 2,
        skipped: 0,
        removed: 0,
      });
      expect(await service.commitInvoice(USER_A, input)).toEqual({
        added: 0,
        skipped: 2,
        removed: 0,
      });
      expect(await cardRows()).toHaveLength(2);
    });

    it('replace deletes the card+month scope then inserts, atomically', async () => {
      await service.commitInvoice(
        USER_A,
        commit({
          lines: [
            commitLine({ description: 'Antiga 1', amount: '10.00' }),
            commitLine({ description: 'Antiga 2', amount: '20.00' }),
          ],
        }),
      );

      const result = await service.commitInvoice(
        USER_A,
        commit({
          mode: 'replace',
          lines: [commitLine({ description: 'Nova', amount: '99.00' })],
        }),
      );

      expect(result).toEqual({ added: 1, skipped: 0, removed: 2 });
      const rows = await cardRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.description).toBe('Nova');
    });

    it('turns an installment line into an installment group with dueDate via billing-cycle', async () => {
      await service.commitInvoice(
        USER_A,
        commit({
          lines: [
            commitLine({
              description: 'Curso',
              amount: '100.00',
              installmentNumber: 1,
              installmentCount: 3,
            }),
          ],
        }),
      );

      const rows = (await cardRows()).sort(
        (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
      );
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.recurrence === 'installment')).toBe(true);
      expect(rows.every((r) => r.groupId === rows[0]?.groupId)).toBe(true);
      expect(rows.map((r) => r.installmentNumber)).toEqual([1, 2, 3]);
      expect(rows.map((r) => r.dueDate.toISOString().slice(0, 10))).toEqual([
        '2026-08-10',
        '2026-09-10',
        '2026-10-10',
      ]);
      expect(rows.every((r) => r.source === 'imported')).toBe(true);
      expect(rows.every((r) => r.status === 'pending')).toBe(true);
    });

    it('persists the original (raw) description when the line was renamed', async () => {
      await service.commitInvoice(
        USER_A,
        commit({
          lines: [
            commitLine({
              description: 'iFood',
              originalDescription: 'PG *IFD37272 SAO PAULO',
              amount: '42.00',
            }),
          ],
        }),
      );

      const rows = await cardRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.description).toBe('iFood');
      expect(rows[0]?.originalDescription).toBe('PG *IFD37272 SAO PAULO');
    });

    it('dedups a re-import on the raw description even when the label differs', async () => {
      const first = commit({
        lines: [
          commitLine({
            description: 'iFood',
            originalDescription: 'PG *IFD37272 SAO PAULO',
            amount: '42.00',
          }),
        ],
      });
      expect((await service.commitInvoice(USER_A, first)).added).toBe(1);

      // Same raw merchant string, different friendly label -> still a duplicate.
      const second = commit({
        lines: [
          commitLine({
            description: 'iFood delivery',
            originalDescription: 'PG *IFD37272 SAO PAULO',
            amount: '42.00',
          }),
        ],
      });
      expect(await service.commitInvoice(USER_A, second)).toEqual({
        added: 0,
        skipped: 1,
        removed: 0,
      });
      expect(await cardRows()).toHaveLength(1);
    });

    it('rejects a card owned by another user (not found)', async () => {
      await expect(
        service.commitInvoice(USER_A, commit({ creditCardId: CARD_B })),
      ).rejects.toBeInstanceOf(ReferenceNotFoundError);
      expect(await cardRows()).toHaveLength(0);
    });

    it('stores a negative line (estorno) as an income with the positive magnitude', async () => {
      await service.commitInvoice(
        USER_A,
        commit({
          lines: [
            commitLine({
              description: 'Estorno compra',
              amount: '-30.00',
              categoryId: CAT_INCOME,
            }),
          ],
        }),
      );

      const rows = await cardRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.type).toBe('income');
      expect(rows[0]?.amount).toBe('30.00');
      expect(rows[0]?.source).toBe('imported');
    });

    it('rejects a negative line categorized as an expense (type mismatch)', async () => {
      await expect(
        service.commitInvoice(
          USER_A,
          commit({
            lines: [commitLine({ amount: '-30.00', categoryId: CAT_EXPENSE })],
          }),
        ),
      ).rejects.toThrow();
      expect(await cardRows()).toHaveLength(0);
    });
  });
});
